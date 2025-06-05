
import { InstagramPost, TabName } from './types';

export const API_MODEL_TEXT = 'gemini-2.5-flash-preview-04-17';
export const API_MODEL_IMAGE_GEN = 'imagen-3.0-generate-002'; // For potential future image generation

export const TABS: Array<{ id: TabName; label: string }> = [
  { id: 'upload', label: 'Upload' },
  { id: 'data', label: 'Data View' },
  { id: 'insights', label: 'AI Insights' },
  { id: 'notebook', label: 'Notebook' }, 
];

export const SAMPLE_DATA: InstagramPost[] = [
  { id: "sample-1", username: "design_guru", comments: 150, likes: 300, audioFileName: "chill_vibes.mp3", postCaption: "My new minimalist workspace setup. Focus mode activated! #minimalism #desksetup #design", postUrl: "https://instagram.com/p/sample1", mediaUrl: "https://picsum.photos/seed/design_guru_ws/600/400", mediaType: "image" },
  { id: "sample-2", username: "food_blogger_kate", comments: 230, likes: 550, audioFileName: "kitchen_sounds_asmr.wav", postCaption: "Secret recipe for vegan chocolate avocado mousse. You won't believe it's healthy! #vegan #recipe #healthyfood #chocolate", postUrl: "https://instagram.com/p/sample2", mediaUrl: "https://picsum.photos/seed/food_blogger_kate_mousse/600/400", mediaType: "image"},
  { id: "sample-3", username: "travel_junkie_js", comments: 80, likes: 120, postCaption: "Exploring the hidden alleys of Rome. Every corner tells a story. #travel #rome #italy #adventure", postUrl: "https://instagram.com/p/sample3", mediaUrl: "https://example.com/rome_video.mp4", mediaType: "video" }, // Video example
  { id: "sample-4", username: "diy_queen", comments: 120, likes: 200, postCaption: "Transforming an old tire into a garden planter! Sustainable and cute. #diy #gardening #upcycle", postUrl: "https://instagram.com/p/sample4", mediaUrl: "https://picsum.photos/seed/diy_queen_planter/600/400", mediaType: "image" },
  { id: "sample-5", username: "pet_lover_official", comments: 190, likes: 400, postCaption: "My cat judging my life choices again. 😹 #catsofinstagram #pets #funnyanimals", postUrl: "https://instagram.com/p/sample5", mediaUrl: "https://picsum.photos/seed/pet_lover_cat/600/400", mediaType: "image" },
  { id: "sample-6", username: "marketing_pro", postCaption: "Latest stats on video content engagement. TikTok vs Reels. Full report link in bio.", likes: 75, comments: 12, mediaUrl: "https://example.com/report_infographic.png", mediaType: "image" }
];

export const CATEGORY_COLORS = [
  "bg-sky-500/30 text-sky-300",
  "bg-emerald-500/30 text-emerald-300",
  "bg-rose-500/30 text-rose-300",
  "bg-amber-500/30 text-amber-300",
  "bg-violet-500/30 text-violet-300",
  "bg-teal-500/30 text-teal-300",
  "bg-pink-500/30 text-pink-300",
];
