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
            <h3 className="text-sm font-semibold text-slate-900">
              Analysis Readiness — Phase 3 Next Steps
            </h3>
            <p className="text-xs text-slate-600">
              Target issue and repository verified and normalized through official GitHub APIs.
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
            <strong>AI Issue Triage complete:</strong> Problem summary, expected behaviour,
            hypotheses, evidence, candidate components, fix steps, and regression test plan were
            generated. Codebase cloning, AST module mapping, and sandbox patch verification follow
            in <strong>Phase 3</strong>.
          </p>
        </div>

        {/* Phase 3 Pipeline Roadmap */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <div className="rounded-md border border-slate-100 bg-slate-50 p-2.5 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              <FileCode2 className="h-3.5 w-3.5 text-indigo-600" />
              <span>1. Codebase Cloning</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-normal">
              Clone repo default branch and index AST module graphs to locate bug origin.
            </p>
          </div>

          <div className="rounded-md border border-slate-100 bg-slate-50 p-2.5 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              <Bot className="h-3.5 w-3.5 text-emerald-600" />
              <span>2. Gemini Code Synthesis</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-normal">
              Formulate minimal unified diff and synthesize regression test suite.
            </p>
          </div>

          <div className="rounded-md border border-slate-100 bg-slate-50 p-2.5 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              <ShieldCheck className="h-3.5 w-3.5 text-purple-600" />
              <span>3. Sandbox Verification</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-normal">
              Execute test runners in an isolated container to ensure zero regressions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
