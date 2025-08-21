import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertChatSessionSchema, insertChatMessageSchema } from "@shared/schema";
import { generateSarcasticResponse, generateSarcasticResponseStream, filterPersonalInformation } from "./services/openai";
import { enhanceResponseWithWebData } from "./services/websearch";
import { analyzeImage, generateImage, formatImageAnalysisForAI } from "./services/vision";
import multer from "multer";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {

  // Trust proxy to get real IP addresses
  app.set('trust proxy', true);

  // Configure multer for file uploads
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed!'), false);
      }
    },
  });

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
        }).optional(),
        imageUrl: z.string().optional() // Add imageUrl to the schema
      });

      const { content, role, userLocation, imageUrl } = messageSchema.parse(req.body);

      let processedContent = content;
      let aiMessageContent = '';

      // Handle image generation requests
      if (content.startsWith('[IMAGE_GENERATION]')) {
        const prompt = content.replace('[IMAGE_GENERATION]', '').trim();

        try {
          const imageUrl = await generateImage(prompt);

          // Create user message
          const userMessage = await storage.createChatMessage({
            sessionId,
            role: "user",
            content: `Generate an image: ${prompt}`,
          });

          // Create AI message with generated image
          aiMessageContent = `Here's your generated image for "${prompt}":\n\n![Generated Image](${imageUrl})`;
          const aiMessage = await storage.createChatMessage({
            sessionId,
            role: "assistant",
            content: aiMessageContent,
          });

          // Update session title if this is the first exchange
          const messages = await storage.getSessionMessages(sessionId);
          if (messages.length <= 2) {
            const title = generateTitleFromMessage(prompt);
            await storage.updateChatSession(sessionId, { title });
          }

          return res.json({ userMessage, aiMessage });
        } catch (error) {
          console.error("Image generation failed:", error);
          aiMessageContent = "Sorry, my artistic talents are offline right now! Even Picasso had bad days. 🎨 Try again in a moment.";

          // Create user message
          const userMessage = await storage.createChatMessage({
            sessionId,
            role: "user",
            content: `Generate an image: ${prompt}`,
          });

          // Create AI message with error
          const aiMessage = await storage.createChatMessage({
            sessionId,
            role: "assistant",
            content: aiMessageContent,
          });

          return res.json({ userMessage, aiMessage });
        }
      }

      if (imageUrl) {
        try {
          const analysis = await analyzeImage(imageUrl);
          const formattedAnalysis = formatImageAnalysisForAI(analysis);
          processedContent = `Image analysis: ${formattedAnalysis}\n\nOriginal prompt: ${content}`;
        } catch (error) {
          console.error("Image analysis failed:", error);
          processedContent = `Error analyzing image. Please try again. Original prompt: ${content}`;
        }
      }

      // Filter personal information from user message
      const filteredContent = await filterPersonalInformation(processedContent);

      // Save user message
      const userMessage = await storage.createChatMessage({
        sessionId,
        role,
        content: filteredContent,
        metadata: { originalLength: content.length, imageUrl: imageUrl }
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

  // Route to handle image uploads for analysis
  app.post("/api/chat/upload-image", upload.single('image'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded.' });
    }

    try {
      const imageBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      const analysis = await analyzeImage(imageBase64);
      const formattedAnalysis = formatImageAnalysisForAI(analysis, '');
      res.json({ analysis: formattedAnalysis });
    } catch (error) {
      console.error("Image upload and analysis failed:", error);
      res.status(500).json({ error: 'Failed to analyze image.' });
    }
  });

  // Route to handle image generation
  app.post("/api/generate-image", async (req, res) => {
    try {
      const { prompt } = z.object({ prompt: z.string().min(1) }).parse(req.body);

      const imageUrl = await generateImage(prompt);
      res.json({ imageUrl });
    } catch (error) {
      console.error("Image generation failed:", error);
      res.status(500).json({ error: 'Failed to generate image.' });
    }
  });

  // Route to handle messages with images
  app.post("/api/chat/sessions/:id/messages-with-image", upload.single('image'), async (req, res) => {
    try {
      const sessionId = req.params.id;
      const { content, role, userLocation } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: 'No image file uploaded.' });
      }

      // Analyze the uploaded image
      const imageBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      let imageAnalysis = '';

      try {
        imageAnalysis = await analyzeImage(imageBase64);
      } catch (error) {
        console.error("Image analysis failed:", error);
        imageAnalysis = "I can see an image, but I'm having trouble analyzing it right now.";
      }

      // Create user message with image context
      const userMessage = await storage.createChatMessage({
        sessionId,
        role: "user",
        content: `${content}\n\n[Image uploaded: ${imageAnalysis}]`,
      });

      // Generate AI response with image context
      const contextualPrompt = formatImageAnalysisForAI(imageAnalysis, content);

      let aiResponse = '';
      try {
        aiResponse = await generateSarcasticResponse(contextualPrompt, userLocation);
      } catch (error) {
        console.error("AI response generation failed:", error);
        aiResponse = "Well, I saw your image but my brain circuits are having a moment. That's embarrassing! 😅";
      }

      const aiMessage = await storage.createChatMessage({
        sessionId,
        role: "assistant", 
        content: aiResponse,
      });

      // Update session title if this is the first message
      const messages = await storage.getSessionMessages(sessionId);
      if (messages.length <= 2) {
        const title = generateTitleFromMessage(content);
        await storage.updateChatSession(sessionId, { title });
      }

      res.json({ userMessage, aiMessage });
    } catch (error) {
      console.error("Message with image failed:", error);
      res.status(500).json({ error: 'Failed to process message with image.' });
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