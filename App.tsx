
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, Brain, TrendingUp, Users, MessageCircle, Heart, ExternalLink, Sparkles, BarChart3, Target, Lightbulb, Download, Loader, Music2, Hash, FileText, Search, BookOpen, FolderPlus, Edit3, Send, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { InstagramPost, GeminiInsightsResponse, ContentIdea, TabName, Campaign } from './types';
import { SAMPLE_DATA, TABS, CATEGORY_COLORS, API_MODEL_TEXT } from './constants';
import { 
  generateInsightsAPI, 
  generateContentIdeasAPI, 
  extractSocialDataFromFileAPI, 
  fetchAndProcessImage,
  refineContentIdeaAPI
} from './services/geminiService';
import LoadingOverlay from './components/LoadingOverlay';
import StatCard from './components/StatCard';
import ContentIdeaCardComponent from './components/ContentIdeaCard'; // Renamed to avoid conflict
import EmptyState from './components/EmptyState';

const SocialInsightsApp: React.FC = () => {
  const [data, setData] = useState<InstagramPost[]>([]);
  const [filteredData, setFilteredData] = useState<InstagramPost[]>([]);
  const [insights, setInsights] = useState<GeminiInsightsResponse | null>(null);
  const [generatedContentIdeas, setGeneratedContentIdeas] = useState<ContentIdea[]>([]); // Ideas from initial generation
  
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => {
    const savedCampaigns = localStorage.getItem('socialCampaigns');
    return savedCampaigns ? JSON.parse(savedCampaigns) : [];
  });
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [editingIdea, setEditingIdea] = useState<ContentIdea | null>(null);
  const [refinementGoal, setRefinementGoal] = useState('');
  const [isRefining, setIsRefining] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Processing...");
  const [activeTab, setActiveTab] = useState<TabName>('upload');
  const [error, setError] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('socialCampaigns', JSON.stringify(campaigns));
  }, [campaigns]);

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const apiKey = queryParams.get('apiKey');
    if (apiKey && !process.env.API_KEY) {
      // This is a conceptual way to set it if it were possible client-side,
      // but process.env.API_KEY is build-time or server-side.
      // For a client-side app without a backend, a different API key management strategy is needed.
      // This demo assumes API_KEY is available in the execution environment.
      console.warn("API Key found in URL. This is for demo purposes and not secure for production. Using it to initialize AI if not set in env.");
      // Potentially re-initialize AI service here if it allows dynamic API key setting after load.
    }
  }, []);


  useEffect(() => {
    if (!searchTerm) {
      setFilteredData(data.slice(0, 20)); // Show first 20 by default
    } else {
      setFilteredData(
        data.filter(item =>
          (item.postCaption && item.postCaption.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (item.username && item.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (item.id && item.id.toLowerCase().includes(searchTerm.toLowerCase()))
        ).slice(0, 20) 
      );
    }
  }, [data, searchTerm]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLDivElement>) => {
    setError('');
    setData([]);
    setInsights(null);
    setGeneratedContentIdeas([]);
    let file: File | null = null;

    if ('dataTransfer' in event) { // Drag event
      event.preventDefault(); // Important for drag and drop
      if (event.dataTransfer.files && event.dataTransfer.files[0]) {
        file = event.dataTransfer.files[0];
      }
    } else { // Change event
      if (event.target.files && event.target.files[0]) {
        file = event.target.files[0];
      }
    }

    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
          setError("File is too large. Please upload files under 5MB.");
          if (fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
          return;
      }
      const allowedTypes = ["text/csv", "text/plain", "text/tab-separated-values"];
      const allowedExtensions = [".csv", ".txt", ".tsv"];
      if (!allowedTypes.includes(file.type) && !allowedExtensions.some(ext => file!.name.toLowerCase().endsWith(ext))) {
          setError(`Invalid file type: ${file.name}. Please upload a CSV, TXT, or TSV file.`);
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
      }

      setLoading(true);
      setLoadingMessage(`Reading file: ${file.name}...`);
      setProgress(10);

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const textContent = e.target?.result as string;
          setLoadingMessage(`Extracting data with AI from ${file?.name}...`);
          setProgress(30);
          
          const extractedPosts = await extractSocialDataFromFileAPI(textContent, file?.name || 'uploaded_file');
          
          if (!extractedPosts || extractedPosts.length === 0) {
            setError("AI could not extract any relevant social media data from the file, or the file is empty. Please check the file content and try again.");
            setData([]);
            setLoading(false);
            setProgress(0);
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
          }
          
          setLoadingMessage("Processing media URLs (this may take a moment)...");
          setProgress(60);

          // Process media URLs
          const postsWithMediaData: InstagramPost[] = await Promise.all(
            extractedPosts.map(async (post, index) => {
              let mediaData: string | undefined = undefined;
              let mediaType: InstagramPost['mediaType'] = 'unknown';

              if (post.mediaUrl) {
                if (/\.(jpeg|jpg|gif|png|webp)$/i.test(post.mediaUrl)) {
                  mediaType = 'image';
                  try {
                    const imageResult = await fetchAndProcessImage(post.mediaUrl);
                    if (imageResult) {
                      mediaData = imageResult.base64Data;
                    } else {
                       console.warn(`Could not fetch or process image: ${post.mediaUrl}`);
                    }
                  } catch (imgError) {
                    console.warn(`Error processing image ${post.mediaUrl}:`, imgError);
                  }
                } else if (/\.(mp4|mov|avi|mkv|webm)$/i.test(post.mediaUrl)) {
                  mediaType = 'video';
                }
              }
              setProgress(60 + Math.floor((index / extractedPosts.length) * 30)); // Progress for media fetching
              return { 
                ...post,
                id: post.id || `post-${Date.now()}-${index}`, // Ensure ID
                mediaData, 
                mediaType 
              } as InstagramPost;
            })
          );
          
          setData(postsWithMediaData);
          setActiveTab('data');
          setError('');
        } catch (err: any) {
          setError(`Error processing file with AI: ${err.message}. Ensure your API Key is correctly configured.`);
          setData([]);
        } finally {
          setLoading(false);
          setProgress(0);
          if (fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
        }
      };
      reader.onerror = () => {
          setError(`Failed to read file: ${file?.name}.`);
          setLoading(false);
          setProgress(0);
          if (fileInputRef.current) fileInputRef.current.value = "";
      }
      reader.readAsText(file);
    }
  };

  const loadSampleData = async () => {
    setError('');
    setLoading(true);
    setLoadingMessage("Loading sample data and processing media...");
    setProgress(20);
    // Simulate media processing for sample data
    const processedSampleData = await Promise.all(SAMPLE_DATA.map(async (post, index) => {
        let mediaData: string | undefined = undefined;
        if (post.mediaUrl && post.mediaType === 'image') {
            try {
                const imageResult = await fetchAndProcessImage(post.mediaUrl);
                if (imageResult) mediaData = imageResult.base64Data;
            } catch (e) { console.warn("Sample data image fetch failed (likely CORS for picsum):", e)}
        }
        setProgress(20 + Math.floor((index / SAMPLE_DATA.length) * 70));
        return { ...post, mediaData };
    }));
    setData(processedSampleData);
    setActiveTab('data');
    setInsights(null);
    setGeneratedContentIdeas([]);
    setLoading(false);
    setProgress(0);
  };

  const generateInsights = async () => {
    if (data.length === 0) {
      setError("No data to analyze. Please upload data first.");
      return;
    }
    setLoading(true);
    setLoadingMessage("Generating AI Insights (may take a moment)...")
    setError('');
    setProgress(30);
    try {
      const result = await generateInsightsAPI(data);
      setProgress(70);
      if (result) {
        setInsights(result);
        setActiveTab('insights');
        setGeneratedContentIdeas([]); // Clear old ideas when new insights are generated
      } else {
        setError('Failed to parse insights from AI. The response might not be in the expected JSON format or was empty. Please check console for details.');
      }
    } catch (err: any) {
      setError(err.message || 'Error generating insights. Ensure API Key is valid and you have internet connectivity.');
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const generateNewContentIdeas = async () => {
    if (!insights) {
       setError("Please generate insights first to get content ideas.");
       return;
    }
    setLoading(true);
    setLoadingMessage("Generating AI Content Ideas...");
    setError('');
    setProgress(30);
    try {
      // Pass current count of generated ideas if we want to append, or 0 to get a fresh batch
      const ideas = await generateContentIdeasAPI(insights, generatedContentIdeas.length);
      setProgress(70);
      if (ideas && ideas.length > 0) {
        // Filter out any ideas that might already be in generatedContentIdeas by ID to prevent duplicates if re-generating
        const newIdeas = ideas.filter(newIdea => !generatedContentIdeas.find(existing => existing.id === newIdea.id));
        setGeneratedContentIdeas(prevIdeas => [...prevIdeas, ...newIdeas]);
        // If you always want to replace: setGeneratedContentIdeas(ideas);
        setActiveTab('notebook'); // Switch to notebook to show newly generated ideas
      } else if (ideas && ideas.length === 0) {
        setError('AI generated 0 new ideas. You might have reached the typical limit, or try refining existing insights.');
      }
      else {
        setError('Failed to parse content ideas from AI. The response might not be in the expected JSON format or was empty. Check console for details.');
      }
    } catch (err: any) {
      setError(err.message || 'Error generating content ideas');
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const handleCreateCampaign = () => {
    if (!newCampaignName.trim()) {
      setError("Campaign name cannot be empty.");
      return;
    }
    const newCampaign: Campaign = {
      id: `campaign-${Date.now()}`,
      name: newCampaignName.trim(),
      ideas: [],
      createdAt: new Date().toISOString(),
    };
    setCampaigns(prev => [...prev, newCampaign]);
    setNewCampaignName('');
    setSelectedCampaignId(newCampaign.id); // Auto-select new campaign
    setError('');
  };

  const handleSaveIdeaToCampaign = (idea: ContentIdea, campaignId: string | null) => {
    if (!campaignId) {
        setError("Please select or create a campaign to save this idea.");
        // Consider opening a campaign selection modal here
        // For now, we will assume a campaign must be selected or this function is called from a context where it's known.
        // If called from generated ideas list, prompt for campaign.
        // A simple way: If no campaign selected, prompt to create one or select one.
        alert("Please select a campaign from the Notebook tab or create a new one first!");
        setActiveTab('notebook'); // Guide user to notebook
        return;
    }

    setCampaigns(prevCampaigns => 
      prevCampaigns.map(campaign => {
        if (campaign.id === campaignId) {
          // Check if idea already exists in this campaign to prevent duplicates
          if (campaign.ideas.find(i => i.id === idea.id)) {
            return campaign; // Idea already exists, do nothing or update
          }
          return { ...campaign, ideas: [...campaign.ideas, { ...idea, campaignId: campaign.id }] };
        }
        return campaign;
      })
    );
    // Remove from generated ideas list if it was there
    setGeneratedContentIdeas(prev => prev.filter(gi => gi.id !== idea.id));
  };
  
  const handleUpdateIdeaInCampaign = (updatedIdea: ContentIdea) => {
    if (!updatedIdea.campaignId) {
      setError("Cannot update idea: Campaign ID is missing.");
      return;
    }
    setCampaigns(prevCampaigns =>
      prevCampaigns.map(campaign =>
        campaign.id === updatedIdea.campaignId
          ? { ...campaign, ideas: campaign.ideas.map(i => i.id === updatedIdea.id ? updatedIdea : i) }
          : campaign
      )
    );
    setEditingIdea(null); // Close editing modal/form
  };

  const handleDeleteIdeaFromCampaign = (ideaId: string, campaignId: string) => {
    setCampaigns(prevCampaigns =>
      prevCampaigns.map(campaign =>
        campaign.id === campaignId
          ? { ...campaign, ideas: campaign.ideas.filter(i => i.id !== ideaId) }
          : campaign
      )
    );
  };
  
  const handleDeleteCampaign = (campaignId: string) => {
    if (window.confirm("Are you sure you want to delete this campaign and all its ideas? This action cannot be undone.")) {
      setCampaigns(prev => prev.filter(c => c.id !== campaignId));
      if (selectedCampaignId === campaignId) {
        setSelectedCampaignId(null);
      }
    }
  };

  const handleInitiateRefinement = (idea: ContentIdea) => {
    setEditingIdea(idea); // Re-using editingIdea state to hold the idea being refined
    setRefinementGoal(''); // Clear previous goal
    // (Modal for refinement goal input would open here)
  };

  const handleRefineIdea = async () => {
    if (!editingIdea || !refinementGoal.trim()) {
      setError("Please select an idea and provide a refinement goal.");
      return;
    }
    setIsRefining(true);
    setError('');
    try {
      const refined = await refineContentIdeaAPI(editingIdea, refinementGoal);
      if (refined) {
        // Ensure the refined idea keeps its original campaignId
        handleUpdateIdeaInCampaign({ ...refined, campaignId: editingIdea.campaignId });
        setRefinementGoal(''); // Clear goal
        // Close refinement modal if separate, or clear fields
        setEditingIdea(null); // Clear editing state which closes modal
      } else {
        setError("AI could not refine the idea, or the response was malformed.");
      }
    } catch (err: any) {
      setError(`Refinement error: ${err.message}`);
    } finally {
      setIsRefining(false);
    }
  };

  const exportData = (type: 'insights' | 'notebook') => {
    let exportObject: any;
    let fileName = `social_analysis_${new Date().toISOString().split('T')[0]}`;

    if (type === 'insights') {
        if (!insights && generatedContentIdeas.length === 0) {
            setError("No insights or initially generated content ideas to export.");
            return;
        }
        exportObject = {
            sourceDataSummary: {
                totalPosts: data.length,
                sampleUsed: data.length > 0 && data[0].id.startsWith('sample-'),
            },
            generatedInsights: insights,
            initiallyGeneratedContentIdeas: generatedContentIdeas, // Ideas before saving to notebook
            exportedAt: new Date().toISOString(),
        };
        fileName += '_insights.json';
    } else { // notebook
        if (campaigns.length === 0) {
            setError("No campaigns in the notebook to export.");
            return;
        }
        exportObject = {
            notebook: {
                campaigns: campaigns,
            },
            exportedAt: new Date().toISOString(),
        };
        fileName += '_notebook.json';
    }

    const jsonString = JSON.stringify(exportObject, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setError('');
  };


  const renderTabContent = () => {
    switch (activeTab) {
      case 'upload':
        return (
          <div className="max-w-2xl mx-auto">
            <div 
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-cyan-400', 'bg-white/5');}}
              onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-cyan-400', 'bg-white/5');}}
              onDrop={(e) => { handleFileUpload(e); e.currentTarget.classList.remove('border-cyan-400', 'bg-white/5');}}
              className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 border border-white/20 shadow-2xl transition-all"
            >
              <div className="text-center mb-6">
                <div className="relative inline-block">
                  <Upload className="h-16 w-16 mx-auto mb-4 text-cyan-400" />
                  <div className="absolute -top-2 -right-2 bg-purple-500 rounded-full p-2 shadow-lg"> <Sparkles className="h-5 w-5 text-yellow-300" /> </div>
                </div>
                <h2 className="text-2xl font-semibold mb-2 text-gray-100">Upload Social Media Data</h2>
                <p className="text-gray-300 text-sm"> Drop a CSV, TXT, or TSV file. Gemini AI will intelligently parse it. </p>
              </div>
              
              <label htmlFor="file-upload" className="border-2 border-dashed border-white/30 rounded-lg p-8 text-center hover:border-cyan-400 transition-colors cursor-pointer mb-6 block hover:bg-white/5">
                <input ref={fileInputRef} type="file" accept=".csv,.txt,.tsv,text/csv,text/plain,text/tab-separated-values" onChange={handleFileUpload} className="hidden" id="file-upload"/>
                <Upload className="h-8 w-8 mx-auto text-cyan-400 mb-2" />
                <p className="text-lg font-semibold text-gray-200">Drag & drop your file here</p>
                <p className="text-gray-400 text-sm mt-1">or click to browse files</p>
                <p className="text-gray-500 text-xs mt-4">Max file size 5MB. Supported: CSV, TXT, TSV.</p>
              </label>
              
              <div className="text-center">
                <div className="inline-flex items-center mb-6 w-full">
                  <div className="h-px bg-gray-600 flex-grow"></div> <span className="mx-4 text-gray-400 text-sm">OR</span> <div className="h-px bg-gray-600 flex-grow"></div>
                </div>
                <p className="text-gray-300 mb-3 text-sm">Don't have a file? Explore with sample data.</p>
                <button onClick={loadSampleData} className="bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-3 rounded-lg font-semibold text-white hover:from-purple-600 hover:to-pink-600 transition-all duration-300 transform hover:scale-105 inline-flex items-center shadow-md">
                  <Sparkles className="mr-2 h-4 w-4" /> Use Sample Data
                </button>
              </div>
            </div>
             <div className="mt-6 text-center text-xs text-gray-400 max-w-md mx-auto">
                Note: Media URL processing attempts to fetch images. Success depends on CORS policies of the source sites. Videos are analyzed by URL and context.
            </div>
          </div>
        );
      case 'data':
        if (data.length === 0) return <EmptyState icon={<BarChart3 className="h-16 w-16 text-cyan-400" />} title="No Data Extracted" message="Upload your social media data file (CSV, TXT, TSV) or use sample data. Gemini AI will extract insights." actionButtonLabel="Upload Data" onAction={() => setActiveTab('upload')} actionButtonIcon={<Upload className="mr-2 h-4 w-4" />} buttonGradient="from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"/>;
        return (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-gray-100">Extracted Data Overview</h2>
                <p className="text-gray-400 text-sm">{data.length} posts extracted • Ready for AI Insights</p>
              </div>
              <div className="flex gap-4">
                <button onClick={() => setActiveTab('upload')} className="bg-white/10 px-4 py-2 rounded-lg font-medium text-gray-200 hover:bg-white/20 transition-colors text-sm flex items-center"><Upload className="inline mr-2 h-4 w-4" />Upload New File</button>
                <button onClick={generateInsights} disabled={loading} className="bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 rounded-lg font-semibold text-white hover:from-cyan-600 hover:to-blue-600 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none flex items-center shadow-md"><Brain className="mr-2 h-4 w-4" />{loading ? 'Analyzing...' : 'Generate AI Insights'}</button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
              <StatCard title="Total Posts" value={data.length} icon={<BarChart3 />} colorClass="text-cyan-400 border-cyan-500/30" />
              <StatCard title="Avg. Comments" value={ (data.reduce((sum, item) => sum + (Number(item.comments) || 0), 0) / data.length || 0).toFixed(1)} icon={<MessageCircle />} colorClass="text-purple-400 border-purple-500/30" />
              <StatCard title="Avg. Likes" value={ (data.reduce((sum, item) => sum + (Number(item.likes) || 0), 0) / data.length || 0).toFixed(1)} icon={<Heart />} colorClass="text-pink-400 border-pink-500/30" />
              <StatCard title="Posts with Media" value={data.filter(p => p.mediaUrl).length} icon={<FileText />} colorClass="text-blue-400 border-blue-500/30" />
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden shadow-xl">
              <div className="p-4 border-b border-white/10 flex justify-between items-center">
                <h3 className="font-semibold text-gray-100">Extracted Posts (Showing up to 20)</h3>
                <div className="relative">
                  <input type="text" placeholder="Search captions, users, ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 pl-10 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent w-64" />
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>
              </div>
              <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full">
                  <thead className="bg-white/10 sticky top-0 backdrop-blur-md z-10"><tr className="border-b border-white/10">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">User</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Comments</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Likes</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider w-2/5">Caption Preview</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Media</th>
                  </tr></thead>
                  <tbody className="divide-y divide-white/10">
                    {filteredData.map((item) => (
                      <tr key={item.id} className="hover:bg-white/5 transition-colors duration-150">
                        <td className="px-4 py-3 text-xs text-gray-400" title={item.id}>{item.id.substring(0,15)}...</td>
                        <td className="px-4 py-3 text-sm text-cyan-300 font-medium whitespace-nowrap">
                          <div className="flex items-center">
                            {item.mediaData && item.mediaType === 'image' ? (
                                <img src={`data:image/jpeg;base64,${item.mediaData}`} alt={item.username || 'Post image'} className="w-8 h-8 rounded-md mr-3 object-cover border border-cyan-700/50"/>
                            ) : item.mediaType === 'video' ? (
                                <div className="w-8 h-8 rounded-md mr-3 bg-purple-500/30 flex items-center justify-center text-purple-300">V</div>
                            ) : (
                                <div className="w-8 h-8 rounded-md mr-3 bg-gray-500/30 flex items-center justify-center text-gray-300">?</div>
                            )}
                            {item.username || 'N/A'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-200">{typeof item.comments === 'number' ? item.comments : <span className="text-gray-500">N/A</span>}</td>
                        <td className="px-4 py-3 text-sm text-gray-200">{typeof item.likes === 'number' ? item.likes : <span className="text-gray-500">N/A</span>}</td>
                        <td className="px-4 py-3 text-sm text-gray-300"><div className="line-clamp-2" title={item.postCaption}>{item.postCaption || <span className="text-gray-500">No caption</span>}</div></td>
                        <td className="px-4 py-3 text-sm">
                          {item.postUrl && <a href={item.postUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-pink-400 hover:text-pink-300 transition-colors mr-2" title="View Original Post"><ExternalLink className="h-4 w-4" /></a>}
                          {item.mediaUrl && <a href={item.mediaUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-teal-400 hover:text-teal-300 transition-colors" title="View Original Media"><FileText className="h-4 w-4" /></a>}
                          {(!item.postUrl && !item.mediaUrl) && <span className="text-gray-500 text-xs">No links</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
               {filteredData.length === 0 && searchTerm && <p className="p-4 text-center text-gray-400">No posts match your search criteria.</p>}
               {filteredData.length === 0 && !searchTerm && data.length > 0 && <p className="p-4 text-center text-gray-400">No data to display. This could be due to filtering or data issues.</p>}
            </div>
          </div>
        );
      case 'insights':
        if (!insights) return <EmptyState icon={<Brain className="h-16 w-16 text-purple-400" />} title="No Insights Generated" message="Analyze your social media data with Gemini AI to discover engagement patterns, content themes (including visual analysis if images were processed!), and audience preferences." actionButtonLabel="Analyze Data" onAction={generateInsights} actionButtonIcon={<BarChart3 className="mr-2 h-4 w-4" />} buttonGradient="from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"/>;
        return (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div><h2 className="text-2xl font-semibold text-gray-100">AI-Generated Insights</h2><p className="text-gray-400 text-sm">Powered by Gemini ({API_MODEL_TEXT}) • Based on {data.length} posts</p></div>
              <div className="flex gap-4">
                <button onClick={generateNewContentIdeas} disabled={loading} className="bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-3 rounded-lg font-semibold text-white hover:from-purple-600 hover:to-pink-600 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 flex items-center shadow-md"><Sparkles className="mr-2 h-4 w-4" />Generate Content Ideas</button>
                <button onClick={() => exportData('insights')} className="bg-gradient-to-r from-green-500 to-teal-500 px-4 py-2 rounded-lg font-semibold text-white hover:from-green-600 hover:to-teal-600 transition-all duration-300 flex items-center text-sm shadow-md"><Download className="mr-2 h-4 w-4" />Export Insights</button>
              </div>
            </div>
            {/* Engagement, Content, Audience, Recommendations Sections (similar structure to previous, update with new fields) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Engagement Patterns */}
              <div className="bg-gradient-to-br from-cyan-600/20 to-blue-700/20 backdrop-blur-sm rounded-xl p-6 border border-cyan-500/30 shadow-xl">
                <h3 className="text-xl font-semibold mb-4 text-cyan-300 flex items-center"><TrendingUp className="mr-2 h-5 w-5" />Engagement Patterns</h3>
                <div className="space-y-4">
                  <div className="flex justify-around">
                    <div className="text-center"><p className="text-gray-300 text-sm">Avg. Comments</p><p className="text-2xl font-bold text-cyan-400">{insights.engagementPatterns?.averageComments ?? 'N/A'}</p></div>
                    <div className="text-center"><p className="text-gray-300 text-sm">Avg. Likes</p><p className="text-2xl font-bold text-pink-400">{insights.engagementPatterns?.averageLikes ?? 'N/A'}</p></div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-lg border border-white/10"><div className="flex justify-between items-center mb-1"><span className="text-gray-300 text-sm">Engagement Rate</span><span className="text-lg font-semibold text-purple-400">{insights.engagementPatterns?.engagementRate ?? 'N/A'}</span></div></div>
                  <div><p className="text-gray-300 text-sm mb-2">Top Performing Posts</p><div className="space-y-2">
                      {(insights.engagementPatterns?.topPerformers || []).slice(0,3).map((post, idx) => (
                        <div key={idx} className="flex items-start justify-between bg-white/5 p-3 rounded-lg border border-white/10 hover:bg-white/10">
                          <div className="flex-1">
                            <p className="font-medium text-cyan-300 text-sm">@{post.username || 'N/A'}</p>
                            <p className="text-xs text-gray-400 line-clamp-1" title={post.captionPreview}>{post.captionPreview}</p>
                            {post.postUrl && <a href={post.postUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-pink-400 hover:underline">View Post <ExternalLink size={12} className="inline-block"/></a>}
                          </div>
                          <div className="ml-2 text-right flex-shrink-0">
                            <span className="block text-xs text-gray-300">{post.comments || 0} <MessageCircle size={12} className="inline text-purple-400"/></span>
                            <span className="block text-xs text-gray-300">{post.likes || 0} <Heart size={12} className="inline text-pink-400"/></span>
                          </div>
                        </div>
                      ))}
                      {(!insights.engagementPatterns?.topPerformers || insights.engagementPatterns.topPerformers.length === 0) && <p className="text-gray-400 text-xs">No top performers identified.</p>}
                      </div></div>
                </div>
              </div>
              {/* Content Analysis */}
              <div className="bg-gradient-to-br from-purple-600/20 to-pink-700/20 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30 shadow-xl">
                <h3 className="text-xl font-semibold mb-4 text-purple-300 flex items-center"><FileText className="mr-2 h-5 w-5" />Content Analysis</h3>
                <div className="space-y-5">
                  <div><p className="text-gray-300 text-sm mb-2">Top Content Categories</p><div className="flex flex-wrap gap-2">
                      {(insights.contentAnalysis?.topCategories || []).map((category, idx) => (<span key={idx} className={`px-3 py-1 rounded-full text-xs font-medium border ${CATEGORY_COLORS[idx % CATEGORY_COLORS.length].replace('bg-', 'border-')}`}> {category}</span>))}
                      {(!insights.contentAnalysis?.topCategories || insights.contentAnalysis.topCategories.length === 0) && <p className="text-gray-400 text-xs">No categories identified.</p>}
                      </div></div>
                  <div><p className="text-gray-300 text-sm mb-1">Caption Insights</p><p className="text-gray-200 text-sm leading-relaxed">{insights.contentAnalysis?.captionInsights ?? 'N/A'}</p></div>
                  <div><p className="text-gray-300 text-sm mb-2">Visual Themes</p><div className="flex flex-wrap gap-2">
                      {(insights.contentAnalysis?.visualThemes || []).map((theme, idx) => (<span key={idx} className={`px-3 py-1 rounded-full text-xs ${CATEGORY_COLORS[(idx + 2) % CATEGORY_COLORS.length]}`}>{theme}</span>))}
                      {(!insights.contentAnalysis?.visualThemes || insights.contentAnalysis.visualThemes.length === 0) && <p className="text-gray-400 text-xs">No specific visual themes identified or images not analyzed.</p>}
                      </div></div>
                  <div><p className="text-gray-300 text-sm mb-1">Media Effectiveness</p><p className="text-gray-200 text-sm leading-relaxed">{insights.contentAnalysis?.mediaEffectiveness ?? 'N/A'}</p></div>
                  <div><p className="text-gray-300 text-sm mb-2">Audio Trends</p><div className="flex flex-wrap gap-2">
                      {(insights.contentAnalysis?.audioTrends || []).map((trend, idx) => (<span key={idx} className="px-3 py-1 rounded-full text-xs bg-pink-500/30 text-pink-200 border border-pink-500/50">{trend}</span>))}
                      {(!insights.contentAnalysis?.audioTrends || insights.contentAnalysis.audioTrends.length === 0) && <p className="text-gray-400 text-xs">No audio trends identified.</p>}
                      </div></div>
                </div>
              </div>
              {/* Audience Insights */}
              <div className="bg-gradient-to-br from-pink-600/20 to-red-700/20 backdrop-blur-sm rounded-xl p-6 border border-pink-500/30 shadow-xl col-span-1 lg:col-span-2">
                <h3 className="text-xl font-semibold mb-4 text-pink-300 flex items-center"><Users className="mr-2 h-5 w-5" />Audience Insights</h3>
                <div className="grid md:grid-cols-3 gap-5">
                    <div><p className="text-gray-300 text-sm mb-1">Peak Engagement Hours</p><p className="text-pink-200 font-semibold text-lg">{insights.audienceInsights?.peakEngagementHours ?? 'N/A'}</p></div>
                    <div>
                        <p className="text-gray-300 text-sm mb-2">Preferred Content Types</p>
                        <div className="flex flex-col space-y-1">
                        {insights.audienceInsights?.preferredContentTypes?.length > 0 ? (
                            insights.audienceInsights.preferredContentTypes.map((type, idx) => (
                            <div key={idx} className="p-2 rounded-lg bg-white/5 border border-white/10 flex items-center text-sm text-gray-200 text-xs">
                                <div className={`h-2 w-2 rounded-full mr-2 ${CATEGORY_COLORS[idx % CATEGORY_COLORS.length].split(' ')[0]}`}></div>
                                {type}
                            </div>
                            ))
                        ) : (
                            <p className="text-gray-400 text-xs">Not available or no specific types identified.</p>
                        )}
                        </div>
                    </div>
                    <div><p className="text-gray-300 text-sm mb-1">Demographic Trends</p><p className="text-gray-200 text-sm leading-relaxed">{insights.audienceInsights?.demographicTrends ?? 'N/A'}</p></div>
                </div>
              </div>
              {/* Recommendations */}
              <div className="bg-gradient-to-br from-green-600/20 to-teal-700/20 backdrop-blur-sm rounded-xl p-6 border border-teal-500/30 shadow-xl col-span-1 lg:col-span-2">
                <h3 className="text-xl font-semibold mb-4 text-teal-300 flex items-center"><Target className="mr-2 h-5 w-5" />Actionable Recommendations</h3>
                <ul className="space-y-3 list-decimal list-inside">
                  {(insights.recommendations || []).map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                      <span className="text-teal-300 font-semibold">{idx + 1}.</span>
                      <p className="text-gray-200 text-sm leading-relaxed flex-1">{rec}</p>
                    </li>))}
                  {(!insights.recommendations || insights.recommendations.length === 0) && <p className="text-gray-400 text-xs">No recommendations available.</p>}
                </ul>
              </div>
            </div>
          </div>
        );
      case 'notebook':
        const currentCampaign = campaigns.find(c => c.id === selectedCampaignId);
        return (
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                    <div>
                        <h2 className="text-2xl font-semibold text-gray-100 flex items-center"><BookOpen className="mr-3 text-cyan-400" />Smart Notebook</h2>
                        <p className="text-gray-400 text-sm">Organize campaigns, save & refine content ideas.</p>
                    </div>
                    <div className="flex gap-2">
                       {insights && <button onClick={generateNewContentIdeas} disabled={loading} className="bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2 rounded-lg font-semibold text-white hover:from-purple-600 hover:to-pink-600 transition-colors text-sm flex items-center shadow-md"><Sparkles className="mr-2 h-4 w-4" />Generate New Ideas</button>}
                       <button onClick={() => exportData('notebook')} className="bg-gradient-to-r from-green-500 to-teal-500 px-4 py-2 rounded-lg font-semibold text-white hover:from-green-600 hover:to-teal-600 transition-colors text-sm flex items-center shadow-md"><Download className="mr-2 h-4 w-4" />Export Notebook</button>
                    </div>
                </div>

                {/* Display generated ideas if not yet saved */}
                {generatedContentIdeas.length > 0 && (
                    <div className="mb-8 p-6 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
                        <h3 className="text-lg font-semibold text-yellow-300 mb-4">New AI Generated Ideas (unsaved)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {generatedContentIdeas.map(idea => (
                                <ContentIdeaCardComponent 
                                    key={idea.id} 
                                    idea={idea} 
                                    onSaveToNotebook={() => {
                                        if (!selectedCampaignId && campaigns.length > 0) {
                                            alert("Please select a campaign from the list below to save this idea, or create a new one.");
                                            return;
                                        }
                                        if (campaigns.length === 0) {
                                            alert("Please create a campaign first to save this idea.");
                                            return;
                                        }
                                        handleSaveIdeaToCampaign(idea, selectedCampaignId || campaigns[0].id ); // Default to first campaign if none selected but campaigns exist
                                    }}
                                    isSaved={false} // These are by definition unsaved
                                />
                            ))}
                        </div>
                        {campaigns.length > 0 && !selectedCampaignId && <p className="text-xs text-yellow-200 mt-3">Hint: Select a campaign below to save these ideas into it, or the first campaign will be used.</p>}
                         {campaigns.length === 0 && <p className="text-xs text-yellow-200 mt-3">Hint: Create a campaign below to save these ideas.</p>}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Campaigns List & Creation */}
                    <div className="md:col-span-1 space-y-4">
                        <div className="bg-white/10 p-4 rounded-lg border border-white/20">
                            <h3 className="text-lg font-semibold text-gray-200 mb-3">Campaigns</h3>
                            <div className="flex gap-2 mb-4">
                                <input 
                                    type="text" 
                                    value={newCampaignName} 
                                    onChange={(e) => setNewCampaignName(e.target.value)}
                                    placeholder="New campaign name"
                                    className="flex-grow bg-white/5 border border-white/20 rounded-md px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                />
                                <button onClick={handleCreateCampaign} className="bg-cyan-500 hover:bg-cyan-600 text-white px-3 py-2 rounded-md text-sm font-semibold flex items-center"><FolderPlus size={16} className="mr-1.5"/>Create</button>
                            </div>
                            {campaigns.length === 0 && <p className="text-sm text-gray-400">No campaigns yet. Create one to start organizing ideas!</p>}
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {campaigns.map(campaign => (
                                    <div 
                                        key={campaign.id} 
                                        onClick={() => setSelectedCampaignId(campaign.id)}
                                        className={`p-3 rounded-md cursor-pointer transition-all ${selectedCampaignId === campaign.id ? 'bg-cyan-600/50 border-cyan-400 scale-105' : 'bg-white/5 hover:bg-white/10 border-transparent'} border-2`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium text-gray-100">{campaign.name}</span>
                                            <span className="text-xs text-gray-400">{campaign.ideas.length} ideas</span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-0.5">Created: {new Date(campaign.createdAt).toLocaleDateString()}</p>
                                         {selectedCampaignId === campaign.id && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteCampaign(campaign.id); }}
                                                className="mt-1 text-xs text-red-400 hover:text-red-300 flex items-center"
                                                aria-label="Delete campaign"
                                            >
                                                <XCircle size={12} className="mr-1"/> Delete Campaign
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Selected Campaign Ideas */}
                    <div className="md:col-span-2 bg-white/10 p-6 rounded-lg border border-white/20 min-h-[300px]">
                        {currentCampaign ? (
                            <>
                                <h3 className="text-xl font-semibold text-gray-100 mb-1">{currentCampaign.name} - Content Ideas</h3>
                                <p className="text-sm text-gray-400 mb-4">Manage and refine ideas for this campaign.</p>
                                {currentCampaign.ideas.length === 0 && <p className="text-gray-400">No ideas saved in this campaign yet. Generate or save some!</p>}
                                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                                    {currentCampaign.ideas.map(idea => (
                                        <div key={idea.id} className="bg-purple-700/10 p-4 rounded-lg border border-purple-500/30 shadow-md">
                                            <h4 className="font-semibold text-purple-300 text-md mb-1">{idea.title}</h4>
                                            <p className="text-xs text-gray-300 mb-1 line-clamp-2">{idea.description}</p>
                                            <div className="flex flex-wrap gap-1 my-2">
                                                <span className="text-xs bg-purple-500/30 text-purple-200 px-2 py-0.5 rounded-full">{idea.type}</span>
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${idea.estimatedEngagement === 'High' ? 'bg-green-500/30 text-green-200' : idea.estimatedEngagement === 'Medium' ? 'bg-yellow-500/30 text-yellow-200' : 'bg-blue-500/30 text-blue-200'}`}>{idea.estimatedEngagement} Engagement</span>
                                            </div>
                                            <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2">
                                                <button onClick={() => { setEditingIdea(idea); setRefinementGoal(''); /* This will open the modal */}} className="text-xs bg-yellow-500/30 text-yellow-200 px-3 py-1.5 rounded-md hover:bg-yellow-500/40 transition-colors flex items-center"><Sparkles size={14} className="mr-1"/>Refine w/ AI</button>
                                                <button onClick={() => { setEditingIdea(idea); /* This will open the modal in edit mode */ }} className="text-xs bg-blue-500/30 text-blue-200 px-3 py-1.5 rounded-md hover:bg-blue-500/40 transition-colors flex items-center"><Edit3 size={14} className="mr-1"/>Edit</button>
                                                <button onClick={() => handleDeleteIdeaFromCampaign(idea.id, currentCampaign.id)} className="text-xs bg-red-500/30 text-red-200 px-3 py-1.5 rounded-md hover:bg-red-500/40 transition-colors flex items-center"><XCircle size={14} className="mr-1"/>Delete</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <BookOpen size={48} className="text-gray-500 mb-4" />
                                <p className="text-lg text-gray-300">Select a campaign to view its ideas</p>
                                <p className="text-sm text-gray-400">or create a new campaign to get started.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );

      default: return null;
    }
  };

  const tabButtonWidth = "w-[calc(25%-6px)]"; // Adjusted for 4 tabs with spacing
  const activeTabIndex = TABS.findIndex(tab => tab.id === activeTab);
  const indicatorOffset = `calc(${activeTabIndex * 25}% + ${activeTabIndex * 2 + 3}px)`; // 25% per tab, adjust for padding/margins


  // Modal for Editing/Refining Idea
  const renderEditRefineModal = () => {
    if (!editingIdea) return null;

    const isRefineMode = refinementGoal !== undefined; // Check if refinement is active
    
    const currentIdeaToEdit = { ...editingIdea }; // Make a mutable copy

    const handleFieldChange = (field: keyof ContentIdea, value: any) => {
        setEditingIdea(prev => prev ? ({ ...prev, [field]: value }) : null);
    };
    
    const handleHashtagChange = (index: number, value: string) => {
        const newHashtags = [...(currentIdeaToEdit.hashtags || [])];
        newHashtags[index] = value;
        handleFieldChange('hashtags', newHashtags);
    };
    const addHashtagField = () => handleFieldChange('hashtags', [...(currentIdeaToEdit.hashtags || []), '']);
    const removeHashtagField = (index: number) => handleFieldChange('hashtags', (currentIdeaToEdit.hashtags || []).filter((_, i) => i !== index));


    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-gradient-to-br from-indigo-800 to-purple-900 p-6 rounded-xl shadow-2xl border border-white/20 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-cyan-300">{isRefineMode && refinementGoal !== null ? 'Refine Idea with AI' : 'Edit Content Idea'}</h3>
                    <button onClick={() => { setEditingIdea(null); setRefinementGoal('');}} className="text-gray-400 hover:text-white"><XCircle size={24}/></button>
                </div>
                
                {/* Refinement Goal Input (only if in refinement mode initiation) */}
                { isRefineMode && !isRefining && refinementGoal === '' && (
                     <div className="mb-4">
                        <label htmlFor="refinementGoal" className="block text-sm font-medium text-gray-300 mb-1">What do you want to refine about "{editingIdea.title}"?</label>
                        <textarea 
                            id="refinementGoal"
                            value={refinementGoal}
                            onChange={(e) => setRefinementGoal(e.target.value)}
                            placeholder="e.g., 'Make the title catchier', 'Suggest 3 alternative visual concepts', 'Focus more on sustainability aspect'"
                            className="w-full bg-white/10 border border-white/20 rounded-md px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 min-h-[80px]"
                        />
                        <button 
                            onClick={handleRefineIdea} 
                            disabled={!refinementGoal.trim() || isRefining}
                            className="mt-3 w-full bg-gradient-to-r from-yellow-500 to-orange-500 px-6 py-2.5 rounded-lg font-semibold text-white hover:from-yellow-600 hover:to-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center"
                        >
                            {isRefining ? <Loader className="animate-spin mr-2" size={20}/> : <Sparkles size={18} className="mr-2"/>}
                            {isRefining ? 'Refining...' : 'Refine with AI'}
                        </button>
                    </div>
                )}

                {/* Display during AI Refinement */}
                 {isRefineMode && isRefining && (
                    <div className="text-center py-8">
                        <Loader className="animate-spin h-12 w-12 text-yellow-400 mx-auto mb-4"/>
                        <p className="text-yellow-300">Gemini AI is refining your idea based on: "{refinementGoal}"...</p>
                    </div>
                )}

                {/* Edit Form (shown if not actively refining OR if refinement goal input is hidden) */}
                {(!isRefineMode || refinementGoal === null || (isRefineMode && !isRefining && refinementGoal !== '')) && !isRefining && (
                    <form onSubmit={(e) => { e.preventDefault(); if (editingIdea) handleUpdateIdeaInCampaign(editingIdea); }} className="space-y-4">
                        <div>
                            <label htmlFor="editTitle" className="block text-sm font-medium text-gray-300">Title</label>
                            <input type="text" id="editTitle" value={currentIdeaToEdit.title} onChange={(e) => handleFieldChange('title', e.target.value)} className="mt-1 w-full bg-white/10 border border-white/20 rounded-md px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"/>
                        </div>
                        <div>
                            <label htmlFor="editDescription" className="block text-sm font-medium text-gray-300">Description</label>
                            <textarea id="editDescription" value={currentIdeaToEdit.description} onChange={(e) => handleFieldChange('description', e.target.value)} rows={3} className="mt-1 w-full bg-white/10 border border-white/20 rounded-md px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"></textarea>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="editType" className="block text-sm font-medium text-gray-300">Type</label>
                                <input type="text" id="editType" value={currentIdeaToEdit.type} onChange={(e) => handleFieldChange('type', e.target.value)} className="mt-1 w-full bg-white/10 border border-white/20 rounded-md px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"/>
                            </div>
                            <div>
                                <label htmlFor="editEngagement" className="block text-sm font-medium text-gray-300">Est. Engagement</label>
                                <select id="editEngagement" value={currentIdeaToEdit.estimatedEngagement} onChange={(e) => handleFieldChange('estimatedEngagement', e.target.value as ContentIdea['estimatedEngagement'])} className="mt-1 w-full bg-white/10 border border-white/20 rounded-md px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-cyan-500">
                                    <option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="editAudio" className="block text-sm font-medium text-gray-300">Suggested Audio</label>
                            <input type="text" id="editAudio" value={currentIdeaToEdit.suggestedAudio} onChange={(e) => handleFieldChange('suggestedAudio', e.target.value)} className="mt-1 w-full bg-white/10 border border-white/20 rounded-md px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"/>
                        </div>
                        <div>
                            <label htmlFor="editVisualPrompt" className="block text-sm font-medium text-gray-300">Visual Prompt</label>
                            <textarea id="editVisualPrompt" value={currentIdeaToEdit.visualPrompt || ''} onChange={(e) => handleFieldChange('visualPrompt', e.target.value)} rows={2} className="mt-1 w-full bg-white/10 border border-white/20 rounded-md px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"></textarea>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Hashtags</label>
                            {(currentIdeaToEdit.hashtags || []).map((tag, index) => (
                                <div key={index} className="flex items-center gap-2 mb-1.5">
                                    <input type="text" value={tag} onChange={(e) => handleHashtagChange(index, e.target.value)} className="flex-grow bg-white/10 border border-white/20 rounded-md px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"/>
                                    <button type="button" onClick={() => removeHashtagField(index)} className="text-red-400 hover:text-red-300"><XCircle size={18}/></button>
                                </div>
                            ))}
                            <button type="button" onClick={addHashtagField} className="text-xs text-cyan-300 hover:text-cyan-200 border border-cyan-500/50 px-2 py-1 rounded-md hover:bg-cyan-500/20">+ Add Hashtag</button>
                        </div>
                        
                        <div className="pt-4 border-t border-white/10 flex justify-end gap-3">
                            <button type="button" onClick={() => { setEditingIdea(null); setRefinementGoal(''); }} className="px-4 py-2 rounded-lg text-gray-300 hover:bg-white/10 transition-colors">Cancel</button>
                            <button type="submit" className="bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-2.5 rounded-lg font-semibold text-white hover:from-cyan-600 hover:to-blue-600 transition-colors flex items-center"><CheckCircle size={18} className="mr-2"/>Save Changes</button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 text-white selection:bg-cyan-500 selection:text-black">
      {loading && <LoadingOverlay progress={progress} />}
      {editingIdea && renderEditRefineModal()}

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold mb-3 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Dynamic Social Insights</h1>
          <p className="text-gray-300 text-lg">AI-Powered Content Analysis & Smart Notebook with Gemini</p>
        </header>

        <nav className="flex justify-center mb-10">
          <div className="bg-black/20 backdrop-blur-md rounded-full p-1.5 flex relative shadow-lg border border-white/10 w-full max-w-xl">
            {TABS.map((tabInfo, index) => (
              <button 
                key={tabInfo.id} 
                onClick={() => { setError(''); setActiveTab(tabInfo.id);}}
                className={`px-3 py-2.5 ${tabButtonWidth} rounded-full capitalize transition-all duration-300 relative z-10 text-sm font-medium flex items-center justify-center gap-1.5 ${activeTab === tabInfo.id ? 'text-white' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
              >
                {tabInfo.id === 'upload' && <Upload size={16} />} 
                {tabInfo.id === 'data' && <BarChart3 size={16} />}
                {tabInfo.id === 'insights' && <Brain size={16} />} 
                {tabInfo.id === 'notebook' && <BookOpen size={16} />}
                {tabInfo.label}
              </button>
            ))}
            <div 
                className={`absolute bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full h-[calc(100%-0.75rem)] ${tabButtonWidth} top-[0.375rem] transition-all duration-300 ease-out transform`} 
                style={{ left: indicatorOffset }}>
            </div>
          </div>
        </nav>

        {error && (
          <div className="bg-red-600/30 border border-red-500/60 rounded-lg p-4 mb-6 max-w-2xl mx-auto shadow-lg backdrop-blur-sm flex items-start">
            <AlertTriangle className="h-5 w-5 text-red-100 mr-3 flex-shrink-0 mt-0.5" />
            <div className="flex-grow">
                <p className="text-red-100 font-medium text-sm">{error}</p>
                 <button onClick={() => setError('')} className="mt-1 text-xs text-red-200 hover:text-red-100 underline">Dismiss</button>
            </div>
          </div>
        )}
        
        <main className="min-h-[400px]"> 
         {renderTabContent()}
        </main>

        <footer className="text-center mt-16 py-8 border-t border-white/10">
          <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} Dynamic Social Insights App. Powered by Google Gemini.</p>
          <p className="text-xs text-gray-500 mt-1">For demonstration purposes. API Key usage is simulated on client-side for this environment.</p>
        </footer>
      </div>
    </div>
  );
};

export default SocialInsightsApp;
