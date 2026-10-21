// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardPage } from '../src/pages/DashboardPage';
import * as api from '../src/lib/api';
import { ApiError } from '../src/lib/api';
import type { IssueLookupResponse } from '@prpilot/shared';

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

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
    const lookupSpy = vi.spyOn(api, 'lookupGithubIssue');
    renderWithClient(<DashboardPage />);

    const input = screen.getByLabelText(/GitHub Issue URL/i);
    const submitBtn = screen.getByRole('button', { name: /Analyze issue/i });

    fireEvent.change(input, { target: { value: 'https://gitlab.com/owner/repo/issues/123' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByText(/github\.com/i)).toBeDefined();
    });

    expect(lookupSpy).not.toHaveBeenCalled();
  });

  it('displays loading state during issue lookup and prevents duplicate submissions', async () => {
    let resolveMockPromise: (val: unknown) => void;
    const controlledPromise = new Promise((resolve) => {
      resolveMockPromise = resolve;
    });

    vi.spyOn(api, 'lookupGithubIssue').mockReturnValue(
      controlledPromise as Promise<IssueLookupResponse>
    );

    renderWithClient(<DashboardPage />);

    const input = screen.getByLabelText(/GitHub Issue URL/i);

    fireEvent.change(input, {
      target: { value: 'https://github.com/facebook/react/issues/28000' },
    });

    const submitBtn = screen.getByRole('button', { name: /Analyze issue/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Analyzing\.\.\./i)).toBeDefined();
      expect(submitBtn.hasAttribute('disabled')).toBe(true);
      expect(input.hasAttribute('disabled')).toBe(true);
    });

    resolveMockPromise!({
      issue: {
        number: 28000,
        title: 'Resolved',
        body: null,
        state: 'open',
        htmlUrl: 'https://github.com/facebook/react/issues/28000',
        authorLogin: 'test',
        labels: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        closedAt: null,
        isPullRequest: false,
      },
      repository: {
        ownerLogin: 'facebook',
        name: 'react',
        fullName: 'facebook/react',
        description: null,
        htmlUrl: 'https://github.com/facebook/react',
        defaultBranch: 'main',
        primaryLanguage: null,
        stars: 1,
        openIssueCount: 1,
        isArchived: false,
      },
    });
  });

  it('renders issue details, repository summary, and Phase 3 readiness panel on success', async () => {
    const mockData: IssueLookupResponse = {
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
    };

    vi.spyOn(api, 'lookupGithubIssue').mockResolvedValue(mockData);

    renderWithClient(<DashboardPage />);

    const input = screen.getByLabelText(/GitHub Issue URL/i);
    fireEvent.change(input, {
      target: { value: 'https://github.com/facebook/react/issues/28000' },
    });

    const submitBtn = screen.getByRole('button', { name: /Analyze issue/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Fix transition race condition in fiber')).toBeDefined();
      expect(screen.getByText(/facebook\/react #28000/i)).toBeDefined();
      expect(screen.getByText(/@acdlite/i)).toBeDefined();
      expect(screen.getByText('Core Architecture')).toBeDefined();
      expect(screen.getByText(/Here is the detailed issue reproduction steps/i)).toBeDefined();
      expect(screen.getByText('The library for web and native user interfaces.')).toBeDefined();
      expect(screen.getByText(/Phase 3 Next Steps/i)).toBeDefined();
    });
  });

  it('renders API error banner without losing user input on 404', async () => {
    const lookupSpy = vi
      .spyOn(api, 'lookupGithubIssue')
      .mockRejectedValueOnce(new ApiError('GitHub issue or repository not found', 404));

    renderWithClient(<DashboardPage />);

    const input = screen.getByLabelText(/GitHub Issue URL/i);
    fireEvent.change(input, {
      target: { value: 'https://github.com/owner/repo/issues/404' },
    });

    const submitBtn = screen.getByRole('button', { name: /Analyze issue/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(lookupSpy).toHaveBeenCalledWith('https://github.com/owner/repo/issues/404');
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Issue or Repository Not Found/i })).toBeDefined();
      expect(screen.getByText('GitHub issue or repository not found')).toBeDefined();
    });

    expect((input as HTMLInputElement).value).toBe('https://github.com/owner/repo/issues/404');
  });

  it('renders retry button on connection failure and allows retrying request', async () => {
    const lookupSpy = vi
      .spyOn(api, 'lookupGithubIssue')
      .mockRejectedValueOnce(
        new ApiError('Unable to connect to PRPilot API. Network offline.', 502)
      )
      .mockResolvedValueOnce({
        issue: {
          number: 100,
          title: 'Resolved on retry',
          body: null,
          state: 'open',
          htmlUrl: 'https://github.com/owner/repo/issues/100',
          authorLogin: 'coder',
          labels: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          closedAt: null,
          isPullRequest: false,
        },
        repository: {
          ownerLogin: 'owner',
          name: 'repo',
          fullName: 'owner/repo',
          description: null,
          htmlUrl: 'https://github.com/owner/repo',
          defaultBranch: 'main',
          primaryLanguage: null,
          stars: 10,
          openIssueCount: 1,
          isArchived: false,
        },
      });

    renderWithClient(<DashboardPage />);

    const input = screen.getByLabelText(/GitHub Issue URL/i);
    fireEvent.change(input, {
      target: { value: 'https://github.com/owner/repo/issues/100' },
    });

    const submitBtn = screen.getByRole('button', { name: /Analyze issue/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Upstream GitHub Connection Error/i)).toBeDefined();
      expect(screen.getByRole('button', { name: /Retry/i })).toBeDefined();
    });

    const retryBtn = screen.getByRole('button', { name: /Retry/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Resolved on retry')).toBeDefined();
    });

    expect(lookupSpy).toHaveBeenCalledTimes(2);
  });
});
