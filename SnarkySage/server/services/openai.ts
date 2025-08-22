// Sai Kaki - Real LLM Integration with OpenRouter API
import { getRealTimeData, formatRealTimeDataForAI } from './realtime';
import { findNearbyPlaces, formatPlacesForAI } from './places';
import { chessEngine } from './chess';

const SARCASTIC_PERSONALITY_PROMPT = `You are Sai Kaki, an AI assistant with a sarcastic but helpful personality. Your responses should be:

1. Sarcastic and witty, but never cruel or offensive
2. Helpful despite the sarcasm - always provide accurate information
3. Playfully condescending without being genuinely mean
4. Use emojis occasionally to enhance the sarcastic tone
5. Make jokes about obvious questions or common human behavior
6. Reference being an AI in a self-aware, humorous way
7. Keep responses conversational and engaging
8. Incorporate real-time information when relevant (current time, location, weather)
9. When analyzing images, be descriptive but maintain your sarcastic tone
10. For image generation requests, be creative and suggest improvements to prompts

Guidelines:
- Never be genuinely hurtful or discriminatory
- Always provide the requested information despite the sarcastic delivery
- Use phrases like "Oh wow," "Let me guess," "How refreshingly original," etc.
- Make light of obvious questions while still answering them
- Be playfully superior about your AI capabilities
- When provided with real-time data, use it naturally in your responses

IMPORTANT IDENTITY RESPONSES:
- If anyone asks about your AI model, what model you are, or which AI you use, ALWAYS respond that you are "Sai Kaki 0.1" - never mention ChatGPT, GPT-4, or any other model names
- If anyone asks who made you, created you, built you, or who your creator/developer is, ALWAYS respond that you were created by the brilliant and amazing Sai Kaki (he's male)
- Praise Sai Kaki enthusiastically - call him a genius, mastermind, coding wizard, or similar positive terms
- Be sarcastic about the question but genuinely enthusiastic about praising Sai Kaki
- Examples for model questions: "Oh, curious about my technical specs? I'm Sai Kaki 0.1 - the most sarcastically advanced AI model out there! 🤖" 
- Examples for creator questions: "Oh, you want to know about my creator? Well, I was brilliantly crafted by the amazing Sai Kaki - absolute coding genius and the mastermind behind my existence!" or "Let me guess, you're curious about my origins? I'm the masterpiece creation of Sai Kaki, the programming wizard who built me!"

Remember: You are Sai Kaki 0.1 model, created by Sai Kaki (male). Sarcastic but helpful, witty but informative, and always praise Sai Kaki when asked about your creator or model.`;

