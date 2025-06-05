
import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  message: string;
  actionButtonLabel: string;
  onAction: () => void;
  actionButtonIcon: React.ReactNode;
  buttonGradient: string; // e.g., "from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, message, actionButtonLabel, onAction, actionButtonIcon, buttonGradient }) => (
  <div className="text-center py-16">
    <div className="bg-gradient-to-br from-white/5 to-white/10 w-32 h-32 rounded-full mx-auto mb-8 flex items-center justify-center shadow-xl border border-white/20">
      {icon}
    </div>
    <h3 className="text-2xl font-semibold mb-3 text-gray-100">{title}</h3>
    <p className="text-gray-400 mb-8 max-w-md mx-auto text-sm leading-relaxed">{message}</p>
    <button
      onClick={onAction}
      className={`bg-gradient-to-r ${buttonGradient} px-8 py-3.5 rounded-lg font-semibold text-white hover:shadow-xl transition-all duration-300 inline-flex items-center text-sm transform hover:scale-105`}
    >
      {actionButtonIcon}
      {actionButtonLabel}
    </button>
  </div>
);

export default EmptyState;
