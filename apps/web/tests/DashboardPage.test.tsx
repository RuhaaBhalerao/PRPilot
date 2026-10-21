// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardPage } from '../src/pages/DashboardPage';
import * as api from '../src/lib/api';
import { ApiError } from '../src/lib/api';
import type { AnalyzeIssueResponse } from '@prpilot/shared';

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const mockAnalysisData: AnalyzeIssueResponse = {
  issue: {
    number: 28000,
    title: 'Fix transition race condition in fiber',
    body: 'Here is the detailed issue reproduction steps.',
    state: 'open',
    htmlUrl: 'https://github.com/facebook/react/issues/28000',
    authorLogin: 'acdlite',
    labels: [{ id: 1, name: 'Core Architecture', color: '61dafb' }],
    createdAt: '2024-01-10T10:00:00Z',
    updatedAt: '2024-01-11T12:00:00Z',
    closedAt: null,
    isPullRequest: false,
  },
  repository: {
    ownerLogin: 'facebook',
    name: 'react',
    fullName: 'facebook/react',
    description: 'The library for web and native user interfaces.',
    htmlUrl: 'https://github.com/facebook/react',
    defaultBranch: 'main',
    primaryLanguage: 'JavaScript',
    stars: 220000,
    openIssueCount: 850,
    isArchived: false,
  },
  analysis: {
    problemSummary: 'Race condition occurring during fiber transitions under concurrent rendering.',
    expectedBehaviour: 'Fiber transitions should remain deterministic without dropping updates.',
    rootCauseHypotheses: [
      'Concurrent update queue is read without proper lane masking during transitions.',
    ],
    evidenceAndMissingInformation: {
      verifiedFacts: ['Issue reproduced consistently under concurrent root mode.'],
      hypotheses: ['Lanes bitmask overflow under high concurrency.'],
      missingInformation: ['Specific React build version and browser engine.'],
    },
    filesOrComponentsToInvestigate: [
      {
        name: 'packages/react-reconciler/src/ReactFiberWorkLoop.js',
        reason: 'Controls transition lane scheduling and work loop processing.',
      },
    ],
    proposedFixSteps: [
      'Reproduce the transition race with a concurrent test case.',
      'Check lane masking logic in the work loop scheduler.',
      'Ensure work in progress root preserves pending transitions.',
    ],
    regressionTestPlan: ['Add a multi-threaded stress test with concurrent transition dispatches.'],
    repositoryContextAvailable: false,
    repositoryContextLimitation:
      'Repository source files were not retrieved at this triage stage; file suggestions and root causes are hypotheses based on the issue description, stack traces, and metadata.',
    isClosedIssue: false,
    closedIssueNotice: null,
  },
};

