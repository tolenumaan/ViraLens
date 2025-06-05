
import React from 'react';
import { Lightbulb, Music2, Hash, Save, Sparkles, CheckCircle } from 'lucide-react';
import { ContentIdea } from '../types';

interface ContentIdeaCardProps {
  idea: ContentIdea;
  onSaveToNotebook: (idea: ContentIdea) => void;
  isSaved?: boolean; // To indicate if it's already in notebook (e.g. has a campaignId)
  className?: string;
}

const ContentIdeaCard: React.FC<ContentIdeaCardProps> = ({ idea, onSaveToNotebook, isSaved, className }) => {
  const engagementColor = 
    idea.estimatedEngagement === 'High' ? 'bg-green-500/30 text-green-200 border-green-500/50' :
    idea.estimatedEngagement === 'Medium' ? 'bg-yellow-500/30 text-yellow-200 border-yellow-500/50' :
    'bg-blue-500/30 text-blue-200 border-blue-500/50';
  
  return (
    <div className={`bg-gradient-to-br from-indigo-700/20 via-purple-700/20 to-pink-700/20 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:border-cyan-400/50 transition-all duration-300 relative overflow-hidden shadow-xl ${className}`}>
      <div className="absolute top-4 right-4">
        {isSaved ? (
           <span className="text-xs bg-green-600/50 text-green-100 px-3 py-1.5 rounded-lg flex items-center shadow-md border border-green-500/60">
            <CheckCircle className="h-4 w-4 mr-1.5" /> Saved
          </span>
        ) : (
          <button 
            onClick={() => onSaveToNotebook(idea)}
            className="text-xs bg-cyan-500/30 text-cyan-200 px-3 py-1.5 rounded-lg hover:bg-cyan-500/50 hover:text-cyan-100 transition-colors flex items-center shadow-md border border-cyan-500/50"
            aria-label="Save to notebook"
          >
            <Save className="h-4 w-4 mr-1.5" /> Save to Notebook
          </button>
        )}
      </div>
      
      <div className="mb-5">
        <h3 className="text-xl font-semibold text-cyan-300 mb-2 flex items-center">
          <Lightbulb className="h-5 w-5 mr-2 text-yellow-400" />
          {idea.title}
        </h3>
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="bg-purple-500/30 text-purple-200 px-3 py-1 rounded-full text-xs font-medium border border-purple-500/50">
            {idea.type}
          </span>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${engagementColor}`}>
            {idea.estimatedEngagement} Engagement
          </span>
        </div>
        <p className="text-gray-300 text-sm leading-relaxed">{idea.description}</p>
      </div>
      
      <div className="space-y-4 pt-4 border-t border-white/10">
        {idea.visualPrompt && (
          <div>
            <p className="text-xs text-gray-400 mb-1 flex items-center">
              <Sparkles className="h-4 w-4 mr-2 text-yellow-300" />
              Visual Suggestion
            </p>
            <p className="text-yellow-300 text-sm">{idea.visualPrompt}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-gray-400 mb-1 flex items-center">
            <Music2 className="h-4 w-4 mr-2 text-purple-400" />
            Suggested Audio
          </p>
          <p className="text-purple-300 text-sm">{idea.suggestedAudio}</p>
        </div>
        
        <div>
          <p className="text-xs text-gray-400 mb-1 flex items-center">
            <Hash className="h-4 w-4 mr-2 text-pink-400" />
            Recommended Hashtags
          </p>
          <div className="flex flex-wrap gap-1.5">
            {idea.hashtags && idea.hashtags.map((hashtag, idx) => (
              <span 
                key={idx} 
                className="bg-pink-500/20 text-pink-300 px-2.5 py-1 rounded-full text-xs hover:bg-pink-500/40 cursor-default transition-colors border border-pink-500/40"
              >
                {hashtag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentIdeaCard;
