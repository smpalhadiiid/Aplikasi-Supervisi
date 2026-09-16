import React from 'react';

interface ProgressBarProps {
  value: number; // 0 to 100
  max?: number;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'emerald' | 'indigo' | 'amber' | 'rose' | 'auto';
  label?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  showPercentage = true,
  size = 'md',
  color = 'auto',
  label,
}) => {
  const percentage = Math.min(100, Math.max(0, Math.round((value / max) * 100)));

  const getColorClass = (pct: number) => {
    if (color !== 'auto') {
      const colors = {
        emerald: 'bg-emerald-500',
        indigo: 'bg-indigo-600',
        amber: 'bg-amber-500',
        rose: 'bg-rose-500',
      };
      return colors[color];
    }
    if (pct >= 85) return 'bg-emerald-500';
    if (pct >= 75) return 'bg-sky-500';
    if (pct >= 60) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const heightClasses = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  return (
    <div className="w-full">
      {(label || showPercentage) && (
        <div className="flex justify-between items-center text-xs text-slate-600 font-medium mb-1">
          <span>{label}</span>
          {showPercentage && <span className="font-semibold text-slate-800">{percentage}%</span>}
        </div>
      )}
      <div className={`w-full bg-slate-100 rounded-full overflow-hidden ${heightClasses[size]}`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${getColorClass(percentage)}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
