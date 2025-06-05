
import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  colorClass: string; // e.g., "text-cyan-400 border-cyan-500/30"
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, colorClass }) => (
  <div className={`bg-white/5 backdrop-blur-sm rounded-xl p-6 border ${colorClass} shadow-lg`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-gray-300 text-sm">{title}</p>
        <p className={`text-3xl font-bold ${colorClass.split(' ')[0]}`}>{value}</p>
      </div>
      <div className={`h-8 w-8 ${colorClass.split(' ')[0]}`}>
        {icon}
      </div>
    </div>
  </div>
);

export default StatCard;
