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
        }).optional().nullable(),
        imageUrl: z.string().optional() // Add imageUrl to the schema
      });

      const { content, role, userLocation, imageUrl } = messageSchema.parse(req.body);

      let processedContent = content;
      let aiMessageContent = '';

      // Handle image generation requests
      if (content.startsWith('[IMAGE_GENERATION]')) {
        const prompt = content.replace('[IMAGE_GENERATION]', '').trim();

        try {
          console.log(`Starting working image generation for: "${prompt}"`);
          const imageUrl = await generateImage(prompt);
          console.log('Image generation successful with working APIs');

          // Create user message
          const userMessage = await storage.createChatMessage({
            sessionId,
            role: "user",
            content: `Generate an image: ${prompt}`,
          });

          // Create AI message with generated image
          if (imageUrl.includes('unsplash.com')) {
            aiMessageContent = `Here's a stunning photo for "${prompt}"! 📸\n\n![Generated Image](${imageUrl})\n\nFound this gorgeous real photograph that captures your vision perfectly. Sometimes reality beats AI, right? 😏✨`;
          } else if (imageUrl.includes('svg')) {
            aiMessageContent = `Here's your custom "${prompt}" masterpiece! 🎨\n\n![Generated Image](${imageUrl})\n\nCreated this special artwork just for you using advanced vector graphics. It's got that premium hand-crafted feel! 😎✨`;
          } else if (imageUrl.includes('pollinations')) {
            aiMessageContent = `Here's your AI-generated "${prompt}"! 🎨\n\n![Generated Image](${imageUrl})\n\nGenerated using cutting-edge free AI technology. This is what happens when you have the right connections! 😏🔥`;
          } else {
            aiMessageContent = `Here's your "${prompt}" image! 🎨\n\n![Generated Image](${imageUrl})\n\nGenerated using completely free AI services - no subscription needed! Quality art without breaking the bank! 💪✨`;
          }

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
          console.error("All image generation methods failed:", error);

          // Create fallback response with working alternatives
          aiMessageContent = `Hmm, my image generators are being stubborn today! 😅 But don't worry, I've got backup plans:

🎨 **Try these FREE working alternatives:**
1. **Pollinations.ai** - Paste your prompt directly: "${prompt}"
2. **Craiyon.com** - Completely free, no signup needed
3. **Leonardo.ai** - Free tier with amazing quality
4. **Bing Image Creator** - Free with Microsoft account

**Optimized prompt for you:**
"${prompt}, high quality, detailed, vibrant colors, professional photography style, 4K resolution"

These services are working right now and will give you amazing results! Want me to optimize your prompt even further? 🚀`;

          // Create user message
          const userMessage = await storage.createChatMessage({
            sessionId,
            role: "user",
            content: `Generate an image: ${prompt}`,
          });

          // Create AI message with alternatives
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
          console.log('Starting image analysis...');
          const analysis = await analyzeImage(imageUrl);
          console.log('Image analysis completed');
          const formattedAnalysis = formatImageAnalysisForAI(analysis, content);
          processedContent = `${formattedAnalysis}`;
        } catch (error) {
          console.error("Image analysis failed:", error);
          processedContent = `I can see you uploaded an image, but my vision circuits are having a moment! 👀 Could you describe what's in the image? I'd love to help analyze it with my wit intact! Original message: ${content}`;
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

      // Create user message with image context and store image data
      const userMessage = await storage.createChatMessage({
        sessionId,
        role: "user",
        content: content || "Image uploaded",
        metadata: { 
          imageUrl: imageBase64,
          imageAnalysis: imageAnalysis
        }
      });

      // Generate AI response with image context
      const contextualPrompt = formatImageAnalysisForAI(imageAnalysis, content || "");

      // Get conversation history for context
      const sessionMessages = await storage.getSessionMessages(sessionId);
      const conversationHistory = sessionMessages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Get user's IP address for location-based real-time data
      const userIP = req.ip || req.socket?.remoteAddress ||
                     req.connection?.remoteAddress || '127.0.0.1';

      let aiResponse = '';
      try {
        aiResponse = await generateSarcasticResponse(contextualPrompt, conversationHistory, userIP, userLocation ? JSON.parse(userLocation) : undefined);
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
      const allMessages = await storage.getSessionMessages(sessionId);
      if (allMessages.length <= 2) {
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