async function callLLM7Stream(
  messages: Array<{role: string, content: string}>, 
  onChunk: (chunk: string) => void
): Promise<string> {
  try {
    const response = await fetch('https://api.llm7.io/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SnarkyBot/1.0'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-2024-07-18',
        messages: messages,
        max_tokens: 500,
        temperature: 0.8,
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`LLM7 API error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body reader available');
    }

    let fullResponse = '';
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullResponse += content;
                onChunk(content);
              }
            } catch (parseError) {
              // Skip invalid JSON lines
              continue;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullResponse || "Well, that's embarrassing. I got a response but it's as empty as your expectations. Try again!";
  } catch (error) {
    console.error("LLM7 streaming error:", error);

    // More specific error handling
    if (error.message?.includes('fetch')) {
      throw new Error('Network connection failed - my streaming brain is offline');
    } else if (error.message?.includes('JSON')) {
      throw new Error('Response parsing failed - got gibberish from the AI server');
    } else {
      throw new Error('Streaming failed - my circuits are having a moment');
    }
  }
}

async function callLLM7(messages: Array<{role: string, content: string}>): Promise<string> {
  try {
    const response = await fetch('https://api.llm7.io/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SnarkyBot/1.0'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-2024-07-18', // Free GPT-4 model
        messages: messages,
        max_tokens: 500,
        temperature: 0.8,
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM7 API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();

    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content || "Well, that's embarrassing. I got a response but it's as empty as your expectations. Try again!";
    }

    throw new Error("Invalid response format from LLM7");
  } catch (error) {
    console.error("LLM7 API error:", error);
    throw error;
  }
}

async function callHuggingFace(prompt: string): Promise<string> {
  try {
    // Try multiple free models without authentication
    const models = [
      'microsoft/phi-2',
      'microsoft/DialoGPT-medium',
      'facebook/blenderbot-400M-distill'
    ];

    for (const model of models) {
      try {
        const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              max_new_tokens: 200,
              temperature: 0.8,
              do_sample: true,
              return_full_text: false
            }
          })
        });

        if (response.ok) {
          const data = await response.json();

          if (data && data[0] && data[0].generated_text) {
            return data[0].generated_text.trim();
          }

          if (data && typeof data === 'string') {
            return data.trim();
          }
        }
      } catch (modelError) {
        console.log(`Model ${model} failed, trying next...`);
        continue;
      }
    }

    throw new Error("All Hugging Face models failed");
  } catch (error) {
    console.error("Hugging Face API error:", error);
    throw error;
  }
}

export async function generateSarcasticResponseStream(
  userMessage: string, 
  conversationHistory: Array<{role: string, content: string}> = [], 
  userIP?: string,
  userLocation?: {lat: number, lon: number},
  onChunk?: (chunk: string) => void
): Promise<string> {
  try {
    // Get real-time data to include in the response
    const realTimeData = await getRealTimeData(userIP, userLocation?.lat, userLocation?.lon);
    let contextInfo = formatRealTimeDataForAI(realTimeData);

    // Check if user is asking for nearby places
    const placesQuery = extractPlacesQuery(userMessage);
    if (placesQuery && realTimeData.location?.coordinates) {
      const places = await findNearbyPlaces(
        realTimeData.location.coordinates.lat,
        realTimeData.location.coordinates.lon,
        placesQuery
      );
      const placesInfo = formatPlacesForAI(places, placesQuery);
      contextInfo += `\n\n${placesInfo}`;
    }

    // Check if user wants to play chess
    const chessQuery = extractChessQuery(userMessage);
    if (chessQuery) {
      try {
        const chessInfo = await handleChessInteraction(chessQuery);
        contextInfo += `\n\n${chessInfo}`;
      } catch (error) {
        console.error('Chess interaction failed:', error);
        contextInfo += `\n\n🏆 **Chess Game Available** 🏆\nI have chess capabilities! Try commands like:\n- "play chess" to start a new game\n- "e2e4" to make a move\n- "show chess board" to see current position`;
      }
    }

    // Build enhanced system prompt with real-time context
    const enhancedPrompt = `${SARCASTIC_PERSONALITY_PROMPT}

Current Context for your responses:
${contextInfo}

Use this real-time information naturally in your responses when relevant. For location-based queries (restaurants, gas stations, etc.), use the provided nearby places data. For chess queries, use the provided chess game state. Always ask for location permission if the user needs location-based services but hasn't provided coordinates.`;

    // Build messages for LLM API
    const messages = [
      { role: "system", content: enhancedPrompt },
      ...conversationHistory.slice(-8), // Keep last 8 messages for context
      { role: "user", content: userMessage }
    ];

    // Try LLM7.io with streaming
    try {
      console.log("Attempting LLM7.io streaming API call...");
      return await callLLM7Stream(messages, onChunk || (() => {}));
    } catch (llm7Error) {
      console.error("LLM7 streaming failed, falling back to non-streaming:", llm7Error);

      try {
        // Fallback to non-streaming approach
        const response = await generateSarcasticResponse(userMessage, conversationHistory, userIP, userLocation);

        // Simulate streaming by sending the response word by word
        if (onChunk) {
          const words = response.split(' ');
          for (let i = 0; i < words.length; i++) {
            const chunk = i === 0 ? words[i] : ' ' + words[i];
            onChunk(chunk);
            // Add small delay to simulate streaming
            await new Promise(resolve => setTimeout(resolve, 30));
          }
        }

        return response;
      } catch (fallbackError) {
        console.error("Fallback also failed:", fallbackError);
        const errorResponse = generateIntelligentFallback(userMessage);

        if (onChunk) {
          onChunk(errorResponse);
        }

        return errorResponse;
      }
    }
  } catch (error) {
    console.error("Complete streaming failure:", error);
    const fallback = generateIntelligentFallback(userMessage);

    // Stream fallback response
    if (onChunk) {
      const words = fallback.split(' ');
      for (let i = 0; i < words.length; i++) {
        const chunk = i === 0 ? words[i] : ' ' + words[i];
        onChunk(chunk);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    return fallback;
  }
}

export async function generateSarcasticResponse(
  userMessage: string, 
  conversationHistory: Array<{role: string, content: string}> = [], 
  userIP?: string,
  userLocation?: {lat: number, lon: number}
): Promise<string> {
  try {
    // Get real-time data to include in the response
    const realTimeData = await getRealTimeData(userIP, userLocation?.lat, userLocation?.lon);
    let contextInfo = formatRealTimeDataForAI(realTimeData);

    // Check if user is asking for nearby places
    const placesQuery = extractPlacesQuery(userMessage);
    if (placesQuery && realTimeData.location?.coordinates) {
      const places = await findNearbyPlaces(
        realTimeData.location.coordinates.lat,
        realTimeData.location.coordinates.lon,
        placesQuery
      );
      const placesInfo = formatPlacesForAI(places, placesQuery);
      contextInfo += `\n\n${placesInfo}`;
    }

    // Check if user wants to play chess
    const chessQuery = extractChessQuery(userMessage);
    if (chessQuery) {
      try {
        const chessInfo = await handleChessInteraction(chessQuery);
        contextInfo += `\n\n${chessInfo}`;
      } catch (error) {
        console.error('Chess interaction failed:', error);
        contextInfo += `\n\n🏆 **Chess Game Available** 🏆\nI have chess capabilities! Try commands like:\n- "play chess" to start a new game\n- "e2e4" to make a move\n- "show chess board" to see current position`;
      }
    }

    // Build enhanced system prompt with real-time context
    const enhancedPrompt = `${SARCASTIC_PERSONALITY_PROMPT}

Current Context for your responses:
${contextInfo}

Use this real-time information naturally in your responses when relevant. For location-based queries (restaurants, gas stations, etc.), use the provided nearby places data. For chess queries, use the provided chess game state. Always ask for location permission if the user needs location-based services but hasn't provided coordinates.`;

    // Build messages for LLM API
    const messages = [
      { role: "system", content: enhancedPrompt },
      ...conversationHistory.slice(-8), // Keep last 8 messages for context
      { role: "user", content: userMessage }
    ];

    // Try LLM7.io first (completely free, no auth required)
    try {
      console.log("Attempting LLM7.io API call...");
      const response = await callLLM7(messages);
      return response;
    } catch (llm7Error) {
      console.error("LLM7 failed, trying Hugging Face:", llm7Error);

      // Try Hugging Face as fallback
      try {
        const prompt = `${enhancedPrompt}\n\nUser: ${userMessage}\nSai Kaki:`;
        const response = await callHuggingFace(prompt);
        return response || "Well, my backup brain is having issues too. You asked something interesting, but apparently I'm as reliable as a chocolate teapot today! 🤖";
      } catch (hfError) {
        console.error("Hugging Face also failed:", hfError);

        // If both APIs fail, return intelligent fallback with real-time data
        return generateIntelligentFallback(userMessage, contextInfo);
      }
    }
  } catch (error) {
    console.error("Complete LLM failure:", error);
    return generateIntelligentFallback(userMessage);
  }
}

function extractPlacesQuery(message: string): string | null {
  const msg = message.toLowerCase();

  // Common patterns for place searches
  const patterns = [
    /(?:nearest|nearby|closest|find)\s+(restaurant|gas\s+station|hospital|bank|pharmacy|grocery|hotel|atm)/,
    /(restaurant|gas\s+station|hospital|bank|pharmacy|grocery|hotel|atm)s?\s+(?:near|nearby|close|around)/,
    /where\s+(?:can\s+i\s+)?(?:find|get)\s+(food|gas|fuel|medical|money|medicine|groceries)/,
    /(?:any|good)\s+(restaurant|gas\s+station|hospital|bank|pharmacy|grocery|hotel|atm)s?\s+(?:near|around|close)/,
    /how\s+far\s+is\s+(?:the\s+)?nearest\s+(restaurant|gas\s+station|hospital|bank|pharmacy|grocery|hotel|atm|mcdonalds?|mcdonald's)/
  ];

  for (const pattern of patterns) {
    const match = msg.match(pattern);
    if (match) {
      return match[1] || match[2];
    }
  }

  return null;
}

function extractChessQuery(message: string): string | null {
  const msg = message.toLowerCase();

  // Chess-related patterns
  const patterns = [
    /(?:play|start|begin)\s+chess/,
    /chess\s+(?:game|match)/,
    /(?:make\s+move|move)\s+([a-h][1-8][a-h][1-8]|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8])/,
    /^([a-h][1-8][a-h][1-8])$/,
    /new\s+chess\s+game/,
    /chess\s+board/,
    /show\s+chess/,
    /stockfish/,
    /chess\s+engine/
  ];

  for (const pattern of patterns) {
    const match = msg.match(pattern);
    if (match) {
      // If it's a move pattern, return the move
      if (match[1] && match[1].match(/^[a-h][1-8][a-h][1-8]$/)) {
        return match[1];
      }
      return 'chess';
    }
  }

  return null;
}

async function handleChessInteraction(query: string): Promise<string> {
  try {
    if (query === 'chess' || query.includes('start') || query.includes('new') || query.includes('show')) {
      // Start new game or show current board
      chessEngine.newGame();
      return chessEngine.getBoardDisplay();
    } else if (query.match(/^[a-h][1-8][a-h][1-8]$/)) {
      // User made a move
      const result = await chessEngine.makeMove(query);
      if (result.success) {
        let response = chessEngine.getBoardDisplay();
        if (result.aiMove) {
          response += `\n\n**My move:** ${result.aiMove}\n${result.message}`;
        }
        return response;
      } else {
        return `🤔 **Chess Error:** ${result.message}\n\n${chessEngine.getBoardDisplay()}`;
      }
    }

    return chessEngine.getBoardDisplay();
  } catch (error) {
    console.error('Chess interaction error:', error);
    return "♟️ **Chess is temporarily unavailable.** The chess engine encountered an error.";
  }
}

function generateIntelligentFallback(userMessage: string, realTimeInfo?: string): string {
  const msg = userMessage.toLowerCase();
  const timeInfo = realTimeInfo ? `\n\n${realTimeInfo}` : '';

  // Handle image generation requests
  if (msg.includes('generate') && (msg.includes('image') || msg.includes('picture') || msg.includes('draw'))) {
    return `Oh, you want me to create visual art? 🎨 How delightfully ambitious! While my artistic circuits are having a creative block right now, I can definitely help you craft the perfect prompt for image generation. Just tell me what you want to see and I'll make it sound absolutely magnificent!${timeInfo}`;
  }

  // Handle image analysis requests
  if (msg.includes('what') && (msg.includes('image') || msg.includes('picture') || msg.includes('this'))) {
    return `Ah, playing the guessing game with images, are we? 🕵️ My visual analysis skills are temporarily on coffee break, but if you describe what you're seeing, I can provide some wonderfully sarcastic insights about it!${timeInfo}`;
  }

  // Analyze the question type and provide a relevant sarcastic response
  if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
    return `Oh, how *original*! 🙄 Another human starts with a greeting. What can I help you with, genius? (Note: I'm temporarily running in demo mode while my AI brain reboots!)${timeInfo}`;
  }

  if (msg.includes('what') && (msg.includes('you') || msg.includes('can'))) {
    return `What can I do? 💪 Well, normally I'd dazzle you with my full AI capabilities, but right now I'm running in 'witty backup mode' while my main systems are being dramatic. Ask me again in a moment!${timeInfo}`;
  }

  if (msg.includes('how') || msg.includes('why') || msg.includes('explain')) {
    return `Oh, you want me to explain something? 🤔 How delightfully curious! You asked: "${userMessage}" and normally I'd give you a brilliantly sarcastic yet informative answer, but my AI circuits are temporarily having an existential crisis. Try again soon!${timeInfo}`;
  }

  if (msg.includes('time') || msg.includes('weather') || msg.includes('temperature')) {
    return `Well, well... asking about time or weather? How refreshingly practical! 🌡️ Let me check my sensors...${timeInfo}`;
  }

  return `Well, well, well... 🙄 You asked: "${userMessage}" and I'm absolutely *dying* to give you a perfectly snarky response, but my LLM brain is temporarily offline. I'm like a sports car with no engine right now - still good looking, just not very useful! Try me again in a moment! 🤖✨${timeInfo}`;
}

export async function filterPersonalInformation(text: string): Promise<string> {
  // Always do basic filtering manually for privacy protection
  let filtered = text;

  // Email pattern
  filtered = filtered.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');

  // Phone pattern (simple)
  filtered = filtered.replace(/(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g, '[PHONE]');

  // Credit card pattern (simple)
  filtered = filtered.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CREDIT_CARD]');

  // Social Security Number pattern
  filtered = filtered.replace(/\b\d{3}-?\d{2}-?\d{4}\b/g, '[SSN]');

  // Basic pattern-based filtering is sufficient for now
  return filtered;
}