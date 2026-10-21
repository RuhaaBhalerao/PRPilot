import React from 'react';
import { GitFork, Star, GitBranch, Code2, AlertCircle, Archive, ExternalLink } from 'lucide-react';
import type { GithubRepository } from '@prpilot/shared';

interface RepositorySummaryCardProps {
  repository: GithubRepository;
}

export const RepositorySummaryCard: React.FC<RepositorySummaryCardProps> = ({ repository }) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      {/* Title & External Link */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <GitFork className="h-4 w-4 text-brand-600" />
            <h3 className="text-base font-semibold text-slate-900">{repository.fullName}</h3>
            {repository.isArchived && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                <Archive className="h-3 w-3" />
                <span>Archived</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            {repository.description || (
              <span className="italic text-slate-400">No repository description provided.</span>
            )}
          </p>
        </div>

        <a
          href={repository.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 self-start shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-sm"
        >
          <span>View Repository</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Repository Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
        <div className="rounded-lg bg-slate-50 p-2.5 space-y-0.5 border border-slate-100">
          <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
            <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
            <span>Stars</span>
          </div>
          <p className="text-sm font-semibold text-slate-900 font-mono">
            {repository.stars.toLocaleString()}
          </p>
        </div>

        <div className="rounded-lg bg-slate-50 p-2.5 space-y-0.5 border border-slate-100">
          <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
            <GitBranch className="h-3.5 w-3.5 text-slate-500" />
            <span>Default Branch</span>
          </div>
          <p className="text-sm font-semibold text-slate-900 font-mono truncate">
            {repository.defaultBranch}
          </p>
        </div>

        <div className="rounded-lg bg-slate-50 p-2.5 space-y-0.5 border border-slate-100">
          <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
            <Code2 className="h-3.5 w-3.5 text-indigo-500" />
            <span>Language</span>
          </div>
          <p className="text-sm font-semibold text-slate-900 font-mono">
            {repository.primaryLanguage || 'Not specified'}
          </p>
        </div>

        <div className="rounded-lg bg-slate-50 p-2.5 space-y-0.5 border border-slate-100">
          <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
            <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
            <span>Open Issues</span>
          </div>
          <p className="text-sm font-semibold text-slate-900 font-mono">
            {repository.openIssueCount.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
};
