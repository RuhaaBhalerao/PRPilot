// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { HistoryPage } from '../src/pages/HistoryPage';
import * as api from '../src/lib/api';
import { ApiError } from '../src/lib/api';
import type { AnalysisHistoryListResponse } from '@prpilot/shared';

const mockHistoryData: AnalysisHistoryListResponse = {
  items: [
    {
      id: '22222222-3333-4444-5555-666666666666',
      issueUrl: 'https://github.com/facebook/react/issues/27986',
      issueTitle: 'Bug: Found an error on React Documentation Site',
      repository: 'facebook/react',
      status: 'completed',
      createdAt: '2024-03-01T12:00:00.000Z',
      updatedAt: '2024-03-01T12:00:00.000Z',
    },
    {
      id: '33333333-4444-5555-6666-777777777777',
      issueUrl: 'https://github.com/nodejs/node/issues/45000',
      issueTitle: 'TLS connection hang under high concurrency',
      repository: 'nodejs/node',
      status: 'failed',
      createdAt: '2024-02-28T09:30:00.000Z',
      updatedAt: '2024-02-28T09:30:00.000Z',
    },
  ],
  total: 2,
  limit: 50,
  offset: 0,
};

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('HistoryPage Frontend Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('displays loading state while fetching analysis history', () => {
    vi.spyOn(api, 'fetchAnalysesHistory').mockReturnValue(new Promise(() => {}));

    renderWithClient(<HistoryPage />);

    expect(screen.getByRole('status', { name: /loading history/i })).toBeDefined();
  });

  it('renders empty state when no analyses exist in database', async () => {
    vi.spyOn(api, 'fetchAnalysesHistory').mockResolvedValue({
      items: [],
      total: 0,
      limit: 50,
      offset: 0,
    });

    renderWithClient(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByText(/No analyses recorded yet/i)).toBeDefined();
      expect(screen.getByRole('link', { name: /Analyze an Issue/i })).toBeDefined();
    });
  });

  it('renders analysis records with title, repository, date, status, and reopen link', async () => {
    vi.spyOn(api, 'fetchAnalysesHistory').mockResolvedValue(mockHistoryData);

    renderWithClient(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByText('Bug: Found an error on React Documentation Site')).toBeDefined();
      expect(screen.getByText('TLS connection hang under high concurrency')).toBeDefined();
      expect(screen.getByText('facebook/react')).toBeDefined();
      expect(screen.getByText('nodejs/node')).toBeDefined();
      expect(screen.getByText(/completed/i)).toBeDefined();
      expect(screen.getByText(/failed/i)).toBeDefined();
    });

    // Check reopen links
    const reopenLinks = screen.getAllByRole('link', { name: /Reopen Analysis/i });
    expect(reopenLinks).toHaveLength(2);
    expect(reopenLinks[0].getAttribute('href')).toBe('/?id=22222222-3333-4444-5555-666666666666');
  });

  it('renders error banner with retry option on API failure', async () => {
    const fetchSpy = vi
      .spyOn(api, 'fetchAnalysesHistory')
      .mockRejectedValueOnce(new ApiError('Failed to connect to database', 500))
      .mockResolvedValueOnce(mockHistoryData);

    renderWithClient(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByText(/Unable to load analysis history/i)).toBeDefined();
      expect(screen.getByText('Failed to connect to database')).toBeDefined();
      expect(screen.getByRole('button', { name: /Try Again/i })).toBeDefined();
    });

    // Click retry button
    const retryBtn = screen.getByRole('button', { name: /Try Again/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Bug: Found an error on React Documentation Site')).toBeDefined();
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
