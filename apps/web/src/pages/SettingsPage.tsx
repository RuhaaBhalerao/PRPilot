import React from 'react';
import { KeyRound, ShieldCheck, Database, Bot, ArrowLeft, Cpu, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export const SettingsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-2.5 py-0.5 text-xs font-medium text-brand-700">
          <ShieldCheck className="h-3 w-3" />
          <span>System Configuration</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings & Environment</h1>
        <p className="text-sm text-slate-500">
          Server environment parameters, AI provider integration, and database connectivity status.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-brand-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-900">
                Server-Side Security Guarantee
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                All external credentials, API keys, and database connection strings are managed
                securely on the backend server through environment variables (
                <code>apps/api/.env</code>). No sensitive secrets are ever bundled into client-side
                code or exposed via public endpoints.
              </p>
            </div>
          </div>
        </div>

        {/* Runtime Configuration Panels */}
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 p-4 bg-white shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 shrink-0">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">Google Gemini AI Engine</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Configured via <code>GEMINI_API_KEY</code>. Used for issue triage diagnostics,
                    source evidence ranking, minimal unified diff synthesis, and regression test
                    proposals.
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200 self-start sm:self-auto shrink-0">
                <CheckCircle2 className="h-3 w-3" />
                <span>Active</span>
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-4 bg-white shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">
                    GitHub REST & Git Trees API
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Configured via <code>GITHUB_TOKEN</code>. Retrieves public issue metadata,
                    maintainer discussion comments, and default-branch file tree structures.
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200 self-start sm:self-auto shrink-0">
                <CheckCircle2 className="h-3 w-3" />
                <span>Connected</span>
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-4 bg-white shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 shrink-0">
                  <Database className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">
                    Neon PostgreSQL Persistence
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Configured via <code>DATABASE_URL</code>. Persists analysis history, evidence
                    grounding metadata, and generated patch verification records with automated
                    migrations.
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 border border-indigo-200 self-start sm:self-auto shrink-0">
                <CheckCircle2 className="h-3 w-3" />
                <span>Connected</span>
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-4 bg-white shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600 border border-amber-100 shrink-0">
                  <Cpu className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">
                    Execution Sandbox Boundary
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    In-memory deterministic validation is active. Host execution of untrusted
                    AI-generated code is strictly blocked. Disposable isolated container
                    environments are planned for future evaluation.
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200 self-start sm:self-auto shrink-0">
                <span>Safe Isolation Mode</span>
              </span>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
