import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  History,
  Settings,
  GitPullRequest,
  Loader2,
  Menu,
  X,
  ExternalLink,
  Info,
} from 'lucide-react';
import { useApiHealth } from '../../hooks/useApiHealth';
import { cn } from '../../lib/utils';

export const AppLayout: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { data: health, isLoading, isError, refetch } = useApiHealth();

  const navItems = [
    {
      name: 'Dashboard',
      to: '/',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      name: 'Analysis History',
      to: '/history',
      icon: History,
      badge: 'Phase 2',
    },
    {
      name: 'Settings',
      to: '/settings',
      icon: Settings,
      badge: 'Phase 2',
    },
  ];

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/':
        return 'Dashboard';
      case '/history':
        return 'Analysis History';
      case '/settings':
        return 'Settings';
      default:
        return 'PRPilot';
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile sidebar backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-in-out lg:static lg:translate-x-0',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-6">
          <NavLink
            to="/"
            className="flex items-center gap-2.5"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm shadow-brand-500/20">
              <GitPullRequest className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-semibold tracking-tight text-slate-900">PRPilot</span>
              <span className="text-xs text-slate-500 font-mono">v0.1.0 • Phase 1</span>
            </div>
          </NavLink>
          <button
            type="button"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1.5 px-4 py-6" aria-label="Main Navigation">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Platform
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-brand-50 text-brand-700 font-semibold shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  )
                }
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={cn(
                      'h-4 w-4 transition-colors',
                      location.pathname === item.to
                        ? 'text-brand-600'
                        : 'text-slate-400 group-hover:text-slate-600'
                    )}
                  />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 border border-slate-200">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Scope Notice & Public GitHub Section */}
        <div className="p-4 border-t border-slate-200 space-y-3">
          <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-200">
            <div className="flex items-start gap-2.5">
              <Info className="h-4 w-4 text-brand-600 mt-0.5 shrink-0" />
              <div className="text-xs text-slate-600 leading-relaxed">
                <span className="font-semibold text-slate-800">Public Repositories:</span> This
                version supports inspecting public GitHub repositories. Automated triage & patch
                creation arrive in Phase 2.
              </div>
            </div>
          </div>

          {/* Backend API Health Status */}
          <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 border border-slate-200 text-xs">
            <div className="flex items-center gap-2">
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
              ) : isError ? (
                <div className="h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-rose-200" />
              ) : (
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200 animate-pulse" />
              )}
              <div className="flex flex-col">
                <span className="font-medium text-slate-700">API Status</span>
                <span className="text-[10px] text-slate-500">
                  {isLoading
                    ? 'Connecting...'
                    : isError
                      ? 'API Offline'
                      : `${health?.service} (v${health?.version})`}
                </span>
              </div>
            </div>
            <button
              onClick={() => refetch()}
              title="Refresh connection status"
              className="text-[11px] text-brand-600 hover:text-brand-800 font-medium px-1.5 py-0.5 rounded hover:bg-brand-50"
            >
              Check
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-semibold text-slate-800">{getPageTitle()}</h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500"></span>
              <span>Phase 1: Project Foundation</span>
            </div>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium px-2.5 py-1.5 rounded-md hover:bg-slate-100 transition-colors"
            >
              <span>GitHub</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </header>

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="mx-auto max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
