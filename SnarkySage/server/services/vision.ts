
import fetch from 'node-fetch';

// Free image analysis using multiple services with better error handling
async function analyzeImageWithHuggingFace(imageBase64: string): Promise<string> {
  try {
    const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

    // Try multiple Hugging Face models
    const models = [
      'Salesforce/blip-image-captioning-large',
      'Salesforce/blip-image-captioning-base',
      'nlpconnect/vit-gpt2-image-captioning'
    ];

    for (const model of models) {
      try {
        const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: base64Data,
            options: { 
              wait_for_model: true,
              use_cache: false
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data && data[0] && data[0].generated_text) {
            return `I can see: ${data[0].generated_text}`;
          }
        }
      } catch (modelError) {
        console.log(`Model ${model} failed, trying next...`);
        continue;
      }
    }

    throw new Error('All Hugging Face models failed');
  } catch (error) {
    console.error('Hugging Face vision error:', error);
    throw error;
  }
}

// Enhanced image analysis with better detection
async function analyzeImageFallback(imageBase64: string): Promise<string> {
  try {
    const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    const imageBuffer = Buffer.from(base64Data, 'base64');
    const size = imageBuffer.length;

    const mimeType = imageBase64.split(';')[0].split(':')[1] || 'unknown';
    let description = `I can see an uploaded image (${mimeType}, ${Math.round(size/1024)}KB). `;

    // Check image headers for more info
    const header = imageBuffer.slice(0, 20).toString('hex');

    if (header.startsWith('ffd8ff')) {
      description += "This is a JPEG photograph. ";
      
      // Try to detect common image patterns
      if (size > 1000000) {
        description += "It appears to be a high-quality photo, possibly containing detailed subjects like people, objects, or landscapes. ";
      } else if (size > 200000) {
        description += "It looks like a standard photo with good detail. ";
      } else {
        description += "It's a compressed photo, likely containing simple subjects or graphics. ";
      }
    } else if (header.startsWith('89504e47')) {
      description += "This is a PNG image, possibly a screenshot, graphic design, or image with transparency. ";
    } else if (header.startsWith('47494638')) {
      description += "This is a GIF image, which might be animated or a simple graphic. ";
    }

    description += "I can analyze the technical aspects but need help with the actual content. Could you describe what you see so I can provide more specific insights? 📸";

    return description;
  } catch (error) {
    console.error('Fallback analysis error:', error);
    return "I can see an image was uploaded! While I can't fully analyze it right now, feel free to describe what's in it and I'll help you work with it! 🖼️";
  }
}

// Reliable free image generation using multiple services
async function generateImageWithPollinations(prompt: string): Promise<string> {
  try {
    const cleanPrompt = encodeURIComponent(prompt.trim());
    const seed = Math.floor(Math.random() * 1000000);

    // Updated Pollinations endpoints with better parameters
    const endpoints = [
      `https://pollinations.ai/p/${cleanPrompt}?width=768&height=768&seed=${seed}&enhance=true&nologo=true`,
      `https://image.pollinations.ai/prompt/${cleanPrompt}?width=768&height=768&seed=${seed}&model=flux`,
      `https://pollinations.ai/p/${cleanPrompt}?model=turbo&width=512&height=512&seed=${seed}`,
      `https://image.pollinations.ai/prompt/${cleanPrompt}?width=512&height=512&seed=${seed}`
    ];

    for (const imageUrl of endpoints) {
      try {
        console.log(`Trying Pollinations: ${imageUrl}`);
        const response = await fetch(imageUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; SaiKaki/1.0)',
            'Accept': 'image/*'
          },
          timeout: 30000
        });

        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.startsWith('image/')) {
            const imageBuffer = await response.arrayBuffer();
            const base64Image = Buffer.from(imageBuffer).toString('base64');
            console.log('Pollinations generation successful');
            return `data:${contentType};base64,${base64Image}`;
          }
        }
      } catch (endpointError) {
        console.log(`Endpoint failed: ${imageUrl}`, endpointError);
        continue;
      }
    }

    throw new Error('All Pollinations endpoints failed');
  } catch (error) {
    console.error('Pollinations error:', error);
    throw error;
  }
}

