import React, { useState } from 'react';
import {
  Search,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileCode2,
  Terminal,
  ShieldCheck,
  Bot,
  Sparkles,
  Loader2,
} from 'lucide-react';
import {
  analyzeIssueRequestSchema,
  parseGithubIssueUrl,
  type ParsedGithubIssueUrl,
} from '@prpilot/shared';

const EXAMPLE_URL = 'https://github.com/facebook/react/issues/28000';

export const DashboardPage: React.FC = () => {
  const [urlInput, setUrlInput] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<ParsedGithubIssueUrl | null>(null);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrlInput(e.target.value);
    if (validationError) {
      setValidationError(null);
    }
    if (submissionSuccess) {
      setSubmissionSuccess(null);
    }
  };

  const fillExample = () => {
    setUrlInput(EXAMPLE_URL);
    setValidationError(null);
    setSubmissionSuccess(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate using the shared Zod schema
    const parseResult = analyzeIssueRequestSchema.safeParse({ issueUrl: urlInput });

    if (!parseResult.success) {
      const firstError =
        parseResult.error.issues[0]?.message || 'Please enter a valid GitHub issue URL';
      setValidationError(firstError);
      setSubmissionSuccess(null);
      return;
    }

    setValidationError(null);
    setIsSubmitting(true);

    // Simulate quick validation pass to demonstrate loading UI pattern
    setTimeout(() => {
      const parsed = parseGithubIssueUrl(urlInput);
      setSubmissionSuccess(parsed);
      setIsSubmitting(false);
    }, 600);
  };

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
                className="text-xs text-brand-600 hover:text-brand-700 font-medium hover:underline focus:outline-none"
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
                className={`block w-full rounded-lg border py-3 pl-10 pr-32 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition-colors ${
                  validationError
                    ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200'
                    : 'border-slate-300 focus:border-brand-500 focus:ring-brand-100'
                }`}
                aria-describedby={validationError ? 'url-validation-error' : 'url-helper-text'}
                disabled={isSubmitting}
                autoComplete="off"
                spellCheck={false}
              />
              <div className="absolute inset-y-1.5 right-1.5 flex items-center">
                <button
                  type="submit"
                  disabled={isSubmitting || !urlInput.trim()}
                  className="inline-flex h-full items-center gap-1.5 rounded-md bg-brand-600 px-4 text-xs font-medium text-white shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Validating...</span>
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

            {/* Validation Feedback */}
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

            {!validationError && (
              <p id="url-helper-text" className="text-xs text-slate-500">
                Enter any public GitHub issue link. Private repositories are not supported in this
                version.
              </p>
            )}
          </div>
        </form>

        {/* Phase 1 Completion Feedback Banner (Honest Milestone Status) */}
        {submissionSuccess && (
          <div className="mt-5 rounded-lg border border-brand-200 bg-brand-50/60 p-4 animate-in fade-in">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-brand-100 p-1 text-brand-700 mt-0.5">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-brand-900">
                    URL Validated: {submissionSuccess.owner}/{submissionSuccess.repo} #
                    {submissionSuccess.issueNumber}
                  </h4>
                  <span className="rounded-full bg-brand-200/70 px-2 py-0.5 text-[10px] font-semibold text-brand-800">
                    Phase 1 Milestone
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  The URL format was validated against the shared Zod schema. Full automated
                  repository cloning, Gemini triage, patch synthesis, and sandboxed test execution
                  will be activated in <strong>Phase 2</strong>.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-600 font-mono">
                  <span className="rounded bg-white px-2 py-0.5 border border-slate-200">
                    Owner: {submissionSuccess.owner}
                  </span>
                  <span className="rounded bg-white px-2 py-0.5 border border-slate-200">
                    Repo: {submissionSuccess.repo}
                  </span>
                  <span className="rounded bg-white px-2 py-0.5 border border-slate-200">
                    Issue: #{submissionSuccess.issueNumber}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

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
              Parses issue description, stack traces, and community discussion for key context.
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

      {/* Recent Analyses Section (Honest Empty State) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Recent Analyses</h2>
          <span className="text-xs text-slate-500">0 sessions</span>
        </div>

        {/* Useful empty state without fabricated data */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-12 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
            <Terminal className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900">No analyses run yet</h3>
          <p className="mt-1 max-w-sm text-xs text-slate-500 leading-relaxed">
            When you run an issue analysis in Phase 2, repository breakdown, AI patch suggestions,
            diff comparisons, and sandbox verification logs will appear here.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={fillExample}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <span>Load example issue above</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
