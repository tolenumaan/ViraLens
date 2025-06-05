
import { GoogleGenAI, GenerateContentResponse, Part } from "@google/genai";
import { API_MODEL_TEXT } from '../constants';
import { InstagramPost, GeminiInsightsResponse, ContentIdea } from '../types';

const apiKey = process.env.API_KEY;
let ai: GoogleGenAI | undefined;

if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
} else {
  console.error("API_KEY not found in environment variables. AI features will be disabled.");
  alert("API_KEY for Gemini AI is missing. Please ensure it is configured in your environment variables. AI functionalities will be limited.");
}

const parseJsonFromResponse = <T,>(text: string | undefined): T | null => {
  if (!text) return null;
  let jsonStr = text.trim();
  const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
  const match = jsonStr.match(fenceRegex);
  if (match && match[2]) {
    jsonStr = match[2].trim();
  }
  try {
    return JSON.parse(jsonStr) as T;
  } catch (e) {
    console.warn("Initial JSON parsing failed:", e, "Attempting to extract from potential string issues. Original text:", text);
    // Attempt to fix common issues like unescaped newlines or trailing commas (basic fixes)
    jsonStr = jsonStr.replace(/\\n/g, "\\n")
                     .replace(/,\s*([\]}])/g, "$1"); // Remove trailing commas

    try {
        return JSON.parse(jsonStr) as T;
    } catch (e2) {
        console.error("Secondary JSON parsing attempt failed:", e2, "Original text after basic sanitize:", jsonStr);
        // Fallback: try to find the first '{' and last '}' or '[' and ']'
        const objectMatch = jsonStr.match(/(\{.*?\})/s);
        const arrayMatch = jsonStr.match(/(\[.*?\])/s);
        let potentialJson = "";

        if (arrayMatch && (!objectMatch || arrayMatch[0].length > objectMatch[0].length)) {
            potentialJson = arrayMatch[0];
        } else if (objectMatch) {
            potentialJson = objectMatch[0];
        }
        
        if (potentialJson) {
            try {
                console.warn("Attempting to parse extracted JSON substring:", potentialJson);
                return JSON.parse(potentialJson) as T;
            } catch (e3) {
                console.error("Final JSON parsing attempt failed:", e3, "Substring:", potentialJson);
            }
        }
        return null;
    }
  }
};


export const extractSocialDataFromFileAPI = async (fileContent: string, fileName: string): Promise<Partial<InstagramPost>[] | null> => {
  if (!ai) throw new Error("Gemini AI SDK not initialized. API Key might be missing.");
  
  const prompt = `Analyze the following text content from a user-uploaded file named "${fileName}". The file could be CSV, TXT, or TSV, potentially with or without headers. Extract social media post data. Identify individual posts and for each, extract relevant fields like: 
  - username (e.g., @username, user_name)
  - caption or post text
  - comments count (numeric)
  - likes count (numeric)
  - post URL
  - media URL (image or video link)
  - timestamp or date (if available, try to parse into ISO 8601 format or keep as string)
  - hashtags (array of strings, extracted from caption)
  - audio file name or sound used (if mentioned)

Return the extracted data as a JSON array of objects. Each object represents a post. 
If a field isn't found for a post, omit it or use null for that field. 
If the file seems to contain headers, use them as a guide but also infer from context if headers are ambiguous or missing.
Focus on information pertinent to social media analysis.
Example of a single post object: 
{
  "username": "socialStar", 
  "postCaption": "My amazing trip! #travel #vacation", 
  "comments": 150, 
  "likes": 2000, 
  "postUrl": "https://instagram.com/p/xyz", 
  "mediaUrl": "https://images.com/photo.jpg",
  "hashtags": ["#travel", "#vacation"],
  "timestamp": "2023-10-26T10:30:00Z"
}
If no relevant social media data is found, return an empty array. Ensure the output is a valid JSON array.

File Content (first 30000 characters):
---
${fileContent.substring(0, 30000)} 
---
`;

  try {
    console.log("Sending data extraction request to Gemini for file:", fileName);
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: API_MODEL_TEXT,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.2, // Lower temperature for more deterministic extraction
      }
    });
    const extractedData = parseJsonFromResponse<Partial<InstagramPost>[]>(response.text);
    console.log("Gemini extraction response:", response.text);
    if (extractedData) {
        return extractedData.map((post, index) => ({
            id: `extracted-${Date.now()}-${index}`, // Assign a temporary unique ID
            ...post
        }));
    }
    return null;
  } catch (error) {
    console.error("Gemini API error (extractSocialDataFromFileAPI):", error);
    throw new Error("AI failed to extract data from file. The file might be unstructured or an API error occurred.");
  }
};


