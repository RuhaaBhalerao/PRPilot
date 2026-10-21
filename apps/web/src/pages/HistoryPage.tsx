import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Clock,
  ExternalLink,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Database,
  CheckCircle2,
  XCircle,
  GitPullRequest,
  Search,
} from 'lucide-react';
import { fetchAnalysesHistory } from '../lib/api';

export const HistoryPage: React.FC = () => {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['analysesHistory'],
    queryFn: () => fetchAnalysesHistory(50, 0),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-2.5 py-0.5 text-xs font-medium text-brand-700">
            <Database className="h-3 w-3" />
            <span>Persistent History (Neon PostgreSQL)</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Analysis History</h1>
          <p className="text-sm text-slate-500">
            Review past repository explorations, AI triage findings, and regression test plans.
          </p>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          disabled={isLoading || isFetching}
          className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50 transition-colors"
          title="Refresh analysis history"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-3" role="status" aria-label="Loading history">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="h-4 w-40 bg-slate-200 rounded"></div>
                <div className="h-4 w-20 bg-slate-200 rounded"></div>
              </div>
              <div className="h-5 w-3/4 bg-slate-200 rounded"></div>
              <div className="h-3 w-1/2 bg-slate-200 rounded"></div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div
          className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-xs text-rose-800 space-y-3"
          role="alert"
        >
          <div className="flex items-center gap-2 font-semibold text-rose-900 text-sm">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>Unable to load analysis history</span>
          </div>
          <p className="leading-relaxed">
            {error instanceof Error ? error.message : 'Database query failed.'}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-md border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 shadow-xs hover:bg-rose-50 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && (!data || data.items.length === 0) && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-16 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
            <Search className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">No analyses recorded yet</h3>
          <p className="mt-1.5 max-w-md text-xs text-slate-500 leading-relaxed">
            Submit a public GitHub issue URL on the Dashboard to formulate an AI-powered triage
            analysis. Completed results will appear here automatically.
          </p>
          <div className="mt-6">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-brand-700 transition-colors"
            >
              <GitPullRequest className="h-3.5 w-3.5" />
              <span>Analyze an Issue</span>
            </Link>
          </div>
        </div>
      )}

      {/* History List */}
      {!isLoading && !isError && data && data.items.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs text-slate-500 font-medium px-1">
            Showing {data.items.length} of {data.total} recorded analyses
          </div>

          <div className="space-y-3">
            {data.items.map((item) => {
              const formattedDate = new Date(item.createdAt).toLocaleString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              const isCompleted = item.status === 'completed';

              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 transition-colors space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-100">
                        {item.repository}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          isCompleted
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        <span className="capitalize">{item.status}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{formattedDate}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-slate-900 leading-snug">
                      {item.issueTitle}
                    </h3>
                    <a
                      href={item.issueUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-600 transition-colors"
                    >
                      <span className="truncate max-w-md">{item.issueUrl}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="font-mono text-[11px] text-slate-400">
                      ID: {item.id.slice(0, 8)}...
                    </span>

                    <Link
                      to={`/?id=${item.id}`}
                      className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white shadow-2xs hover:bg-brand-700 transition-colors"
                    >
                      <span>Reopen Analysis</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
