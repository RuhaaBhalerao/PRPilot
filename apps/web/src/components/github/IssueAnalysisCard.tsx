import React from 'react';
import {
  Sparkles,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  FileCode2,
  Wrench,
  ShieldAlert,
  Info,
  Layers,
  FlaskConical,
  FileQuestion,
} from 'lucide-react';
import type { IssueAnalysis } from '@prpilot/shared';

interface IssueAnalysisCardProps {
  analysis: IssueAnalysis;
}

export const IssueAnalysisCard: React.FC<IssueAnalysisCardProps> = ({ analysis }) => {
  return (
    <div className="rounded-xl border border-brand-200 bg-white p-6 shadow-sm space-y-6">
      {/* Header with Title and Model Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white shadow-xs">
            <Sparkles className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">AI-Powered Issue Triage</h3>
            <p className="text-xs text-slate-500">
              Structured diagnostic analysis, root-cause hypotheses, and verification plan.
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 self-start rounded-full bg-brand-50 border border-brand-200 px-3 py-1 text-xs font-medium text-brand-700">
          <Sparkles className="h-3 w-3 text-brand-600" />
          <span>Triage Complete</span>
        </div>
      </div>

      {/* Closed Issue Advisory Warning (if applicable) */}
      {analysis.isClosedIssue && (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 space-y-1 animate-in fade-in"
          role="note"
        >
          <div className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
            <span>Closed Issue Advisory</span>
          </div>
          <p className="leading-relaxed text-amber-800">
            {analysis.closedIssueNotice ||
              'This issue is marked as closed on GitHub. Closed issues may have already been resolved, duplicate, or rejected by maintainers. Review past pull requests and discussion before attempting to contribute.'}
          </p>
        </div>
      )}

      {/* Repository Context Limitation Notice */}
      <div
        className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700 space-y-1"
        role="note"
      >
        <div className="flex items-center gap-2 font-medium text-slate-800">
          <Info className="h-4 w-4 text-slate-500 shrink-0" />
          <span>Repository Context Limitation</span>
        </div>
        <p className="text-[11px] text-slate-600 leading-relaxed">
          {analysis.repositoryContextLimitation ||
            'Repository source files were not retrieved at this triage stage; file suggestions and root causes are hypotheses based on the issue description, stack traces, and metadata.'}
        </p>
      </div>

      {/* Grid of 7 Structured Sections */}
      <div className="space-y-5">
        {/* Section 1: Problem Summary */}
        <section className="rounded-lg border border-slate-200 p-4 space-y-2 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              1. Problem Summary
            </h4>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed font-normal">
            {analysis.problemSummary}
          </p>
        </section>

        {/* Section 2: Expected Behaviour */}
        <section className="rounded-lg border border-slate-200 p-4 space-y-2 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              2. Expected Behaviour
            </h4>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">{analysis.expectedBehaviour}</p>
        </section>

        {/* Section 3: Root-Cause Hypotheses */}
        <section className="rounded-lg border border-slate-200 p-4 space-y-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-indigo-600 shrink-0" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              3. Root-Cause Hypotheses
            </h4>
          </div>
          <p className="text-[11px] text-slate-500 italic">
            Note: The following are analytical hypotheses subject to codebase verification.
          </p>
          <ul className="space-y-2">
            {analysis.rootCauseHypotheses.map((hypothesis, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-xs text-slate-700 leading-relaxed"
              >
                <span className="flex h-4 w-4 items-center justify-center rounded bg-indigo-100 text-[10px] font-semibold text-indigo-700 shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <span>{hypothesis}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Section 4: Evidence and Missing Information */}
        <section className="rounded-lg border border-slate-200 p-4 space-y-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-brand-600 shrink-0" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              4. Evidence and Missing Information
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {/* Verified Facts */}
            <div className="rounded-md border border-emerald-200 bg-white p-3 space-y-2 shadow-2xs">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-900">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Verified Facts</span>
              </div>
              <ul className="space-y-1.5 text-[11px] text-slate-600 leading-normal">
                {analysis.evidenceAndMissingInformation.verifiedFacts.length > 0 ? (
                  analysis.evidenceAndMissingInformation.verifiedFacts.map((fact, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-emerald-500 font-bold">•</span>
                      <span>{fact}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-400 italic">No explicit facts confirmed.</li>
                )}
              </ul>
            </div>

            {/* Hypotheses */}
            <div className="rounded-md border border-amber-200 bg-white p-3 space-y-2 shadow-2xs">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                <HelpCircle className="h-3.5 w-3.5 text-amber-600" />
                <span>Hypotheses</span>
              </div>
              <ul className="space-y-1.5 text-[11px] text-slate-600 leading-normal">
                {analysis.evidenceAndMissingInformation.hypotheses.length > 0 ? (
                  analysis.evidenceAndMissingInformation.hypotheses.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-amber-500 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-400 italic">No additional hypotheses listed.</li>
                )}
              </ul>
            </div>

            {/* Missing Information */}
            <div className="rounded-md border border-purple-200 bg-white p-3 space-y-2 shadow-2xs">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-900">
                <FileQuestion className="h-3.5 w-3.5 text-purple-600" />
                <span>Missing Information</span>
              </div>
              <ul className="space-y-1.5 text-[11px] text-slate-600 leading-normal">
                {analysis.evidenceAndMissingInformation.missingInformation.length > 0 ? (
                  analysis.evidenceAndMissingInformation.missingInformation.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-purple-500 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-400 italic">No critical details reported missing.</li>
                )}
              </ul>
            </div>
          </div>
        </section>

        {/* Section 5: Files or Components to Investigate */}
        <section className="rounded-lg border border-slate-200 p-4 space-y-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <FileCode2 className="h-4 w-4 text-indigo-600 shrink-0" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              5. Files or Components to Investigate
            </h4>
          </div>
          <p className="text-[11px] text-slate-500">
            Candidate targets inferred from stack traces, error descriptions, and component naming
            (repository not cloned at this stage):
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {analysis.filesOrComponentsToInvestigate.map((target, idx) => (
              <div
                key={idx}
                className="rounded-md border border-slate-200 bg-white p-2.5 space-y-1 shadow-2xs"
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-semibold text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-100">
                    {target.name}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-normal">{target.reason}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 6: Proposed Fix Steps */}
        <section className="rounded-lg border border-slate-200 p-4 space-y-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-amber-600 shrink-0" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              6. Proposed Fix Steps
            </h4>
          </div>

          <ol className="space-y-2">
            {analysis.proposedFixSteps.map((step, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2.5 text-xs text-slate-700 leading-relaxed"
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700 shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Section 7: Regression Test Plan */}
        <section className="rounded-lg border border-slate-200 p-4 space-y-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-teal-600 shrink-0" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              7. Regression Test Plan
            </h4>
          </div>

          <ul className="space-y-2">
            {analysis.regressionTestPlan.map((testScenario, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-xs text-slate-700 leading-relaxed"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-teal-600 shrink-0 mt-0.5" />
                <span>{testScenario}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
};