export const generateInsightsAPI = async (data: Partial<InstagramPost>[]): Promise<GeminiInsightsResponse | null> => {
  if (!ai) throw new Error("Gemini AI SDK not initialized. API Key might be missing.");

  const postsForAnalysis = data.slice(0, 25); // Limit for performance, token count and API stability
  const contentParts: Part[] = [];

  let textualPrompt = `Act as a social media analytics expert. Analyze this social media post data. Some posts include image data (provided as inline data) or links to media. Provide detailed insights in JSON format.
Data contains ${postsForAnalysis.length} posts. Analyze trends across these posts.

Required JSON structure (ensure all fields are present, use "N/A" or "Could not determine" if info is sparse):
{
  "engagementPatterns": {
    "averageComments": "number or 'N/A'",
    "averageLikes": "number or 'N/A'",
    "topPerformers": [{"username": "string", "comments": "number", "likes": "number", "captionPreview": "string (max 50 chars)", "postUrl": "string", "mediaUrl": "string"}],
    "engagementRate": "string (e.g. 'High', 'Medium', 'Low', or a calculated percentage like '5.2% if possible, otherwise a qualitative assessment')"
  },
  "contentAnalysis": {
    "topCategories": ["string (e.g. 'Tutorials', 'Travel Vlogs', 'Product Reviews')"],
    "captionInsights": "string (brief analysis of caption effectiveness, common themes, sentiment)",
    "audioTrends": ["string (e.g. 'Upbeat Pop', 'Lo-fi Beats', 'Original Audio', from audioFileName if available, or describe if not)"],
    "visualThemes": ["string (e.g. 'Nature Scenery', 'Minimalist Aesthetics', 'Bright & Colorful', 'User-Generated Content Style' - derived from image analysis if available and textual descriptions)"],
    "mediaEffectiveness": "string (how well media (images/videos) seem to support the content goals, considering visual themes, image quality/relevance from descriptions, or direct image analysis if provided)"
  },
  "audienceInsights": {
    "peakEngagementHours": "string (e.g. '6 PM - 9 PM on weekdays', 'Weekend Mornings'; infer if timestamps present, otherwise provide general advice based on content type)",
    "preferredContentTypes": ["string (e.g. 'Video Reels', 'Carousel Posts', 'Image with Text Overlay', 'Infographics')"],
    "demographicTrends": "string (brief summary of potential target audience based on content, e.g. 'Likely appeals to young adults interested in sustainable fashion')"
  },
  "recommendations": ["string (3-5 actionable and specific recommendations based on all insights, including visual and media strategy)"]
}

Guidelines:
1. Calculate averages accurately. Identify top 3 performing posts by combined engagement (likes + comments). If no engagement data, by other available metrics or qualitatively.
2. Detect broad content categories (e.g., 'Educational', 'Entertainment', 'Lifestyle', 'Promotional') from captions, media descriptions, and image content if available.
3. If image data is provided for a post (indicated by 'Image data for Post X is provided separately'), analyze its content and incorporate visual themes and effectiveness.
4. If media URLs are provided (especially for videos or un-fetched images), infer their nature and impact from context.
5. Provide 3-5 actionable recommendations.
6. Ensure the entire JSON output is valid.

Post Data Summary:
`;

  postsForAnalysis.forEach((post, index) => {
    textualPrompt += `\nPost ${index + 1} (ID: ${post.id}):
    Username: ${post.username || 'N/A'}
    Caption: ${post.postCaption ? post.postCaption.substring(0, 250) + (post.postCaption.length > 250 ? "..." : "") : 'N/A'}
    Comments: ${typeof post.comments === 'number' ? post.comments : 'N/A'}, Likes: ${typeof post.likes === 'number' ? post.likes : 'N/A'}
    Audio: ${post.audioFileName || 'N/A'}
    Media URL: ${post.mediaUrl || 'N/A'} (Type: ${post.mediaType || 'unknown'})
    Timestamp: ${post.timestamp || 'N/A'}
    ${post.mediaData && post.mediaType === 'image' ? `(Image data for Post ${index + 1} is provided separately for visual analysis)\n` : ''}`;

    if (post.mediaData && post.mediaType === 'image' && post.mediaData.length > 100 && post.mediaData.length < 4000000) { // Check size limit & validity
        contentParts.push({ inlineData: { mimeType: 'image/jpeg', data: post.mediaData } });
    }
  });
  
  contentParts.unshift({ text: textualPrompt });

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: API_MODEL_TEXT, // This model supports multimodal (text and image)
      contents: [{ parts: contentParts }],
      config: {
        responseMimeType: "application/json",
        temperature: 0.5,
      }
    });
    console.log("Gemini insights response text:", response.text);
    return parseJsonFromResponse<GeminiInsightsResponse>(response.text);
  } catch (error) {
    console.error("Gemini API error (generateInsightsAPI):", error);
    throw new Error("Failed to generate insights from AI. Check console for details. The API might be temporarily unavailable or the request was too large.");
  }
};

