import React, { useState } from 'react';
import {
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  FileCode2,
  RefreshCw,
  Loader2,
  FileDiff,
  FlaskConical,
  HelpCircle,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import type { PatchGenerationResponse, PatchVerificationResponse } from '@prpilot/shared';
import { usePatchGeneration } from '../../hooks/usePatchGeneration';
import { verifyPatchApi } from '../../lib/api';

interface PatchReviewCardProps {
  analysisId?: string;
  issueUrl: string;
  isClosed?: boolean;
  initialPatch?: PatchGenerationResponse | null;
}

export const PatchReviewCard: React.FC<PatchReviewCardProps> = ({
  analysisId,
  issueUrl,
  isClosed = false,
  initialPatch,
}) => {
  const [patchResult, setPatchResult] = useState<PatchGenerationResponse | null>(
    initialPatch ?? null
  );
  const [verificationResult, setVerificationResult] = useState<PatchVerificationResponse | null>(
    initialPatch?.verification ?? null
  );
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [requestSandbox, setRequestSandbox] = useState<boolean>(false);
  const [forceAllowClosed, setForceAllowClosed] = useState<boolean>(false);
  const [copiedDiff, setCopiedDiff] = useState<boolean>(false);
  const [copiedTestIdx, setCopiedTestIdx] = useState<number | null>(null);

  const {
    mutate: generatePatch,
    isPending,
    error: apiError,
    reset: resetError,
  } = usePatchGeneration();

  const handleGenerate = (overrideClosed = forceAllowClosed) => {
    resetError();
    setVerificationResult(null);
    setVerifyError(null);
    generatePatch(
      {
        analysisId,
        issueUrl,
        forceAllowClosed: overrideClosed,
      },
      {
        onSuccess: (data) => {
          setPatchResult(data);
          if (data.verification) {
            setVerificationResult(data.verification);
          }
        },
      }
    );
  };

  const handleVerify = async (withSandbox = requestSandbox) => {
    if (!patchResult) return;
    setIsVerifying(true);
    setVerifyError(null);
    try {
      const res = await verifyPatchApi({
        analysisId,
        issueUrl,
        unifiedDiff: patchResult.unifiedDiff ?? undefined,
        runSandboxTests: withSandbox,
      });
      setVerificationResult(res);
    } catch (err: unknown) {
      const maybeAxios = err as {
        response?: { data?: { error?: { message?: string } } };
        message?: string;
      };
      setVerifyError(
        maybeAxios?.response?.data?.error?.message ||
          maybeAxios?.message ||
          'Verification request failed'
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const copyToClipboard = (text: string, isDiff = true, testIdx?: number) => {
    navigator.clipboard.writeText(text);
    if (isDiff) {
      setCopiedDiff(true);
      setTimeout(() => setCopiedDiff(false), 2000);
    } else if (testIdx !== undefined) {
      setCopiedTestIdx(testIdx);
      setTimeout(() => setCopiedTestIdx(null), 2000);
    }
  };

  const renderDiffLine = (line: string, index: number) => {
    if (line.startsWith('+++') || line.startsWith('---')) {
      return (
        <div key={index} className="text-slate-500 font-semibold px-3 py-0.5 bg-slate-100/50">
          {line}
        </div>
      );
    }
    if (line.startsWith('@@')) {
      return (
        <div
          key={index}
          className="text-purple-700 font-medium px-3 py-0.5 bg-purple-50/60 border-y border-purple-100"
        >
          {line}
        </div>
      );
    }
    if (line.startsWith('+')) {
      return (
        <div key={index} className="text-emerald-800 bg-emerald-50/90 px-3 py-0.5 flex">
          <span className="select-none text-emerald-500 w-5 shrink-0 font-mono">+</span>
          <span className="flex-1 font-mono">{line.slice(1)}</span>
        </div>
      );
    }
    if (line.startsWith('-')) {
      return (
        <div key={index} className="text-rose-800 bg-rose-50/90 px-3 py-0.5 flex">
          <span className="select-none text-rose-500 w-5 shrink-0 font-mono">-</span>
          <span className="flex-1 font-mono">{line.slice(1)}</span>
        </div>
      );
    }
    return (
      <div key={index} className="text-slate-700 px-3 py-0.5 flex">
        <span className="select-none text-slate-300 w-5 shrink-0 font-mono"> </span>
        <span className="flex-1 font-mono">{line.startsWith(' ') ? line.slice(1) : line}</span>
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-brand-200 bg-white p-6 shadow-sm space-y-6">
      {/* Header with Title and Trigger Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-indigo-700 text-white shadow-sm">
            <FileDiff className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              AI Patch Generation & Regression Test Synthesis
            </h3>
            <p className="text-xs text-slate-500">
              Evidence-grounded minimal unified diff and verified regression test proposals.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => handleGenerate()}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 active:scale-98 transition-all disabled:opacity-60 shadow-xs cursor-pointer"
          >
            {isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Synthesizing Patch...</span>
              </>
            ) : patchResult ? (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Regenerate Patch</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                <span>Generate Patch</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Closed Issue Advisory Banner */}
      {isClosed && !patchResult && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span>
            Notice: This issue is marked as closed on GitHub. Automatic patch generation is blocked
            by default to prevent speculative edits.
          </span>
          <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={forceAllowClosed}
              onChange={(e) => setForceAllowClosed(e.target.checked)}
              className="rounded border-amber-400 text-brand-600 focus:ring-brand-500 h-3.5 w-3.5"
            />
            <span>Pre-authorize Override</span>
          </label>
        </div>
      )}

      {/* API Error State */}
      {apiError && (
        <div
          className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 space-y-2 animate-in fade-in"
          role="alert"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-rose-900">
              <AlertCircle className="h-4 w-4 text-rose-600" />
              <span>Patch Generation Failed</span>
            </div>
            <button
              type="button"
              onClick={resetError}
              className="text-xs text-rose-700 hover:underline font-medium"
            >
              Dismiss
            </button>
          </div>
          <p className="text-rose-700 leading-relaxed">
            {apiError.message ||
              'An unexpected error occurred while communicating with the AI patch generator.'}
          </p>
        </div>
      )}

      {/* Ineligibility Warning & Blocker Review */}
      {patchResult?.status === 'not_eligible' && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-5 space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/70 pb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4.5 w-4.5 text-amber-600 shrink-0" />
              <span className="font-semibold text-xs uppercase tracking-wider text-amber-900">
                Patch Generation Blocked (Eligibility Gate)
              </span>
            </div>
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-300">
              Not Eligible
            </span>
          </div>

          <p className="text-xs text-amber-900 font-medium">
            PRPilot rejected automatic patch generation to protect code integrity. The following
            blockers were identified:
          </p>

          <ul className="space-y-2 text-xs text-amber-800">
            {patchResult.eligibility.blockers.map((blocker, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <ChevronRight className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                <span className="leading-relaxed">{blocker}</span>
              </li>
            ))}
          </ul>

          {/* Maintenance Override for Closed Issues */}
          {patchResult.eligibility.allowOverride && (
            <div className="pt-2 border-t border-amber-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <label className="flex items-center gap-2.5 text-xs text-amber-950 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={forceAllowClosed}
                  onChange={(e) => setForceAllowClosed(e.target.checked)}
                  className="rounded border-amber-400 text-brand-600 focus:ring-brand-500 h-4 w-4"
                />
                <span>Allow closed issue override for legitimate maintenance work</span>
              </label>

              {forceAllowClosed && (
                <button
                  type="button"
                  onClick={() => handleGenerate(true)}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100/50 transition-colors cursor-pointer"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Retry with Override</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Generated Patch & Validation Content */}
      {patchResult?.status === 'generated' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Validation Status & Summary Ribbon */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1">
              <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                Generation Status
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                <span className="h-2 w-2 rounded-full bg-brand-500"></span>
                <span>Generated (AI Synthesis)</span>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1">
              <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                Deterministic Validation
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                {patchResult.validation?.isValid ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span className="text-emerald-700">Validated (Dry-Run Clean)</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 text-rose-600" />
                    <span className="text-rose-700">Validation Failed</span>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1">
              <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                Diff Scope Metrics
              </div>
              <div className="text-xs font-semibold text-slate-800">
                {patchResult.validation ? (
                  <span>
                    {patchResult.validation.parsedFiles.length} file(s) &bull; +
                    {patchResult.validation.totalAdditions} / -
                    {patchResult.validation.totalDeletions}
                  </span>
                ) : (
                  <span>0 changes</span>
                )}
              </div>
            </div>
          </div>

          {/* Minimal Patch Verification & Sandbox Safety Section */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Patch Verification & Sandbox Boundary
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Independent structural validation and container isolation status.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requestSandbox}
                    onChange={(e) => setRequestSandbox(e.target.checked)}
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-3.5 w-3.5"
                  />
                  <span>Request Sandbox Run</span>
                </label>

                <button
                  type="button"
                  onClick={() => handleVerify()}
                  disabled={isVerifying}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 active:scale-98 transition-all disabled:opacity-60 shadow-2xs cursor-pointer"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : verificationResult ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Re-verify Patch</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-3.5 w-3.5 text-brand-600" />
                      <span>Verify Patch</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Verification Error */}
            {verifyError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>{verifyError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setVerifyError(null)}
                  className="text-xs text-rose-700 hover:underline font-medium"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* If verification has run, show dual status (Structural vs Test Execution) */}
            {verificationResult ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Structural Validation Column */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                        Structural Validation
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                          verificationResult.structuralValidation.isValid
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {verificationResult.structuralValidation.isValid ? 'PASSED' : 'FAILED'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-700 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">File Paths Safety:</span>
                        <span className="font-semibold text-slate-800">
                          {verificationResult.structuralValidation.validationErrors.length === 0
                            ? 'Safe (Repository Rooted)'
                            : 'Unsafe Paths'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Diff Scope:</span>
                        <span className="font-mono text-slate-800">
                          {verificationResult.structuralValidation.parsedFiles.length} file(s) (+
                          {verificationResult.structuralValidation.totalAdditions} / -
                          {verificationResult.structuralValidation.totalDeletions})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Test Execution Status Column */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                        Test Execution
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                          verificationResult.testExecutionStatus === 'passed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : verificationResult.testExecutionStatus === 'sandbox_unavailable'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {verificationResult.testExecutionStatus}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-normal">
                      {verificationResult.sandboxDetails.reason}
                    </p>
                  </div>
                </div>

                {/* Critical Verification Distinction Alert */}
                <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-900 flex items-start gap-2">
                  <HelpCircle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">
                    <strong>Important Verification Distinction:</strong> Structural validation
                    confirms diff syntax and safe relative paths, but does <em>not</em> certify a
                    bug fix. Test execution in an isolated sandbox is required before any fix can be
                    certified.
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
                <span>
                  Click <strong>Verify Patch</strong> to run deterministic structural path
                  verification and evaluate sandbox readiness.
                </span>
              </div>
            )}
          </div>

          {/* Validation Errors Box if validation failed */}
          {patchResult.validation && !patchResult.validation.isValid && (
            <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-xs text-rose-900 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-rose-950">
                <AlertCircle className="h-4 w-4 text-rose-600" />
                <span>Deterministic Validation Errors</span>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-rose-800">
                {patchResult.validation.validationErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Suspected Root Cause */}
          {patchResult.suspectedRootCause && (
            <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                <HelpCircle className="h-4 w-4 text-brand-600" />
                <span>Suspected Root Cause & Fix Rationale</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed font-sans">
                {patchResult.suspectedRootCause}
              </p>
            </div>
          )}

          {/* Unified Diff Viewer */}
          {patchResult.unifiedDiff && (
            <div className="rounded-xl border border-slate-300 bg-slate-900 text-white overflow-hidden shadow-md">
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 border-b border-slate-700 text-xs">
                <div className="flex items-center gap-2 font-mono text-slate-300">
                  <FileCode2 className="h-4 w-4 text-brand-400" />
                  <span>Proposed Unified Diff</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(patchResult.unifiedDiff || '')}
                  className="inline-flex items-center gap-1.5 rounded bg-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-600 transition-colors cursor-pointer"
                >
                  {copiedDiff ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy Diff</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-2 overflow-x-auto max-h-96 text-xs font-mono leading-relaxed bg-white text-slate-900">
                {patchResult.unifiedDiff.split('\n').map(renderDiffLine)}
              </div>
            </div>
          )}

          {/* Changed File Explanations */}
          {patchResult.fileExplanations.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                File Change Explanations ({patchResult.fileExplanations.length})
              </h4>
              <div className="grid grid-cols-1 gap-2.5">
                {patchResult.fileExplanations.map((exp, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {exp.path}
                      </span>
                      {exp.addressedRegressionTest && (
                        <span className="text-[11px] text-slate-500 font-medium">
                          Addresses:{' '}
                          <span className="text-brand-700">{exp.addressedRegressionTest}</span>
                        </span>
                      )}
                    </div>
                    <div className="text-slate-700 leading-normal">
                      <strong>Relevance:</strong> {exp.relevanceReason}
                    </div>
                    <div className="text-slate-700 leading-normal">
                      <strong>Change:</strong> {exp.changeSummary}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Proposed Regression Tests */}
          {patchResult.regressionTests.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FlaskConical className="h-4 w-4 text-brand-600" />
                  <span>Proposed Regression Tests ({patchResult.regressionTests.length})</span>
                </h4>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 border border-slate-200">
                  Status: not_run (Safety Boundary)
                </span>
              </div>

              <div className="space-y-3">
                {patchResult.regressionTests.map((test, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs"
                  >
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs">
                      <div className="space-y-0.5">
                        <div className="font-semibold text-slate-900">{test.title}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          Target: {test.targetFile} &bull; Framework: {test.testFramework}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(test.testCode, false, idx)}
                        className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        {copiedTestIdx === idx ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copy Test</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="p-3 text-xs text-slate-600 leading-normal border-b border-slate-100 bg-white">
                      {test.description}
                    </div>

                    <pre className="p-3 bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto max-h-56 leading-relaxed">
                      <code>{test.testCode}</code>
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assumptions & Uncertainties */}
          {patchResult.assumptionsAndUncertainties.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-2 text-xs">
              <div className="font-semibold text-slate-800">
                Remaining Assumptions & Known Uncertainties:
              </div>
              <ul className="list-disc pl-5 space-y-1 text-slate-600">
                {patchResult.assumptionsAndUncertainties.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Empty State before generation */}
      {!patchResult && !isPending && (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center space-y-2">
          <FileDiff className="h-8 w-8 text-slate-400 mx-auto" />
          <p className="text-xs font-semibold text-slate-700">No patch generated yet</p>
          <p className="text-[11px] text-slate-500 max-w-md mx-auto">
            Click <strong>Generate Patch</strong> to evaluate eligibility against repository
            evidence, fetch authentic repository snapshots, and synthesize a surgical unified diff
            and regression test.
          </p>
        </div>
      )}

      {/* Strict Safety Constraints Callout */}
      <div className="rounded-lg border border-brand-100 bg-brand-50/50 p-3 text-[11px] text-brand-900 flex items-start gap-2">
        <ShieldCheck className="h-4 w-4 text-brand-600 shrink-0 mt-0.5" />
        <span className="leading-relaxed">
          <strong>Safety boundary guarantee:</strong> PRPilot never automatically applies patches to
          your working tree, commits code, or opens pull requests. Generated patches are validated
          deterministically in-memory against authentic repository snapshots. Regression tests are
          marked as <code>not_run</code> and are never executed on the host server.
        </span>
      </div>
    </div>
  );
};