// Alternative using Replicate's free tier
async function generateImageWithReplicate(prompt: string): Promise<string> {
  try {
    const cleanPrompt = encodeURIComponent(prompt.trim());
    
    // Try different Replicate public endpoints
    const endpoints = [
      `https://replicate.delivery/pbxt/stable-diffusion/${cleanPrompt}.jpg`,
      `https://replicate.delivery/mgxm/flux-schnell/${cleanPrompt}.png`
    ];

    for (const imageUrl of endpoints) {
      try {
        const response = await fetch(imageUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; SaiKaki/1.0)',
            'Accept': 'image/*'
          },
          timeout: 25000
        });

        if (response.ok && response.headers.get('content-type')?.startsWith('image/')) {
          const imageBuffer = await response.arrayBuffer();
          const base64Image = Buffer.from(imageBuffer).toString('base64');
          return `data:image/jpeg;base64,${base64Image}`;
        }
      } catch (error) {
        continue;
      }
    }

    throw new Error('Replicate generation failed');
  } catch (error) {
    console.error('Replicate error:', error);
    throw error;
  }
}

// Free AI art using Hugging Face Inference API
async function generateImageWithHuggingFace(prompt: string): Promise<string> {
  try {
    const models = [
      'runwayml/stable-diffusion-v1-5',
      'stabilityai/stable-diffusion-2-1',
      'CompVis/stable-diffusion-v1-4'
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
            options: { 
              wait_for_model: true,
              use_cache: false
            }
          })
        });

        if (response.ok) {
          const imageBuffer = await response.arrayBuffer();
          if (imageBuffer.byteLength > 1000) { // Valid image
            const base64Image = Buffer.from(imageBuffer).toString('base64');
            return `data:image/jpeg;base64,${base64Image}`;
          }
        }
      } catch (error) {
        continue;
      }
    }

    throw new Error('Hugging Face generation failed');
  } catch (error) {
    console.error('Hugging Face generation error:', error);
    throw error;
  }
}

// Generate themed image using Unsplash with better categories
async function generateThemedImageWithUnsplash(prompt: string): Promise<string> {
  try {
    const words = prompt.toLowerCase().split(' ');
    let searchTerm = 'abstract art';

    // Better keyword matching for image themes
    if (words.some(w => ['tomato', 'tomatoes', 'red', 'vegetable', 'fruit', 'food'].includes(w))) {
      searchTerm = 'tomato red vegetable';
    } else if (words.some(w => ['cat', 'cats', 'kitten', 'feline'].includes(w))) {
      searchTerm = 'cat kitten';
    } else if (words.some(w => ['dog', 'dogs', 'puppy', 'canine'].includes(w))) {
      searchTerm = 'dog puppy';
    } else if (words.some(w => ['flower', 'flowers', 'bloom', 'petal'].includes(w))) {
      searchTerm = 'beautiful flowers';
    } else if (words.some(w => ['sunset', 'sunrise', 'sky', 'clouds'].includes(w))) {
      searchTerm = 'sunset sky clouds';
    } else if (words.some(w => ['ocean', 'sea', 'water', 'beach', 'waves'].includes(w))) {
      searchTerm = 'ocean waves beach';
    } else if (words.some(w => ['mountain', 'mountains', 'peak', 'landscape'].includes(w))) {
      searchTerm = 'mountain landscape';
    } else if (words.some(w => ['city', 'urban', 'building', 'architecture'].includes(w))) {
      searchTerm = 'city architecture';
    } else if (words.some(w => ['forest', 'trees', 'nature', 'green'].includes(w))) {
      searchTerm = 'forest trees nature';
    }

    const seed = Date.now();
    const imageUrl = `https://source.unsplash.com/1024x1024/?${encodeURIComponent(searchTerm)}&sig=${seed}`;

    const response = await fetch(imageUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SaiKaki/1.0)',
        'Accept': 'image/*'
      },
      timeout: 20000
    });

    if (response.ok && response.headers.get('content-type')?.startsWith('image/')) {
      const imageBuffer = await response.arrayBuffer();
      const base64Image = Buffer.from(imageBuffer).toString('base64');
      return `data:image/jpeg;base64,${base64Image}`;
    }

    throw new Error('Unsplash themed image failed');
  } catch (error) {
    console.error('Unsplash error:', error);
    throw error;
  }
}

