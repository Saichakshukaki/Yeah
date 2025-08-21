
import fetch from 'node-fetch';

// Free image recognition using Hugging Face Inference API
async function analyzeImageWithHuggingFace(imageBase64: string): Promise<string> {
  try {
    // Convert base64 to buffer
    const imageBuffer = Buffer.from(imageBase64.split(',')[1], 'base64');
    
    const models = [
      'nlpconnect/vit-gpt2-image-captioning',
      'Salesforce/blip-image-captioning-base',
      'microsoft/git-base-coco'
    ];

    for (const model of models) {
      try {
        const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: imageBase64,
            parameters: {
              max_new_tokens: 100
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          
          if (Array.isArray(data) && data[0]?.generated_text) {
            return data[0].generated_text;
          }
          
          if (data?.caption) {
            return data.caption;
          }
          
          if (typeof data === 'string') {
            return data;
          }
        }
      } catch (modelError) {
        console.log(`Model ${model} failed, trying next...`);
        continue;
      }
    }
    
    throw new Error("All vision models failed");
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
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&nologo=true`;
    
    const response = await fetch(imageUrl);
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
  try {
    // Try Pollinations first (more reliable and free)
    try {
      return await generateImageWithPollinations(prompt);
    } catch (pollinationsError) {
      console.log("Pollinations failed, trying Hugging Face...");
      return await generateImageWithHuggingFace(prompt);
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