export const generateContentIdeasAPI = async (insights: GeminiInsightsResponse, existingIdeasCount: number = 0): Promise<ContentIdea[] | null> => {
  if (!ai) throw new Error("Gemini AI SDK not initialized. API Key might be missing.");
  const ideasToGenerate = Math.max(1, 4 - existingIdeasCount); 
  if (ideasToGenerate === 0) return [];

  const prompt = `Act as a creative social media content strategist. Based on these insights (which include analysis of engagement, content themes, visual elements, and audience preferences), generate ${ideasToGenerate} diverse and actionable content ideas.
      
Insights Summary: 
Engagement: Average Likes - ${insights.engagementPatterns.averageLikes}, Average Comments - ${insights.engagementPatterns.averageComments}. Engagement Rate: ${insights.engagementPatterns.engagementRate}.
Content: Top Categories - ${insights.contentAnalysis.topCategories.join(', ')}; Visual Themes - ${insights.contentAnalysis.visualThemes?.join(', ') || 'N/A'}. Media Effectiveness: ${insights.contentAnalysis.mediaEffectiveness}.
Audience: Prefers - ${insights.audienceInsights.preferredContentTypes.join(', ')}. Peak Hours - ${insights.audienceInsights.peakEngagementHours}.
Key Recommendations: ${insights.recommendations.join('; ')}
      
Generate a JSON array of ${ideasToGenerate} content idea objects. Each object must follow this structure:
{
  "id": "string (generate a unique UUID-like string, e.g., 'idea-xxxx-xxxx-xxxx')",
  "title": "string (catchy, concise, <15 words)",
  "description": "string (detailed explanation, 2-4 sentences, explicitly linking to insights like visual themes, audience preferences, or recommendations)",
  "type": "string (e.g., 'Interactive Story', 'Tutorial Video', 'Behind-the-Scenes Photo Set', 'User-Generated Content Contest', 'Expert Q&A Live')",
  "estimatedEngagement": "High" | "Medium" | "Low" (based on insights),
  "suggestedAudio": "string (e.g., 'Trending TikTok Sound: XYZ', 'Upbeat Royalty-Free Pop', 'Calm Lofi Beats for Focus', 'Original Voiceover with X theme music')",
  "hashtags": ["string (4-6 relevant and niche hashtags, mixing broad and specific)"],
  "visualPrompt": "string (specific suggestion for visuals, e.g., 'Use a flatlay style with bright, contrasting colors for product shots', 'Short, dynamic video clips with quick cuts', 'Feature user testimonials with authentic photos')"
}
      
Guidelines:
1. Create ${ideasToGenerate} distinct ideas.
2. Ideas must be directly inspired by the provided insights (engagement, content, audience, recommendations, visual themes).
3. Suggest specific or types of trending/appropriate audio.
4. Include 4-6 targeted hashtags.
5. Make ideas actionable and clear. Estimate engagement potential realistically.
6. Each idea MUST have a unique 'id'.
7. Ensure the entire output is a valid JSON array.
`;
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: API_MODEL_TEXT,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.7, // Higher temperature for more creative ideas
      }
    });
    const parsedIdeas = parseJsonFromResponse<ContentIdea[]>(response.text);
    return parsedIdeas ? parsedIdeas.slice(0, ideasToGenerate) : null;
  } catch (error) {
    console.error("Gemini API error (generateContentIdeasAPI):", error);
    throw new Error("Failed to generate content ideas from AI. Check console for details.");
  }
};

