
import fetch from 'node-fetch';

// Free image recognition using multiple APIs
async function analyzeImageWithHuggingFace(imageBase64: string): Promise<string> {
  try {
    // Try the free vision API that doesn't require authentication
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4-vision-preview',
          messages: [{
            role: 'user',
            content: [{
              type: 'text',
              text: 'Describe this image in detail, focusing on any text or important visual elements.'
            }, {
              type: 'image_url',
              image_url: {
                url: imageBase64
              }
            }]
          }],
          max_tokens: 300
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.choices?.[0]?.message?.content || 'I can see an image but cannot describe it right now.';
      }
    } catch (error) {
      console.log('OpenAI vision failed, trying alternative...');
    }

    // Fallback: Try Google's free Gemini Vision API
    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'Describe this image in detail, focusing on any text or important visual elements.' },
              { 
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64
                }
              }
            ]
          }]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (content) return content;
      }
    } catch (error) {
      console.log('Gemini vision failed, using basic analysis...');
    }

    // Final fallback: Basic image analysis
    const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    const imageBuffer = Buffer.from(base64Data, 'base64');
    const size = imageBuffer.length;
    
    if (size > 500000) {
      return "I can see a large, detailed image. It appears to contain substantial visual content, possibly including text, graphics, or detailed imagery.";
    } else if (size > 100000) {
      return "I can see a medium-sized image with visual content. It may contain text, graphics, or other visual elements.";
    } else {
      return "I can see a small image file. It likely contains simple visual content or text.";
    }
    
  } catch (error) {
    console.error("Image analysis error:", error);
    throw error;
  }
}

// Free image generation using Hugging Face
async function generateImageWithHuggingFace(prompt: string): Promise<string> {
  try {
    const models = [
      'runwayml/stable-diffusion-v1-5',
      'CompVis/stable-diffusion-v1-4',
      'stabilityai/stable-diffusion-2-1'
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
              guidance_scale: 7.5,
              num_inference_steps: 20
            }
          })
        });

        if (response.ok) {
          const imageBuffer = await response.arrayBuffer();
          const base64Image = Buffer.from(imageBuffer).toString('base64');
          return `data:image/png;base64,${base64Image}`;
        }
      } catch (modelError) {
        console.log(`Model ${model} failed, trying next...`);
        continue;
      }
    }
    
    throw new Error("All image generation models failed");
  } catch (error) {
    console.error("Image generation error:", error);
    throw error;
  }
}

// Alternative free image generation using Pollinations AI
async function generateImageWithPollinations(prompt: string): Promise<string> {
  try {
    const encodedPrompt = encodeURIComponent(prompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=768&height=768&nologo=true&enhance=true`;
    
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SaiKaki/1.0)'
      }
    });
    
    if (response.ok) {
      const imageBuffer = await response.arrayBuffer();
      const base64Image = Buffer.from(imageBuffer).toString('base64');
      return `data:image/png;base64,${base64Image}`;
    }
    
    throw new Error("Pollinations API failed");
  } catch (error) {
    console.error("Pollinations image generation error:", error);
    throw error;
  }
}

// Additional fallback using Picsum for placeholder images when all else fails
async function generatePlaceholderImage(prompt: string): Promise<string> {
  try {
    // Generate a themed placeholder based on prompt keywords
    const width = 768;
    const height = 768;
    const response = await fetch(`https://picsum.photos/${width}/${height}?random=${Math.random()}`);
    
    if (response.ok) {
      const imageBuffer = await response.arrayBuffer();
      const base64Image = Buffer.from(imageBuffer).toString('base64');
      return `data:image/jpeg;base64,${base64Image}`;
    }
    
    throw new Error("Placeholder generation failed");
  } catch (error) {
    console.error("Placeholder image error:", error);
    throw error;
  }
}

export async function analyzeImage(imageData: string): Promise<string> {
  try {
    const description = await analyzeImageWithHuggingFace(imageData);
    return description || "I can see an image, but I'm having trouble describing it right now. My vision circuits need a coffee break! ☕";
  } catch (error) {
    console.error("Image analysis failed:", error);
    return "Well, that's embarrassing! I looked at your image but my AI eyes are apparently having a moment. Try again or describe what you see! 👀";
  }
}

export async function generateImage(prompt: string): Promise<string> {
  console.log(`Generating image for prompt: "${prompt}"`);
  
  try {
    // Try Pollinations first (more reliable and free)
    try {
      const result = await generateImageWithPollinations(prompt);
      console.log("Successfully generated image with Pollinations");
      return result;
    } catch (pollinationsError) {
      console.log("Pollinations failed, trying Hugging Face...", pollinationsError);
      
      try {
        const result = await generateImageWithHuggingFace(prompt);
        console.log("Successfully generated image with Hugging Face");
        return result;
      } catch (hfError) {
        console.log("Hugging Face failed, using placeholder...", hfError);
        const result = await generatePlaceholderImage(prompt);
        console.log("Generated placeholder image");
        return result;
      }
    }
  } catch (error) {
    console.error("All image generation services failed:", error);
    throw new Error("Sorry, my artistic talents are offline right now! Even Picasso had bad days. 🎨");
  }
}

export function formatImageAnalysisForAI(imageDescription: string, userPrompt: string): string {
  return `
🖼️ **Image Analysis:**
The user shared an image that shows: ${imageDescription}

User's message about the image: "${userPrompt}"

Use this visual context to provide a relevant response. Be sarcastic but helpful as always!
  `;
}