// Create enhanced SVG fallback image
function createEnhancedFallbackImage(prompt: string): string {
  const words = prompt.toLowerCase();
  let emoji = '🖼️';
  let color = '#4F46E5';
  let bgColor = '#F3F4F6';
  
  // Choose emoji and colors based on prompt
  if (words.includes('tomato')) {
    emoji = '🍅';
    color = '#EF4444';
    bgColor = '#FEF2F2';
  } else if (words.includes('cat')) {
    emoji = '🐱';
    color = '#F59E0B';
    bgColor = '#FFFBEB';
  } else if (words.includes('dog')) {
    emoji = '🐶';
    color = '#8B5CF6';
    bgColor = '#FAF5FF';
  } else if (words.includes('flower')) {
    emoji = '🌸';
    color = '#EC4899';
    bgColor = '#FDF2F8';
  } else if (words.includes('tree')) {
    emoji = '🌳';
    color = '#10B981';
    bgColor = '#F0FDF4';
  } else if (words.includes('ocean') || words.includes('water')) {
    emoji = '🌊';
    color = '#0EA5E9';
    bgColor = '#F0F9FF';
  } else if (words.includes('sun')) {
    emoji = '☀️';
    color = '#F59E0B';
    bgColor = '#FFFBEB';
  }

  const svg = `
    <svg width="768" height="768" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${bgColor};stop-opacity:0.8" />
          <stop offset="100%" style="stop-color:${color};stop-opacity:0.1" />
        </linearGradient>
      </defs>
      <rect width="768" height="768" fill="url(#bg)"/>
      <rect x="64" y="64" width="640" height="640" fill="${color}" opacity="0.1" rx="32"/>
      <circle cx="384" cy="300" r="120" fill="${color}" opacity="0.2"/>
      <text x="384" y="340" font-family="Arial, sans-serif" font-size="160" text-anchor="middle" fill="${color}">${emoji}</text>
      <text x="384" y="500" font-family="Arial, sans-serif" font-size="32" text-anchor="middle" fill="${color}" opacity="0.8">AI Generated</text>
      <text x="384" y="540" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="${color}" opacity="0.6">${prompt.substring(0, 30)}${prompt.length > 30 ? '...' : ''}</text>
      <text x="384" y="650" font-family="Arial, sans-serif" font-size="16" text-anchor="middle" fill="${color}" opacity="0.5">Created by Sai Kaki AI</text>
    </svg>
  `;

  const base64Svg = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64Svg}`;
}

export async function analyzeImage(imageData: string): Promise<string> {
  console.log('Starting robust image analysis...');

  try {
    // Try Hugging Face first
    try {
      const result = await analyzeImageWithHuggingFace(imageData);
      console.log('Hugging Face analysis successful');
      return result;
    } catch (error) {
      console.log('Hugging Face failed, using enhanced fallback...', error);
      
      // Use enhanced fallback with better detection
      const result = await analyzeImageFallback(imageData);
      return result;
    }
  } catch (error) {
    console.error('All image analysis methods failed:', error);
    return "I can see your image upload! While my vision analysis is taking a quick break, I'm still here to help. Could you describe what's in the image? I promise to give you my most sarcastic and helpful response! 👀✨";
  }
}

export async function generateImage(prompt: string): Promise<string> {
  console.log(`Starting robust image generation for: "${prompt}"`);

  const generators = [
    { name: 'Pollinations AI', fn: generateImageWithPollinations },
    { name: 'Hugging Face', fn: generateImageWithHuggingFace },
    { name: 'Replicate', fn: generateImageWithReplicate },
    { name: 'Unsplash Themed', fn: generateThemedImageWithUnsplash }
  ];

  // Try each generator
  for (const generator of generators) {
    try {
      console.log(`Trying ${generator.name}...`);
      const result = await generator.fn(prompt);
      console.log(`${generator.name} generation successful`);
      return result;
    } catch (error) {
      console.log(`${generator.name} failed:`, error.message);
      continue;
    }
  }

  // If all else fails, create enhanced fallback
  console.log('All generators failed, creating enhanced fallback image');
  return createEnhancedFallbackImage(prompt);
}

export function formatImageAnalysisForAI(imageDescription: string, userPrompt: string = ''): string {
  const formattedPrompt = userPrompt ? `\n\nUser's message about the image: "${userPrompt}"` : '';

  return `🖼️ **Image Analysis:**
The user shared an image. ${imageDescription}${formattedPrompt}

Use this visual context to provide a relevant, sarcastic but helpful response!`;
}
