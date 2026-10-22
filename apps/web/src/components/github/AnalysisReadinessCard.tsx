import React from 'react';
import { Sparkles, Bot, FileCode2, ShieldCheck, CheckCircle2, RotateCcw } from 'lucide-react';

interface AnalysisReadinessCardProps {
  onReset?: () => void;
}

export const AnalysisReadinessCard: React.FC<AnalysisReadinessCardProps> = ({ onReset }) => {
  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-6 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white shadow-xs">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Contribution Workflow Pipeline</h3>
            <p className="text-xs text-slate-600">
              End-to-end stages from GitHub issue triage to deterministic patch verification.
            </p>
          </div>
        </div>

        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 self-start rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Analyze another issue</span>
          </button>
        )}
      </div>

      {/* Honest Milestone Details */}
      <div className="rounded-lg border border-brand-200/70 bg-white p-4 space-y-3">
        <div className="flex items-start gap-2.5">
          <CheckCircle2 className="h-4 w-4 text-brand-600 mt-0.5 shrink-0" />
          <p className="text-xs text-slate-700 leading-relaxed">
            <strong>Full diagnostic workflow active:</strong> Problem diagnosis, source code
            evidence retrieval, candidate file ranking, minimal unified diff synthesis, and proposed
            regression tests are supported. Patches are validated deterministically in-memory
            against authentic source snapshots before developer review.
          </p>
        </div>

        {/* Pipeline Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <div className="rounded-md border border-slate-100 bg-slate-50 p-2.5 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              <FileCode2 className="h-3.5 w-3.5 text-indigo-600" />
              <span>1. Source Grounding</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-normal">
              Inspects authentic default-branch files and transparently scores evidence relevance.
            </p>
          </div>

          <div className="rounded-md border border-slate-100 bg-slate-50 p-2.5 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              <Bot className="h-3.5 w-3.5 text-emerald-600" />
              <span>2. Patch & Test Synthesis</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-normal">
              Gemini synthesizes surgical unified diffs and dedicated regression test proposals.
            </p>
          </div>

          <div className="rounded-md border border-slate-100 bg-slate-50 p-2.5 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              <ShieldCheck className="h-3.5 w-3.5 text-purple-600" />
              <span>3. In-Memory Dry Run</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-normal">
              Validates patch paths and applies hunks cleanly against source snapshots without host
              execution.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
