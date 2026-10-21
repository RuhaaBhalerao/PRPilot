import React, { useState } from 'react';
import {
  Search,
  ArrowRight,
  AlertCircle,
  FileCode2,
  Terminal,
  ShieldCheck,
  Bot,
  Sparkles,
  Loader2,
  RefreshCw,
  XCircle,
  Clock,
} from 'lucide-react';
import { analyzeIssueRequestSchema } from '@prpilot/shared';
import { useGithubIssueLookup } from '../hooks/useGithubIssueLookup';
import { IssueSummaryCard } from '../components/github/IssueSummaryCard';
import { RepositorySummaryCard } from '../components/github/RepositorySummaryCard';
import { AnalysisReadinessCard } from '../components/github/AnalysisReadinessCard';

const EXAMPLE_URL = 'https://github.com/facebook/react/issues/27986';

export const DashboardPage: React.FC = () => {
  const [urlInput, setUrlInput] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const {
    mutate: lookupIssue,
    data: lookupResult,
    isPending,
    error: apiError,
    reset: resetLookup,
  } = useGithubIssueLookup();

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrlInput(e.target.value);
    if (validationError) {
      setValidationError(null);
    }
  };

  const fillExample = () => {
    setUrlInput(EXAMPLE_URL);
    setValidationError(null);
    resetLookup();
  };

  const handleReset = () => {
    setUrlInput('');
    setValidationError(null);
    resetLookup();
  };

  const performLookup = (url: string) => {
    // Validate using the shared Zod schema
    const parseResult = analyzeIssueRequestSchema.safeParse({ issueUrl: url });

    if (!parseResult.success) {
      const firstError =
        parseResult.error.issues[0]?.message || 'Please enter a valid GitHub issue URL';
      setValidationError(firstError);
      return;
    }

    setValidationError(null);
    lookupIssue(url);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending) return;
    performLookup(urlInput);
  };

  const handleRetry = () => {
    if (urlInput.trim()) {
      performLookup(urlInput);
    }
  };

  // Determine if error qualifies for a retry action
  const canRetry =
    apiError &&
    (apiError.status === 502 ||
      apiError.status === 504 ||
      apiError.status === 429 ||
      apiError.status === undefined);

  return (
    <div className="space-y-8">
      {/* Hero / Header Section */}
      <div className="space-y-2.5">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-3 py-1 text-xs font-medium text-brand-700">
          <Sparkles className="h-3.5 w-3.5 text-brand-600" />
          <span>Autonomous Open-Source Contribution Engine</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Open-source contributions, simplified.
        </h1>
        <p className="max-w-3xl text-base text-slate-600 leading-relaxed">
          PRPilot investigates public GitHub issues, explores the target repository, formulates
          targeted code fixes using AI, generates regression tests, and validates patches in a
          restricted sandbox.
        </p>
      </div>

      {/* Primary Input Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="github-issue-url"
                className="block text-sm font-semibold text-slate-800"
              >
                GitHub Issue URL
              </label>
              <button
                type="button"
                onClick={fillExample}
                disabled={isPending}
                className="text-xs text-brand-600 hover:text-brand-700 font-medium hover:underline focus:outline-none disabled:opacity-50"
              >
                Try an example URL
              </button>
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <Search className="h-4 w-4" />
              </div>
              <input
                id="github-issue-url"
                type="url"
                value={urlInput}
                onChange={handleUrlChange}
                placeholder="https://github.com/owner/repository/issues/123"
                className={`block w-full rounded-lg border py-3 pl-10 pr-36 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition-colors ${
                  validationError
                    ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200'
                    : 'border-slate-300 focus:border-brand-500 focus:ring-brand-100'
                }`}
                aria-describedby={validationError ? 'url-validation-error' : 'url-helper-text'}
                disabled={isPending}
                autoComplete="off"
                spellCheck={false}
              />
              <div className="absolute inset-y-1.5 right-1.5 flex items-center">
                <button
                  type="submit"
                  disabled={isPending || !urlInput.trim()}
                  className="inline-flex h-full items-center gap-1.5 rounded-md bg-brand-600 px-4 text-xs font-medium text-white shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <span>Analyze issue</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Client-side Validation Error */}
            {validationError && (
              <div
                id="url-validation-error"
                className="flex items-center gap-1.5 pt-1 text-xs text-rose-600"
                role="alert"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {!validationError && !apiError && (
              <p id="url-helper-text" className="text-xs text-slate-500">
                Enter any public GitHub issue link. Private repositories are not supported.
              </p>
            )}
          </div>
        </form>

        {/* API Error Notification with Retry option */}
        {apiError &&
          (() => {
            const errorDetails = apiError.details as
              | {
                  rateLimitType?: 'primary' | 'secondary';
                  resetAt?: string;
                  retryAfterSeconds?: number;
                }
              | undefined;

            const isRateLimit = apiError.status === 429;
            const isSecondary = errorDetails?.rateLimitType === 'secondary';

            return (
              <div
                className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 animate-in fade-in"
                role="alert"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <XCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="space-y-1.5">
                      <h4 className="font-semibold text-rose-900">
                        {apiError.status === 404
                          ? 'Issue or Repository Not Found'
                          : apiError.status === 422
                            ? 'Unsupported Resource (Pull Request)'
                            : isRateLimit
                              ? isSecondary
                                ? 'GitHub Secondary Rate Limit Triggered'
                                : 'GitHub API Rate Limit Reached'
                              : apiError.status === 502 || apiError.status === 504
                                ? 'Upstream GitHub Connection Error'
                                : 'Unable to Analyze Issue'}
                      </h4>
                      <p className="leading-relaxed text-rose-700">{apiError.message}</p>

                      {/* Rate Limit Cooldown Details & Guidance */}
                      {isRateLimit && (
                        <div className="pt-1 space-y-1">
                          {errorDetails?.resetAt && (
                            <div className="inline-flex items-center gap-1.5 rounded bg-rose-100/90 border border-rose-200 px-2 py-0.5 text-[11px] font-medium text-rose-800">
                              <Clock className="h-3 w-3 text-rose-600" />
                              <span>
                                Reset time:{' '}
                                {new Date(errorDetails.resetAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}
                              </span>
                            </div>
                          )}
                          <p className="text-[11px] text-rose-600 leading-normal">
                            {errorDetails?.resetAt
                              ? 'Please wait until the reset time before retrying. Repeated requests during the cooldown window may prolong throttling.'
                              : 'Please wait before retrying. Repeated requests during the cooldown window may prolong throttling.'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {canRetry && (
                    <button
                      type="button"
                      onClick={handleRetry}
                      disabled={isPending}
                      className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-white px-2.5 py-1 text-xs font-medium text-rose-700 shadow-xs hover:bg-rose-50 transition-colors shrink-0"
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span>Retry</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
      </div>

      {/* Successful Issue Lookup Interface */}
      {lookupResult && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <IssueSummaryCard
            issue={lookupResult.issue}
            repoFullName={lookupResult.repository.fullName}
          />
          <RepositorySummaryCard repository={lookupResult.repository} />
          <AnalysisReadinessCard onReset={handleReset} />
        </div>
      )}

      {/* Architecture & Pipeline Preview */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 mb-1">
          Contribution Workflow Architecture
        </h2>
        <p className="text-xs text-slate-500 mb-5">
          How PRPilot transforms public GitHub issues into verified pull requests.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-4 space-y-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
              <Search className="h-4 w-4" />
            </div>
            <div className="text-xs font-semibold text-slate-900">1. Issue Triage</div>
            <p className="text-[11px] text-slate-500 leading-normal">
              Retrieves real GitHub issue metadata, discussion thread, labels, and repository
              context.
            </p>
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-4 space-y-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <FileCode2 className="h-4 w-4" />
            </div>
            <div className="text-xs font-semibold text-slate-900">2. Codebase Discovery</div>
            <p className="text-[11px] text-slate-500 leading-normal">
              Navigates abstract syntax trees and file dependencies to isolate offending code
              modules.
            </p>
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-4 space-y-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <Bot className="h-4 w-4" />
            </div>
            <div className="text-xs font-semibold text-slate-900">3. AI Patch & Tests</div>
            <p className="text-[11px] text-slate-500 leading-normal">
              Gemini crafts the minimal correct fix and writes dedicated regression test assertions.
            </p>
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-4 space-y-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="text-xs font-semibold text-slate-900">4. Sandbox Verification</div>
            <p className="text-[11px] text-slate-500 leading-normal">
              Executes the test suite in a restricted container to guarantee zero regressions.
            </p>
          </div>
        </div>
      </div>

      {/* Recent Analyses Section */}
      {!lookupResult && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Recent Analyses</h2>
            <span className="text-xs text-slate-500">0 sessions</span>
          </div>

          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-12 px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
              <Terminal className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">No analyses run yet</h3>
            <p className="mt-1 max-w-sm text-xs text-slate-500 leading-relaxed">
              When you enter a public GitHub issue above, verified issue details and repository
              metadata will appear here. Full AI patch suggestions and sandbox verification will
              follow in Phase 3.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={fillExample}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
              >
                <span>Load example issue above</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
