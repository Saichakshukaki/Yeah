import fetch from 'node-fetch';

// Free image analysis using Hugging Face Inference API (no key required)
async function analyzeImageWithHuggingFace(imageBase64: string): Promise<string> {
  try {
    // Extract base64 data
    const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

    // Use Hugging Face's free BLIP model for image captioning
    const response = await fetch('https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: base64Data,
        options: { wait_for_model: true }
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data[0] && data[0].generated_text) {
        return `I can see: ${data[0].generated_text}`;
      }
    }

    throw new Error('Hugging Face vision failed');
  } catch (error) {
    console.error('Hugging Face vision error:', error);
    throw error;
  }
}

// Alternative free vision using Replicate (no auth required for some models)
async function analyzeImageWithFreeVision(imageBase64: string): Promise<string> {
  try {
    // Use a different approach - try to analyze using a free OCR service
    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'base64Image': imageBase64,
        'apikey': 'helloworld', // Free tier API key
        'language': 'eng',
        'isOverlayRequired': 'false'
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.ParsedResults && data.ParsedResults[0] && data.ParsedResults[0].ParsedText) {
        const text = data.ParsedResults[0].ParsedText.trim();
        if (text) {
          return `I can see text in the image: "${text}". This appears to be an image containing text or documents.`;
        }
      }
    }

    throw new Error('OCR analysis failed');
  } catch (error) {
    console.error('OCR analysis error:', error);
    throw error;
  }
}

// Enhanced fallback image analysis with better detection
async function analyzeImageFallback(imageBase64: string): Promise<string> {
  try {
    const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    const imageBuffer = Buffer.from(base64Data, 'base64');
    const size = imageBuffer.length;

    // Get MIME type
    const mimeType = imageBase64.split(';')[0].split(':')[1] || 'unknown';

    // Analyze image characteristics
    let description = `I can see an uploaded image (${mimeType}, ${Math.round(size/1024)}KB). `;

    // Check image headers for more info
    const header = imageBuffer.slice(0, 20).toString('hex');

    if (header.startsWith('ffd8ff')) {
      description += "This is a JPEG photograph. ";
    } else if (header.startsWith('89504e47')) {
      description += "This is a PNG image, possibly with graphics or screenshots. ";
    } else if (header.startsWith('47494638')) {
      description += "This is a GIF image. ";
    }

    // Size-based analysis
    if (size > 2000000) {
      description += "It's a high-resolution image with lots of detail. ";
    } else if (size > 500000) {
      description += "It's a medium-sized image with good quality. ";
    } else if (size > 100000) {
      description += "It's a standard sized image. ";
    } else {
      description += "It's a small, compressed image. ";
    }

    description += "I can see the image was uploaded successfully, but I'm having trouble with detailed analysis right now. Could you describe what you see in the image? I'd love to help you understand or work with whatever you're looking at! 🖼️";

    return description;
  } catch (error) {
    console.error('Fallback analysis error:', error);
    return "I can see that an image was uploaded, but I'm having trouble analyzing it. Could you describe what's in the image so I can help you better?";
  }
}

// Free image generation using Picsum for placeholder images
async function generatePlaceholderImage(prompt: string): Promise<string> {
  try {
    // Create a themed placeholder based on the prompt
    const words = prompt.toLowerCase().split(' ');
    let category = 'nature';

    // Simple keyword matching for categories
    if (words.some(w => ['cat', 'dog', 'animal', 'pet'].includes(w))) {
      category = 'animals';
    } else if (words.some(w => ['city', 'building', 'urban', 'street'].includes(w))) {
      category = 'city';
    } else if (words.some(w => ['food', 'tomato', 'fruit', 'vegetable', 'cooking'].includes(w))) {
      category = 'food';
    } else if (words.some(w => ['ocean', 'sea', 'water', 'beach'].includes(w))) {
      category = 'water';
    }

    // Use Unsplash Source for free themed images
    const seed = Date.now();
    const imageUrl = `https://source.unsplash.com/800x600/?${category}&sig=${seed}`;

    const response = await fetch(imageUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SaiKaki/1.0)'
      },
      timeout: 15000
    });

    if (response.ok && response.headers.get('content-type')?.startsWith('image/')) {
      const imageBuffer = await response.arrayBuffer();
      const base64Image = Buffer.from(imageBuffer).toString('base64');
      return `data:image/jpeg;base64,${base64Image}`;
    }

    throw new Error('Unsplash failed');
  } catch (error) {
    console.error('Placeholder generation error:', error);
    throw error;
  }
}

