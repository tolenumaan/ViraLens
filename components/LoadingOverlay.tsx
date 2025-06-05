
import React from 'react';
import { Loader } from 'lucide-react';

interface LoadingOverlayProps {
  progress: number;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ progress }) => (
  <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex flex-col items-center justify-center text-white">
    <Loader className="h-16 w-16 text-cyan-400 animate-spin mb-6" />
    <p className="text-2xl font-semibold mb-3">Analyzing with Gemini AI</p>
    <p className="text-gray-300 mb-6 text-center px-4">This may take a few moments. Please wait...</p>
    {progress > 0 && (
      <div className="w-72 bg-gray-700 rounded-full h-3">
        <div
          // Using Tailwind JIT for dynamic width
          className={`bg-gradient-to-r from-cyan-500 to-purple-500 h-3 rounded-full transition-all duration-300 ease-linear w-[${progress}%]`}
        ></div>
      </div>
    )}
  </div>
);

export default LoadingOverlay;
