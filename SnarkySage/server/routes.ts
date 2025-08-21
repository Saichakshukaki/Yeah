import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertChatSessionSchema, insertChatMessageSchema } from "@shared/schema";
import { generateSarcasticResponse, filterPersonalInformation } from "./services/openai";
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

  // Generate title from message content
  const generateTitleFromMessage = (message: string): string => {
    // Clean and truncate the message
    const cleaned = message.trim().replace(/[^\w\s]/g, '').substring(0, 50);
    
    // If too short, return a default
    if (cleaned.length < 10) {
      return "Quick Chat";
    }
    
    // Capitalize first letter and add ellipsis if truncated
    const title = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    return cleaned.length >= 50 ? title + "..." : title;
  };

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

      // Check if this is the first message in the session and update title
      const existingMessages = await storage.getSessionMessages(sessionId);
      if (existingMessages.length <= 1) {
        const newTitle = generateTitleFromMessage(filteredContent);
        await storage.updateChatSession(sessionId, { title: newTitle });
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