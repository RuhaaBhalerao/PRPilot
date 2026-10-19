import React from 'react';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500 mb-4">
        <AlertCircle className="h-7 w-7" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">404 - Page Not Found</h1>
      <p className="mt-2 text-sm text-slate-600 max-w-sm">
        The page you are looking for doesn't exist or has been moved.
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
  );
};
