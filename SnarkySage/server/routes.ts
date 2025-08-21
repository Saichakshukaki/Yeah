import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertChatSessionSchema, insertChatMessageSchema } from "@shared/schema";
import { generateSarcasticResponse, generateSarcasticResponseStream, filterPersonalInformation } from "./services/openai";
import { enhanceResponseWithWebData } from "./services/websearch";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {

  // Create a new chat session
  app.post("/api/chat/sessions", async (req, res) => {
    try {
      const sessionData = insertChatSessionSchema.parse(req.body);
      const session = await storage.createChatSession(sessionData);
      res.json(session);
    } catch (error) {
      res.status(400).json({ error: "Invalid session data" });
    }
  });

  // Get all chat sessions for a user
  app.get("/api/chat/sessions", async (req, res) => {
    try {
      const userId = (req.query.userId as string) || 'anonymous';

      const sessions = await storage.getUserChatSessions(userId);
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  // Get a specific chat session
  app.get("/api/chat/sessions/:id", async (req, res) => {
    try {
      const session = await storage.getChatSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch session" });
    }
  });

  // Delete a chat session
  app.delete("/api/chat/sessions/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteChatSession(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete session" });
    }
  });

  // Get messages for a chat session
  app.get("/api/chat/sessions/:id/messages", async (req, res) => {
    try {
      const messages = await storage.getSessionMessages(req.params.id);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Stream a message and get AI response via SSE
  app.post("/api/chat/sessions/:id/messages/stream", async (req, res) => {
    try {
      const sessionId = req.params.id;
      const messageSchema = z.object({
        content: z.string().min(1),
        role: z.literal("user"),
        userLocation: z.object({
          lat: z.number(),
          lon: z.number()
        }).optional()
      });

      const { content, role, userLocation } = messageSchema.parse(req.body);

      // Set up SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Cache-Control, Content-Type');
      res.setHeader('X-Accel-Buffering', 'no');

      // Send initial connection confirmation
      res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

      let responseComplete = false;

      // Handle client disconnect
      req.on('close', () => {
        responseComplete = true;
        console.log('Client disconnected from stream');
      });

      // Filter personal information from user message
      const filteredContent = await filterPersonalInformation(content);

      // Save user message
      const userMessage = await storage.createChatMessage({
        sessionId,
        role,
        content: filteredContent,
        metadata: { originalLength: content.length }
      });

      // Send user message immediately
      if (!responseComplete) {
        res.write(`data: ${JSON.stringify({
          type: 'userMessage',
          message: userMessage
        })}\n\n`);
      }

      // Get conversation history for context
      const messages = await storage.getSessionMessages(sessionId);
      const conversationHistory = messages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Get user's IP address for location-based real-time data
      const userIP = req.ip || req.socket?.remoteAddress ||
                     req.connection?.remoteAddress || '127.0.0.1';

      // Generate AI response with streaming
      let fullAiResponse = '';
      const aiMessageId = `temp_${Date.now()}`;

      try {
        fullAiResponse = await generateSarcasticResponseStream(
          filteredContent,
          conversationHistory,
          userIP,
          userLocation,
          (chunk: string) => {
            if (responseComplete) return;
            
            try {
              res.write(`data: ${JSON.stringify({
                type: 'aiChunk',
                chunk,
                messageId: aiMessageId
              })}\n\n`);
            } catch (writeError) {
              console.error('Error writing SSE chunk:', writeError);
              responseComplete = true;
            }
          }
        );

        if (responseComplete) return;

        // Enhance with web data if needed
        const enhancedResponse = await enhanceResponseWithWebData(filteredContent, fullAiResponse);

        // If enhanced, send the additional content
        if (enhancedResponse !== fullAiResponse && !responseComplete) {
          const additionalContent = enhancedResponse.replace(fullAiResponse, '');
          res.write(`data: ${JSON.stringify({
            type: 'aiChunk',
            chunk: additionalContent,
            messageId: aiMessageId
          })}\n\n`);
          fullAiResponse = enhancedResponse;
        }

        // Save AI message to database
        const aiMessage = await storage.createChatMessage({
          sessionId,
          role: "assistant",
          content: fullAiResponse,
          metadata: {
            userMessageId: userMessage.id,
            enhanced: fullAiResponse.includes("*Real-time info"),
            streamed: true
          }
        });

        // Send final message with database ID
        if (!responseComplete) {
          res.write(`data: ${JSON.stringify({
            type: 'aiComplete',
            message: aiMessage,
            tempId: aiMessageId
          })}\n\n`);
        }

        // Update session timestamp
        await storage.updateChatSession(sessionId, {});

        responseComplete = true;
        res.end();

      } catch (error) {
        console.error('Error in streaming:', error);

        if (!responseComplete) {
          // Create error message in database
          const errorMessage = await storage.createChatMessage({
            sessionId,
            role: "assistant",
            content: "Oops! My circuits are having a moment. Even I can't fix that mess right now. Try again, genius! 🤖💥",
            metadata: { error: true, userMessageId: userMessage.id }
          });

          res.write(`data: ${JSON.stringify({
            type: 'aiComplete',
            message: errorMessage,
            tempId: aiMessageId
          })}\n\n`);

          responseComplete = true;
          res.end();
        }
      }
    } catch (error) {
      console.error("Stream chat error:", error);

      try {
        if (!res.headersSent) {
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');
        }
        
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: 'Failed to process streaming message'
        })}\n\n`);
        res.end();
      } catch (writeError) {
        console.error("Failed to write error response:", writeError);
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to process streaming message" });
        }
      }
    }
  });

  // Send a message and get AI response
  app.post("/api/chat/sessions/:id/messages", async (req, res) => {
    try {
      const sessionId = req.params.id;
      const messageSchema = z.object({
        content: z.string().min(1),
        role: z.literal("user"),
        userLocation: z.object({
          lat: z.number(),
          lon: z.number()
        }).optional()
      });

      const { content, role, userLocation } = messageSchema.parse(req.body);

      // Filter personal information from user message
      const filteredContent = await filterPersonalInformation(content);

      // Save user message
      const userMessage = await storage.createChatMessage({
        sessionId,
        role,
        content: filteredContent,
        metadata: { originalLength: content.length }
      });

      // Get conversation history for context
      const messages = await storage.getSessionMessages(sessionId);
      const conversationHistory = messages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Get user's IP address for location-based real-time data
      const userIP = req.ip || req.socket?.remoteAddress ||
                     req.connection?.remoteAddress || '127.0.0.1';

      // Generate AI response with real-time data
      let aiResponse = await generateSarcasticResponse(filteredContent, conversationHistory, userIP, userLocation);

      // Enhance with web data if needed
      aiResponse = await enhanceResponseWithWebData(filteredContent, aiResponse);

      // Save AI message
      const aiMessage = await storage.createChatMessage({
        sessionId,
        role: "assistant",
        content: aiResponse,
        metadata: {
          userMessageId: userMessage.id,
          enhanced: aiResponse.includes("*Real-time info")
        }
      });

      // Update session timestamp
      await storage.updateChatSession(sessionId, {});

      res.json({
        userMessage,
        aiMessage
      });
    } catch (error) {
      console.error("Chat error:", error);

      // Generate a sarcastic error response
      const errorMessage = await storage.createChatMessage({
        sessionId: req.params.id,
        role: "assistant",
        content: "Oops! Even I can't fix that mess. My circuits are having a moment. Try again, genius. 🤖💥",
        metadata: { error: true }
      });

      res.status(500).json({
        error: "Failed to process message",
        aiMessage: errorMessage
      });
    }
  });

  // Regenerate last AI message
  app.post("/api/chat/sessions/:id/regenerate", async (req, res) => {
    try {
      const sessionId = req.params.id;
      const messages = await storage.getSessionMessages(sessionId);

      if (messages.length < 2) {
        return res.status(400).json({ error: "No message to regenerate" });
      }

      // Get the last user message
      const lastUserMessage = messages
        .filter(msg => msg.role === "user")
        .pop();

      if (!lastUserMessage) {
        return res.status(400).json({ error: "No user message found" });
      }

      // Get conversation history (excluding the last AI response)
      const conversationHistory = messages
        .slice(0, -1)
        .slice(-10)
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }));

      // Get user's IP address for location-based real-time data
      const userIP = req.ip || req.socket?.remoteAddress ||
                     req.connection?.remoteAddress || '127.0.0.1';

      // Generate new AI response with real-time data (no user location for regeneration)
      let aiResponse = await generateSarcasticResponse(lastUserMessage.content, conversationHistory, userIP);
      aiResponse = await enhanceResponseWithWebData(lastUserMessage.content, aiResponse);

      // Save new AI message
      const aiMessage = await storage.createChatMessage({
        sessionId,
        role: "assistant",
        content: aiResponse,
        metadata: {
          regenerated: true,
          originalMessageId: lastUserMessage.id
        }
      });

      res.json(aiMessage);
    } catch (error) {
      console.error("Regenerate error:", error);
      res.status(500).json({ error: "Failed to regenerate message" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}