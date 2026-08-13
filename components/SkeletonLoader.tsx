import React from 'react';

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="flex-1 p-6 md:p-8 animate-pulse space-y-6 select-none">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
        <div className="space-y-2.5">
          <div className="h-7 w-64 bg-slate-200 rounded-lg"></div>
          <div className="h-4 w-48 bg-slate-200 rounded"></div>
        </div>
        <div className="h-10 w-44 bg-slate-200 rounded-xl"></div>
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 bg-white border border-slate-200/80 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
            <div className="h-4 w-24 bg-slate-200 rounded"></div>
            <div className="h-8 w-16 bg-slate-200 rounded-lg"></div>
          </div>
        ))}
      </div>

      {/* Main Grid View Skeleton */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Subheader controls */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div className="h-6 w-32 bg-slate-200 rounded"></div>
          <div className="flex space-x-2">
            <div className="h-9 w-28 bg-slate-200 rounded-lg"></div>
            <div className="h-9 w-28 bg-slate-200 rounded-lg"></div>
          </div>
        </div>

        {/* Timeline slots skeleton */}
        <div className="p-6 space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
              <div className="w-24 space-y-2 shrink-0">
                <div className="h-4 w-20 bg-slate-200 rounded"></div>
                <div className="h-3 w-16 bg-slate-200 rounded"></div>
              </div>
              <div className="flex-1 grid grid-cols-12 gap-2">
                {Array.from({ length: 12 }).map((_, j) => (
                  <div key={j} className="h-14 bg-slate-100 rounded-lg border border-slate-200/40"></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