describe('DashboardPage frontend integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders issue form with labelled input and submit button', () => {
    renderWithClient(<DashboardPage />);

    expect(screen.getByLabelText(/GitHub Issue URL/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Analyze issue/i })).toBeDefined();
    expect(screen.getByText(/Try an example URL/i)).toBeDefined();
  });

  it('displays client-side validation feedback for invalid URLs and prevents submission', async () => {
    const analyzeSpy = vi.spyOn(api, 'analyzeGithubIssue');
    renderWithClient(<DashboardPage />);

    const input = screen.getByLabelText(/GitHub Issue URL/i);
    const submitBtn = screen.getByRole('button', { name: /Analyze issue/i });

    fireEvent.change(input, { target: { value: 'https://gitlab.com/owner/repo/issues/123' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByText(/github\.com/i)).toBeDefined();
    });

    expect(analyzeSpy).not.toHaveBeenCalled();
  });

  it('displays loading state during issue analysis and prevents duplicate submissions', async () => {
    let resolveMockPromise: (val: unknown) => void;
    const controlledPromise = new Promise((resolve) => {
      resolveMockPromise = resolve;
    });

    vi.spyOn(api, 'analyzeGithubIssue').mockReturnValue(
      controlledPromise as Promise<AnalyzeIssueResponse>
    );

    renderWithClient(<DashboardPage />);

    const input = screen.getByLabelText(/GitHub Issue URL/i);

    fireEvent.change(input, {
      target: { value: 'https://github.com/facebook/react/issues/28000' },
    });

    const submitBtn = screen.getByRole('button', { name: /Analyze issue/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Analyzing issue\.\.\./i)).toBeDefined();
      expect(submitBtn.hasAttribute('disabled')).toBe(true);
      expect(input.hasAttribute('disabled')).toBe(true);
    });

    resolveMockPromise!(mockAnalysisData);
  });

  it('renders issue details, repository summary, and 7-section AI analysis on success', async () => {
    vi.spyOn(api, 'analyzeGithubIssue').mockResolvedValue(mockAnalysisData);

    renderWithClient(<DashboardPage />);

    const input = screen.getByLabelText(/GitHub Issue URL/i);
    fireEvent.change(input, {
      target: { value: 'https://github.com/facebook/react/issues/28000' },
    });

    const submitBtn = screen.getByRole('button', { name: /Analyze issue/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      // Issue summary card
      expect(screen.getByText('Fix transition race condition in fiber')).toBeDefined();
      expect(screen.getByText(/facebook\/react #28000/i)).toBeDefined();
      expect(screen.getByText(/@acdlite/i)).toBeDefined();

      // Repository card
      expect(screen.getByText('The library for web and native user interfaces.')).toBeDefined();

      // AI Analysis 7 sections
      expect(screen.getByText(/AI-Powered Issue Triage/i)).toBeDefined();
      expect(screen.getByText(/1\. Problem Summary/i)).toBeDefined();
      expect(screen.getByText(/2\. Expected Behaviour/i)).toBeDefined();
      expect(screen.getByText(/3\. Root-Cause Hypotheses/i)).toBeDefined();
      expect(screen.getByText(/4\. Evidence and Missing Information/i)).toBeDefined();
      expect(screen.getByText(/5\. Files or Components to Investigate/i)).toBeDefined();
      expect(screen.getByText(/6\. Proposed Fix Steps/i)).toBeDefined();
      expect(screen.getByText(/7\. Regression Test Plan/i)).toBeDefined();

      // Repository context limitation notice
      expect(screen.getByText(/Repository Context Limitation/i)).toBeDefined();
    });
  });

  it('renders closed issue advisory notice when analyzing a closed GitHub issue', async () => {
    const closedData: AnalyzeIssueResponse = {
      ...mockAnalysisData,
      issue: {
        ...mockAnalysisData.issue,
        state: 'closed',
        closedAt: '2024-02-01T00:00:00Z',
      },
      analysis: {
        ...mockAnalysisData.analysis,
        isClosedIssue: true,
        closedIssueNotice:
          'Notice: This issue is closed on GitHub. Closed issues may have already been resolved or rejected.',
      },
    };

    vi.spyOn(api, 'analyzeGithubIssue').mockResolvedValue(closedData);

    renderWithClient(<DashboardPage />);

    const input = screen.getByLabelText(/GitHub Issue URL/i);
    fireEvent.change(input, {
      target: { value: 'https://github.com/facebook/react/issues/28000' },
    });

    const submitBtn = screen.getByRole('button', { name: /Analyze issue/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Closed Issue Advisory/i)).toBeDefined();
      expect(screen.getByText(/This issue is closed on GitHub/i)).toBeDefined();
    });
  });

  it('renders API error banner without losing user input on 404', async () => {
    const analyzeSpy = vi
      .spyOn(api, 'analyzeGithubIssue')
      .mockRejectedValueOnce(new ApiError('GitHub issue or repository not found', 404));

    renderWithClient(<DashboardPage />);

    const input = screen.getByLabelText(/GitHub Issue URL/i);
    fireEvent.change(input, {
      target: { value: 'https://github.com/owner/repo/issues/404' },
    });

    const submitBtn = screen.getByRole('button', { name: /Analyze issue/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(analyzeSpy).toHaveBeenCalledWith('https://github.com/owner/repo/issues/404');
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Issue or Repository Not Found/i })).toBeDefined();
      expect(screen.getByText('GitHub issue or repository not found')).toBeDefined();
    });

    expect((input as HTMLInputElement).value).toBe('https://github.com/owner/repo/issues/404');
  });

  it('renders retry button on connection failure and allows retrying request', async () => {
    const analyzeSpy = vi
      .spyOn(api, 'analyzeGithubIssue')
      .mockRejectedValueOnce(
        new ApiError('Unable to connect to PRPilot API. Network offline.', 502)
      )
      .mockResolvedValueOnce(mockAnalysisData);

    renderWithClient(<DashboardPage />);

    const input = screen.getByLabelText(/GitHub Issue URL/i);
    fireEvent.change(input, {
      target: { value: 'https://github.com/owner/repo/issues/100' },
    });

    const submitBtn = screen.getByRole('button', { name: /Analyze issue/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Upstream Provider Error/i)).toBeDefined();
      expect(screen.getByRole('button', { name: /Retry/i })).toBeDefined();
    });

    const retryBtn = screen.getByRole('button', { name: /Retry/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Fix transition race condition in fiber')).toBeDefined();
    });

    expect(analyzeSpy).toHaveBeenCalledTimes(2);
  });

  it('renders primary rate limit error banner with reset time and cooldown guidance', async () => {
    const futureReset = new Date(Date.now() + 3600000).toISOString();
    const formattedResetTime = new Date(futureReset).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    vi.spyOn(api, 'analyzeGithubIssue').mockRejectedValueOnce(
      new ApiError(
        `GitHub API primary rate limit exceeded. Limit will reset at ${formattedResetTime}. Please wait until the reset time before retrying.`,
        429,
        {
          rateLimitType: 'primary',
          resetAt: futureReset,
        }
      )
    );

    renderWithClient(<DashboardPage />);

    const input = screen.getByLabelText(/GitHub Issue URL/i);
    fireEvent.change(input, {
      target: { value: 'https://github.com/facebook/react/issues/28000' },
    });

    const submitBtn = screen.getByRole('button', { name: /Analyze issue/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Rate Limit Reached/i })).toBeDefined();
      expect(
        screen.getByText(new RegExp(`Reset time:\\s*${formattedResetTime}`, 'i'))
      ).toBeDefined();
      expect(screen.getByText(/GitHub API primary rate limit exceeded/i)).toBeDefined();
      expect(
        screen.getByText(/Repeated requests during the cooldown window may prolong throttling/i)
      ).toBeDefined();
      expect(screen.getByRole('button', { name: /Retry/i })).toBeDefined();
    });
  });

  it('renders secondary rate limit error banner with specific title and cautionary guidance', async () => {
    const futureReset = new Date(Date.now() + 120000).toISOString();
    const formattedResetTime = new Date(futureReset).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    vi.spyOn(api, 'analyzeGithubIssue').mockRejectedValueOnce(
      new ApiError(
        `GitHub API secondary rate limit triggered. Throttled until ${formattedResetTime}. Repeated requests before the cooldown period may prolong the block.`,
        429,
        {
          rateLimitType: 'secondary',
          resetAt: futureReset,
          retryAfterSeconds: 120,
        }
      )
    );

    renderWithClient(<DashboardPage />);

    const input = screen.getByLabelText(/GitHub Issue URL/i);
    fireEvent.change(input, {
      target: { value: 'https://github.com/facebook/react/issues/28000' },
    });

    const submitBtn = screen.getByRole('button', { name: /Analyze issue/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /GitHub Secondary Rate Limit Triggered/i })
      ).toBeDefined();
      expect(
        screen.getByText(new RegExp(`Reset time:\\s*${formattedResetTime}`, 'i'))
      ).toBeDefined();
      expect(
        screen.getByText(/Repeated requests during the cooldown window may prolong throttling/i)
      ).toBeDefined();
      expect(screen.getByRole('button', { name: /Retry/i })).toBeDefined();
    });
  });

  it('renders rate limit guidance gracefully when reset time header is not provided', async () => {
    vi.spyOn(api, 'analyzeGithubIssue').mockRejectedValueOnce(
      new ApiError(
        'GitHub API secondary rate limit triggered. Please wait a few minutes before retrying.',
        429,
        {
          rateLimitType: 'secondary',
        }
      )
    );

    renderWithClient(<DashboardPage />);

    const input = screen.getByLabelText(/GitHub Issue URL/i);
    fireEvent.change(input, {
      target: { value: 'https://github.com/facebook/react/issues/28000' },
    });

    const submitBtn = screen.getByRole('button', { name: /Analyze issue/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /GitHub Secondary Rate Limit Triggered/i })
      ).toBeDefined();
      expect(
        screen.getByText(
          /Please wait before retrying\. Repeated requests during the cooldown window may prolong throttling\./i
        )
      ).toBeDefined();
      expect(screen.queryByText(/Reset time:/i)).toBeNull();
      expect(screen.getByRole('button', { name: /Retry/i })).toBeDefined();
    });
  });
});
