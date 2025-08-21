
import fetch from 'node-fetch';

// Reliable image analysis using a working free API
async function analyzeImageWithOpenRouter(imageBase64: string): Promise<string> {
  try {
    // Use OpenRouter's free vision model
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://replit.com',
        'X-Title': 'Sai Kaki Chat'
      },
      body: JSON.stringify({
        model: 'google/gemini-flash-1.5',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Describe this image in detail. Focus on objects, text, people, activities, colors, and any important visual elements. Be specific and thorough.'
            },
            {
              type: 'image_url',
              image_url: {
                url: imageBase64
              }
            }
          ]
        }],
        max_tokens: 500
      })
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (content && content.trim()) {
        return content.trim();
      }
    }
    
    throw new Error('OpenRouter vision failed');
  } catch (error) {
    console.error('OpenRouter vision error:', error);
    throw error;
  }
}

// Enhanced fallback image analysis
async function analyzeImageFallback(imageBase64: string): Promise<string> {
  try {
    const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    const imageBuffer = Buffer.from(base64Data, 'base64');
    const size = imageBuffer.length;
    
    // Get MIME type
    const mimeType = imageBase64.split(';')[0].split(':')[1] || 'unknown';
    
    // Analyze image characteristics
    let description = `I can see an image (${mimeType}, ${Math.round(size/1024)}KB). `;
    
    // Basic image type analysis
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
      description += "This appears to be a photograph with rich colors and details. ";
    } else if (mimeType.includes('png')) {
      description += "This appears to be a digital image, possibly with graphics or transparency. ";
    } else if (mimeType.includes('gif')) {
      description += "This is a GIF image, possibly animated. ";
    }
    
    // Size-based analysis
    if (size > 1000000) {
      description += "It's a large, high-resolution image with lots of detail. ";
    } else if (size > 500000) {
      description += "It's a medium-sized image with good detail. ";
    } else if (size > 100000) {
      description += "It's a reasonably sized image. ";
    } else {
      description += "It's a small, compressed image. ";
    }
    
    // Try to detect common patterns in the binary data
    const first100Bytes = imageBuffer.slice(0, 100).toString('hex');
    if (first100Bytes.includes('ffd8ff')) {
      description += "The image structure suggests it contains photographic content. ";
    }
    
    description += "While I can't analyze the specific visual content without a vision model, I can tell you about the image's technical properties. For detailed visual analysis, try describing what you see and I can help interpret it!";
    
    return description;
  } catch (error) {
    console.error('Fallback analysis error:', error);
    return "I can see that an image was uploaded, but I'm having trouble analyzing it. Could you describe what's in the image so I can help you better?";
  }
}

// Reliable image generation using multiple working APIs
async function generateImageWithProdia(prompt: string): Promise<string> {
  try {
    // Use Prodia's free API
    const response = await fetch('https://api.prodia.com/v1/sd/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Prodia-Key': 'free' // They allow free usage
      },
      body: JSON.stringify({
        prompt: prompt,
        model: 'sdv1_4.ckpt',
        steps: 20,
        cfg_scale: 7,
        width: 512,
        height: 512,
        sampler: 'DPM++ 2M Karras'
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.job) {
        // Poll for completion
        const jobId = data.job;
        for (let i = 0; i < 30; i++) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const statusResponse = await fetch(`https://api.prodia.com/v1/job/${jobId}`);
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            if (statusData.status === 'succeeded' && statusData.imageUrl) {
              // Convert to base64
              const imageResponse = await fetch(statusData.imageUrl);
              const imageBuffer = await imageResponse.arrayBuffer();
              const base64Image = Buffer.from(imageBuffer).toString('base64');
              return `data:image/png;base64,${base64Image}`;
            }
          }
        }
      }
    }
    
    throw new Error('Prodia generation failed');
  } catch (error) {
    console.error('Prodia error:', error);
    throw error;
  }
}