export const refineContentIdeaAPI = async (ideaToRefine: ContentIdea, refinementGoal: string): Promise<ContentIdea | null> => {
  if (!ai) throw new Error("Gemini AI SDK not initialized. API Key might be missing.");

  const prompt = `You are an expert social media content editor. Refine the following content idea based on the user's specific goal.
Current Content Idea:
${JSON.stringify(ideaToRefine, null, 2)}

User's Refinement Goal: "${refinementGoal}"

Based on this goal, update the relevant fields of the content idea. For example:
- If goal is "Make the title more engaging for Gen Z", update 'title' and potentially 'hashtags'.
- If goal is "Suggest 3 alternative visual concepts", update 'visualPrompt' to list them.
- If goal is "Expand the description to be more persuasive", update 'description'.
- If goal is "Find more niche hashtags", update 'hashtags'.

Return the *entire updated content idea object* in the exact same JSON format as the input. Ensure the 'id' field remains unchanged.
Focus on fulfilling the refinement goal effectively while maintaining the core concept of the idea unless the goal implies a shift.
Output only the JSON object.
`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: API_MODEL_TEXT,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.6,
      }
    });
    return parseJsonFromResponse<ContentIdea>(response.text);
  } catch (error) {
    console.error("Gemini API error (refineContentIdeaAPI):", error);
    throw new Error("Failed to refine content idea with AI. Check console for details.");
  }
};

export const convertImageToResizedBase64 = (fileOrBlob: File | Blob, maxSize: number = 800, quality: number = 0.85): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Could not get canvas context'));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1]); // Return only base64 part
      };
      img.onerror = (err) => reject(new Error(`Image loading error: ${err}`));
      if (event.target?.result) {
        img.src = event.target.result as string;
      } else {
        reject(new Error('FileReader did not produce a result.'));
      }
    };
    reader.onerror = (err) => reject(new Error(`FileReader error: ${err}`));
    reader.readAsDataURL(fileOrBlob);
  });
};

export const fetchAndProcessImage = async (url: string): Promise<{ base64Data: string; mimeType: string } | null> => {
  if (!url || (!url.startsWith('http:') && !url.startsWith('https:'))) {
    console.warn("Invalid or non-HTTP(S) URL for image fetching:", url);
    return null;
  }
  
  // Basic check for common image extensions or data URI
  if (!/\.(jpeg|jpg|gif|png|webp)$/i.test(url) && !url.startsWith('data:image')) {
      console.warn("URL does not appear to be a direct image link or data URI:", url);
      // We might still try to fetch it if it's a generic URL, but success is less likely.
  }

  try {
    // Attempt to use a proxy for CORS issues if available (conceptual)
    // const proxyUrl = `https://your-cors-proxy-service.com/fetch?url=${encodeURIComponent(url)}`;
    // const response = await fetch(proxyUrl); // Replace with direct fetch if no proxy
    
    const response = await fetch(url); // Direct fetch
    
    if (!response.ok) {
      console.error(`Failed to fetch image from ${url}. Status: ${response.status} ${response.statusText}`);
      return null;
    }
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) {
      console.error(`Fetched content from ${url} is not an image. MIME type: ${blob.type}`);
      return null;
    }

    const base64Data = await convertImageToResizedBase64(blob, 800, 0.85);
    return { base64Data, mimeType: 'image/jpeg' }; // Standardize to JPEG after resize
  } catch (error) {
    // Catching specific error types can be helpful
    if (error instanceof TypeError && error.message === "Failed to fetch") {
         console.warn(`CORS or Network error fetching image from ${url}. This often requires a server-side proxy for external URLs. Details: ${error}`);
    } else {
         console.error(`Error fetching or processing image from ${url}:`, error);
    }
    return null;
  }
};
