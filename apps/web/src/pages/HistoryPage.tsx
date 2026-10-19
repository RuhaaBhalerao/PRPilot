import React from 'react';
import { Database, ArrowLeft, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

export const HistoryPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-600">
          <Clock className="h-3 w-3" />
          <span>Coming in Phase 2</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Analysis History</h1>
        <p className="text-sm text-slate-500">
          Review past repository explorations, patch suggestions, and pull request tracking logs.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-16 px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
          <Database className="h-6 w-6" />
        </div>
        <h3 className="text-base font-semibold text-slate-900">
          History persistence arrives in Phase 2
        </h3>
        <p className="mt-1.5 max-w-md text-xs text-slate-500 leading-relaxed">
          In Phase 1, we focus on the core monorepo foundation, shared contracts, and the initial
          dashboard. Persistent issue analysis history and audit logs will be enabled when database
          integration (e.g., PostgreSQL/Prisma) is introduced.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-brand-700 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
