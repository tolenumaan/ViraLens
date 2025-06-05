
export interface InstagramPost {
  id: string;
  username?: string;
  comments?: number;
  likes?: number;
  audioFileName?: string;
  postCaption?: string;
  postUrl?: string;
  mediaUrl?: string; // For image or video URLs
  mediaType?: 'image' | 'video' | 'unknown'; // Type of media
  mediaData?: string; // Base64 encoded image data for analysis (client-side processed)
  timestamp?: string; // Optional timestamp
  // Allow other potential fields Gemini might extract
  [key: string]: any;
}

export interface EngagementPatterns {
  averageComments: number | string; 
  averageLikes?: number | string; 
  topPerformers: Array<{ username?: string; comments?: number; likes?: number; captionPreview: string, postUrl?: string, mediaUrl?: string }>;
  engagementRate: string; 
}

export interface ContentAnalysis {
  topCategories: string[];
  captionInsights: string;
  audioTrends: string[];
  visualThemes?: string[]; // Added for image analysis
  mediaEffectiveness?: string; // Added for media analysis
}

export interface AudienceInsights {
  peakEngagementHours: string;
  preferredContentTypes: string[];
  demographicTrends: string;
}

export interface GeminiInsightsResponse {
  engagementPatterns: EngagementPatterns;
  contentAnalysis: ContentAnalysis;
  audienceInsights: AudienceInsights;
  recommendations: string[];
}

export interface ContentIdea {
  id: string; // Unique ID for the idea
  title: string;
  description:string;
  type: string; 
  estimatedEngagement: "High" | "Medium" | "Low";
  suggestedAudio: string;
  hashtags: string[];
  visualPrompt?: string; 
  campaignId?: string; // To link to a campaign
}

export interface Campaign {
  id: string;
  name: string;
  ideas: ContentIdea[];
  createdAt: string;
}

export type TabName = 'upload' | 'data' | 'insights' | 'notebook'; // Renamed 'ideas' to 'notebook'
