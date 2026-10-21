import React, { useState } from 'react';
import {
  Sparkles,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  FileCode2,
  FileCheck2,
  Wrench,
  ShieldAlert,
  Info,
  Layers,
  FlaskConical,
  FileQuestion,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { IssueAnalysis } from '@prpilot/shared';

interface IssueAnalysisCardProps {
  analysis: IssueAnalysis;
}

export const IssueAnalysisCard: React.FC<IssueAnalysisCardProps> = ({ analysis }) => {
  const [expandedFileIdx, setExpandedFileIdx] = useState<number | null>(0);

  const hasRetrievedFiles = Boolean(
    analysis.repositoryEvidence?.files && analysis.repositoryEvidence.files.length > 0
  );

  return (
    <div className="rounded-xl border border-brand-200 bg-white p-6 shadow-sm space-y-6">
      {/* Header with Title and Model Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white shadow-xs">
            <Sparkles className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              AI-Powered Issue Triage & Repository Intelligence
            </h3>
            <p className="text-xs text-slate-500">
              Evidence-grounded diagnostic analysis, root-cause hypotheses, and verification plan.
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

      {/* Repository Intelligence & Evidence Section */}
      {analysis.repositoryEvidence?.status === 'insufficient_evidence' ? (
        <div
          className="rounded-xl border border-amber-300 bg-amber-50/80 p-4 sm:p-5 text-xs text-amber-950 space-y-3"
          role="region"
          aria-label="Insufficient Repository Evidence"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/80 pb-2.5">
            <div className="flex items-center gap-2 font-bold text-amber-900">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
              <span className="text-sm">Insufficient Repository Evidence</span>
            </div>
            <span className="inline-flex items-center gap-1 self-start sm:self-auto rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
              Implementation Not in Repository
            </span>
          </div>

          <p className="text-xs text-amber-900 leading-relaxed">
            {analysis.repositoryEvidence.limitation ||
              'Repository source files were inspected, but no files in this repository match the technical implementation or domain of the reported issue. Analysis findings below are ungrounded triage hypotheses.'}
          </p>

          {analysis.repositoryEvidence.externalRepositoryAdvisory && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/90 p-3.5 text-xs text-blue-950 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-blue-900">
                <Info className="h-4 w-4 text-blue-600 shrink-0" />
                <span>External Repository Advisory</span>
              </div>
              <p className="leading-relaxed text-blue-900">
                {analysis.repositoryEvidence.externalRepositoryAdvisory}
              </p>
            </div>
          )}
        </div>
      ) : hasRetrievedFiles && analysis.repositoryEvidence ? (
        <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-brand-100">
            <div className="flex items-center gap-2">
              <FileCheck2 className="h-5 w-5 text-brand-600 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Repository Intelligence & Inspected Source Files
                </h4>
                <p className="text-xs text-slate-500">
                  {analysis.repositoryEvidence.inspectedFileCount} source file(s) retrieved and
                  analyzed for grounded evidence
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              {analysis.repositoryEvidence.status === 'completed' &&
                analysis.repositoryEvidence.evidenceQuality !== 'indirect_reference' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    Direct Source Grounded
                  </span>
                )}
              {analysis.repositoryEvidence.evidenceQuality === 'indirect_reference' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 border border-blue-300 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                  <Info className="h-3 w-3 text-blue-600" />
                  Indirect Reference Patterns
                </span>
              )}
              {analysis.repositoryEvidence.status === 'partial' &&
                analysis.repositoryEvidence.evidenceQuality !== 'indirect_reference' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                    <AlertCircle className="h-3 w-3 text-amber-600" />
                    Partial Source Inspection
                  </span>
                )}
            </div>
          </div>

          {analysis.repositoryEvidence.limitation && (
            <div className="rounded-lg bg-amber-50/90 border border-amber-200 px-3 py-2 text-xs text-amber-900 flex items-start gap-2">
              <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{analysis.repositoryEvidence.limitation}</span>
            </div>
          )}

          {/* Inspected Files List */}
          <div className="space-y-2.5">
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Inspected Files ({analysis.repositoryEvidence.files.length})
            </h5>
            <div className="space-y-2">
              {analysis.repositoryEvidence.files.map((file, idx) => {
                const isExpanded = expandedFileIdx === idx;
                return (
                  <div
                    key={file.path}
                    className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs transition-colors hover:border-brand-300"
                  >
                    <div className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <FileCode2 className="h-4 w-4 text-brand-600 shrink-0" />
                        <span className="font-mono text-xs font-bold text-slate-900 truncate">
                          {file.path}
                        </span>
                        <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                          {(file.sizeBytes / 1024).toFixed(1)} KB
                        </span>
                        <span className="inline-flex items-center rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700 border border-brand-100">
                          Score: {file.relevanceScore}
                        </span>
                        {file.evidenceRole === 'indirect_reference' ? (
                          <span className="inline-flex items-center rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                            Indirect Pattern
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                            Direct Evidence
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={file.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-800 hover:underline"
                        >
                          <span>View on GitHub</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        <button
                          type="button"
                          onClick={() => setExpandedFileIdx(isExpanded ? null : idx)}
                          className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                          aria-expanded={isExpanded}
                        >
                          <span>{isExpanded ? 'Hide Excerpt' : 'View Excerpt'}</span>
                          {isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="px-3 py-1.5 bg-slate-100/60 border-t border-slate-100 text-[11px] text-slate-600 flex items-center gap-1.5">
                      <span className="font-semibold text-slate-700">Selection rationale:</span>
                      <span>{file.relevanceReason}</span>
                    </div>

                    {isExpanded && file.excerpt && (
                      <div className="border-t border-slate-200 p-3 bg-slate-950 text-slate-100">
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-[11px] text-slate-400">
                          <span>Source Code Snippet ({file.path})</span>
                          <span>Line numbers preserved</span>
                        </div>
                        <pre className="text-[11px] font-mono leading-relaxed overflow-x-auto max-h-72 p-1 text-slate-200">
                          <code>{file.excerpt}</code>
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Metadata-Only Warning Banner */
        <div
          className="rounded-xl border border-amber-300 bg-amber-50/70 p-4 text-xs text-amber-950 space-y-1.5"
          role="note"
        >
          <div className="flex items-center gap-2 font-bold text-amber-900 flex-wrap">
            <AlertCircle className="h-4.5 w-4.5 text-amber-600 shrink-0" />
            <span>Analysis Based on Issue Metadata Only</span>
            <span className="text-[10px] font-medium text-amber-800 bg-amber-100 border border-amber-300 rounded px-1.5 py-0.5">
              Repository Context Limitation
            </span>
          </div>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            {analysis.repositoryContextLimitation ||
              'Repository source files were not retrieved at this triage stage. All candidate file targets and root-cause analyses are hypotheses based on issue description, stack traces, and metadata.'}
          </p>
        </div>
      )}

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
                <span>Observed Evidence (Facts)</span>
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
                <span>Missing Information (Unknowns)</span>
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
            Candidate targets identified from repository code inspection, error descriptions, and
            stack traces:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {analysis.filesOrComponentsToInvestigate.map((target, idx) => (
              <div
                key={idx}
                className="rounded-md border border-slate-200 bg-white p-3 space-y-2 shadow-2xs"
              >
                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                  <span className="font-mono text-xs font-bold text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-100">
                    {target.name}
                  </span>
                  {target.evidenceRole === 'indirect_reference' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                      <Info className="h-3 w-3 text-blue-600" />
                      Indirect Reference (Pattern)
                    </span>
                  ) : target.isGroundedEvidence ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      Direct Grounded Evidence
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      Hypothesis (Uninspected)
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 leading-normal">{target.reason}</p>
                {target.htmlUrl && (
                  <a
                    href={target.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-600 hover:text-brand-800 hover:underline pt-0.5"
                  >
                    <span>View file on GitHub</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
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
