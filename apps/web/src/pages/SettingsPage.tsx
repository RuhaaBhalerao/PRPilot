import React from 'react';
import { KeyRound, ShieldAlert, Cpu, Bot, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export const SettingsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-600">
          <ShieldAlert className="h-3 w-3" />
          <span>Coming in Phase 2</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings & Preferences</h1>
        <p className="text-sm text-slate-500">
          Configure authentication, AI models, and sandboxed execution environments.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div className="rounded-lg bg-amber-50/70 border border-amber-200 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-amber-900">
                Settings Configuration is Not Implemented in Phase 1
              </h3>
              <p className="text-xs text-amber-800 leading-relaxed">
                As per the Phase 1 specification, external secrets, AI SDK configurations, and
                database settings are intentionally omitted. These configuration panels show what
                will be manageable in Phase 2.
              </p>
            </div>
          </div>
        </div>

        {/* Future Settings Options (Honest Disabled Placeholders) */}
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 p-4 opacity-75">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-800">GitHub Authentication</h4>
                  <p className="text-xs text-slate-500">
                    GitHub Personal Access Token for creating branches and submitting pull requests.
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 border border-slate-200">
                Phase 2
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-4 opacity-75">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-800">Gemini AI Model</h4>
                  <p className="text-xs text-slate-500">
                    Configure Google Gemini 1.5 Pro / Flash API keys and synthesis parameters.
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 border border-slate-200">
                Phase 2
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-4 opacity-75">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <Cpu className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-800">Execution Sandbox</h4>
                  <p className="text-xs text-slate-500">
                    Docker container isolation policies and execution resource timeouts.
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 border border-slate-200">
                Phase 2
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