// Free AI art generation using Pollinations (simplified)
async function generateImageWithPollinations(prompt: string): Promise<string> {
  try {
    const cleanPrompt = encodeURIComponent(prompt.trim());
    const seed = Math.floor(Math.random() * 1000000);

    // Simplified Pollinations URL
    const imageUrl = `https://pollinations.ai/p/${cleanPrompt}?width=512&height=512&seed=${seed}&nologo=true`;

    const response = await fetch(imageUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SaiKaki/1.0)',
        'Accept': 'image/*'
      },
      timeout: 20000
    });

    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.startsWith('image/')) {
        const imageBuffer = await response.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString('base64');
        return `data:${contentType};base64,${base64Image}`;
      }
    }

    throw new Error('Pollinations generation failed');
  } catch (error) {
    console.error('Pollinations error:', error);
    throw error;
  }
}

export async function analyzeImage(imageData: string): Promise<string> {
  console.log('Starting free image analysis...');

  try {
    // Try Hugging Face first (completely free)
    try {
      const result = await analyzeImageWithHuggingFace(imageData);
      console.log('Hugging Face analysis successful');
      return result;
    } catch (error) {
      console.log('Hugging Face failed, trying OCR...', error);

      try {
        const result = await analyzeImageWithFreeVision(imageData);
        console.log('OCR analysis successful');
        return result;
      } catch (ocrError) {
        console.log('OCR failed, using enhanced fallback...', ocrError);

        // Use enhanced fallback
        const result = await analyzeImageFallback(imageData);
        return result;
      }
    }
  } catch (error) {
    console.error('All image analysis methods failed:', error);
    return "I can see your image upload, but my vision circuits are taking a coffee break! ☕ Could you describe what's in the image? I promise to give you my most sarcastic and helpful response about whatever visual masterpiece you've shared! 👀";
  }
}

export async function generateImage(prompt: string): Promise<string> {
  console.log(`Starting free image generation for: "${prompt}"`);

  try {
    // Try Pollinations first (free AI art)
    try {
      console.log('Trying Pollinations AI...');
      const result = await generateImageWithPollinations(prompt);
      console.log('Pollinations generation successful');
      return result;
    } catch (pollinationsError) {
      console.log('Pollinations failed, using themed placeholder...', pollinationsError);

      try {
        const result = await generatePlaceholderImage(prompt);
        console.log('Placeholder generation successful');
        return result;
      } catch (placeholderError) {
        console.log('All generation methods failed', placeholderError);
        throw new Error('All free image generation services are currently unavailable');
      }
    }
  } catch (error) {
    console.error('Complete image generation failure:', error);
    throw new Error(`Oops! My artistic circuits are having a creative meltdown! 🎨💥 Even free art generators need their beauty sleep sometimes. Try again in a moment, or describe what you want and I'll help you craft the perfect prompt for later! 😏`);
  }
}

export function formatImageAnalysisForAI(imageDescription: string, userPrompt: string = ''): string {
  const formattedPrompt = userPrompt ? `\n\nUser's message about the image: "${userPrompt}"` : '';

  return `🖼️ **Image Analysis:**
The user shared an image. ${imageDescription}${formattedPrompt}

Use this visual context to provide a relevant, sarcastic but helpful response!`;
}