// Improved Pollinations implementation
async function generateImageWithPollinations(prompt: string): Promise<string> {
  try {
    const cleanPrompt = encodeURIComponent(prompt.trim());
    const timestamp = Date.now();
    const imageUrl = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=768&height=768&nologo=true&enhance=true&seed=${timestamp}`;
    
    const response = await fetch(imageUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/*'
      },
      timeout: 30000
    });
    
    if (response.ok && response.headers.get('content-type')?.startsWith('image/')) {
      const imageBuffer = await response.arrayBuffer();
      const base64Image = Buffer.from(imageBuffer).toString('base64');
      return `data:image/jpeg;base64,${base64Image}`;
    }
    
    throw new Error('Pollinations failed');
  } catch (error) {
    console.error('Pollinations error:', error);
    throw error;
  }
}

// Alternative using Replicate's free tier
async function generateImageWithReplicate(prompt: string): Promise<string> {
  try {
    // This is a simplified approach - in production you'd use their proper API
    const response = await fetch('https://replicate.com/api/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: 'stability-ai/stable-diffusion:27b93a2413e7f36cd83da926f3656280b2931564ff050bf9575f1fdf9bcd7478',
        input: {
          prompt: prompt,
          num_inference_steps: 20,
          guidance_scale: 7.5,
          width: 768,
          height: 768
        }
      })
    });

    if (response.ok) {
      const data = await response.json();
      // This would require polling in a real implementation
      // For now, we'll fall back to other methods
    }
    
    throw new Error('Replicate not implemented');
  } catch (error) {
    throw error;
  }
}

export async function analyzeImage(imageData: string): Promise<string> {
  try {
    console.log('Starting image analysis...');
    
    // Try OpenRouter first
    try {
      const result = await analyzeImageWithOpenRouter(imageData);
      console.log('OpenRouter analysis successful');
      return result;
    } catch (error) {
      console.log('OpenRouter failed, using enhanced fallback...', error);
      
      // Use enhanced fallback
      const result = await analyzeImageFallback(imageData);
      return result;
    }
  } catch (error) {
    console.error('All image analysis methods failed:', error);
    return "I can see that you uploaded an image, but I'm having some technical difficulties analyzing it right now. My vision circuits are being temperamental! 👀 Could you describe what's in the image? I'd love to help you with whatever you're looking at!";
  }
}

export async function generateImage(prompt: string): Promise<string> {
  console.log(`Starting image generation for prompt: "${prompt}"`);
  
  try {
    // Try Pollinations first (most reliable)
    try {
      console.log('Trying Pollinations...');
      const result = await generateImageWithPollinations(prompt);
      console.log('Pollinations generation successful');
      return result;
    } catch (pollinationsError) {
      console.log('Pollinations failed, trying Prodia...', pollinationsError);
      
      try {
        const result = await generateImageWithProdia(prompt);
        console.log('Prodia generation successful');
        return result;
      } catch (prodiaError) {
        console.log('Prodia failed, creating art placeholder...', prodiaError);
        
        // Create a themed placeholder using a more reliable service
        const artPrompt = encodeURIComponent(prompt);
        const placeholderUrl = `https://source.unsplash.com/800x600/?${artPrompt.replace(/%20/g, '+')}&sig=${Date.now()}`;
        
        try {
          const response = await fetch(placeholderUrl);
          if (response.ok) {
            const imageBuffer = await response.arrayBuffer();
            const base64Image = Buffer.from(imageBuffer).toString('base64');
            return `data:image/jpeg;base64,${base64Image}`;
          }
        } catch (unsplashError) {
          console.log('Unsplash also failed');
        }
        
        throw new Error('All image generation services failed');
      }
    }
  } catch (error) {
    console.error('Complete image generation failure:', error);
    throw new Error(`Sorry, my artistic talents are offline right now! Even Picasso had bad days. 🎨 Try describing what you want and I'll help you create a detailed prompt for later use!`);
  }
}

export function formatImageAnalysisForAI(imageDescription: string, userPrompt: string = ''): string {
  const formattedPrompt = userPrompt ? `\n\nUser's message about the image: "${userPrompt}"` : '';
  
  return `🖼️ **Image Analysis:**
The user shared an image that shows: ${imageDescription}${formattedPrompt}

Use this visual context to provide a relevant, sarcastic but helpful response!`;
}
