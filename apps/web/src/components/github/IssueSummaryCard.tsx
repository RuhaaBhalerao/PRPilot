import React from 'react';
import { ExternalLink, Tag, Calendar, User, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import type { GithubIssue } from '@prpilot/shared';

interface IssueSummaryCardProps {
  issue: GithubIssue;
  repoFullName: string;
}

export const IssueSummaryCard: React.FC<IssueSummaryCardProps> = ({ issue, repoFullName }) => {
  const isOpen = issue.state === 'open';

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
      {/* Header / Title Row */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                isOpen
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-purple-50 text-purple-700 border border-purple-200'
              }`}
            >
              {isOpen ? <AlertCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
              <span className="capitalize">{issue.state}</span>
            </span>

            <span className="text-xs font-mono font-medium text-slate-500">
              {repoFullName} #{issue.number}
            </span>
          </div>

          <h2 className="text-xl font-bold tracking-tight text-slate-900 leading-snug">
            {issue.title}
          </h2>

          {/* Author and Date Meta */}
          <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <User className="h-3.5 w-3.5 text-slate-400" />
              <span>
                Opened by{' '}
                <strong className="text-slate-700">@{issue.authorLogin || 'ghost'}</strong>
              </span>
            </span>

            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <span>Created {formatDate(issue.createdAt)}</span>
            </span>

            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span>Updated {formatDate(issue.updatedAt)}</span>
            </span>

            {issue.closedAt && (
              <span className="inline-flex items-center gap-1 text-purple-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Closed {formatDate(issue.closedAt)}</span>
              </span>
            )}
          </div>
        </div>

        {/* Action Button: View on GitHub */}
        <a
          href={issue.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 self-start shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-sm"
        >
          <span>Open on GitHub</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Labels List */}
      <div className="space-y-1.5 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-1 text-xs font-semibold text-slate-700">
          <Tag className="h-3.5 w-3.5 text-slate-400" />
          <span>Labels ({issue.labels.length})</span>
        </div>

        {issue.labels.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {issue.labels.map((label, index) => {
              const hexColor = label.color ? `#${label.color}` : undefined;
              return (
                <span
                  key={label.id || index}
                  style={
                    hexColor
                      ? {
                          backgroundColor: `${hexColor}1a`,
                          borderColor: `${hexColor}40`,
                          color: hexColor,
                        }
                      : undefined
                  }
                  className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
                    !hexColor ? 'bg-slate-100 text-slate-700 border-slate-200' : ''
                  }`}
                  title={label.description || label.name}
                >
                  {label.name}
                </span>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">No labels assigned to this issue.</p>
        )}
      </div>

      {/* Issue Description / Body (Rendered safely as text, never raw HTML) */}
      <div className="space-y-1.5 pt-2 border-t border-slate-100">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Issue Description
        </h3>

        {issue.body && issue.body.trim().length > 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 max-h-96 overflow-y-auto">
            <pre className="whitespace-pre-wrap font-sans text-xs text-slate-800 leading-relaxed break-words selection:bg-brand-100">
              {issue.body}
            </pre>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center">
            <p className="text-xs text-slate-400 italic">No description provided by the author.</p>
          </div>
        )}
      </div>
    </div>
  );
};
