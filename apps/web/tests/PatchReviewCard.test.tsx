// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PatchReviewCard } from '../src/components/github/PatchReviewCard';
import type { PatchGenerationResponse, PatchVerificationResponse } from '@prpilot/shared';
import * as apiModule from '../src/lib/api';

vi.mock('../src/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/api')>();
  return {
    ...actual,
    verifyPatchApi: vi.fn(),
  };
});

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('PatchReviewCard Frontend Component', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockImplementation(() => Promise.resolve()),
      },
    });
  });

  const sampleDiff = `--- a/src/index.js
+++ b/src/index.js
@@ -1,3 +1,4 @@
 export function start() {
+  console.log('started');
   return true;
 }
`;

  const eligiblePatch: PatchGenerationResponse = {
    analysisId: '11111111-2222-3333-4444-555555555555',
    issueUrl: 'https://github.com/facebook/react/issues/100',
    repository: 'facebook/react',
    eligibility: {
      eligible: true,
      status: 'eligible',
      blockers: [],
      allowOverride: false,
    },
    status: 'generated',
    suspectedRootCause: 'Missing startup log statement in initialization sequence',
    unifiedDiff: sampleDiff,
    fileExplanations: [
      {
        path: 'src/index.js',
        relevanceReason: 'Entry point',
        changeSummary: 'Added log statement',
        addressedRegressionTest: 'logs on startup',
      },
    ],
    regressionTests: [
      {
        title: 'should log upon start',
        targetFile: 'src/index.js',
        testFramework: 'vitest',
        testCode: "it('logs start', () => { start(); expect(console.log).toHaveBeenCalled(); });",
        description: 'Verifies start log',
        executionStatus: 'not_run',
      },
    ],
    assumptionsAndUncertainties: ['Assumes console is available globally'],
    validation: {
      isValid: true,
      status: 'validated',
      appliedCleanly: true,
      validationErrors: [],
      validationWarnings: [],
      parsedFiles: [
        {
          oldPath: 'src/index.js',
          newPath: 'src/index.js',
          additions: 1,
          deletions: 0,
          hunksCount: 1,
        },
      ],
      totalAdditions: 1,
      totalDeletions: 0,
    },
    generatedAt: '2024-01-01T00:00:00Z',
  };

  const notEligiblePatch: PatchGenerationResponse = {
    issueUrl: 'https://github.com/facebook/react/issues/200',
    repository: 'facebook/react',
    eligibility: {
      eligible: false,
      status: 'not_eligible',
      blockers: [
        'Issue is closed on GitHub. Closed issues may represent resolved bugs or intentional exercises.',
      ],
      allowOverride: true,
    },
    status: 'not_eligible',
    suspectedRootCause: null,
    unifiedDiff: null,
    fileExplanations: [],
    regressionTests: [],
    assumptionsAndUncertainties: [],
    validation: null,
    generatedAt: '2024-01-01T00:00:00Z',
  };

  it('renders initial empty state with trigger button and safety guarantee', () => {
    renderWithClient(<PatchReviewCard issueUrl="https://github.com/facebook/react/issues/100" />);

    expect(screen.getByText('AI Patch Generation & Regression Test Synthesis')).toBeDefined();
    expect(screen.getByText('No patch generated yet')).toBeDefined();
    expect(screen.getByRole('button', { name: /Generate Patch/i })).toBeDefined();
    expect(screen.getByText(/Safety boundary guarantee/i)).toBeDefined();
  });

  it('renders eligibility blockers when patch generation is not eligible', () => {
    renderWithClient(
      <PatchReviewCard
        issueUrl="https://github.com/facebook/react/issues/200"
        initialPatch={notEligiblePatch}
      />
    );

    expect(screen.getByText('Patch Generation Blocked (Eligibility Gate)')).toBeDefined();
    expect(screen.getByText(/Issue is closed on GitHub/i)).toBeDefined();
    expect(screen.getByLabelText(/Allow closed issue override/i)).toBeDefined();
  });

  it('renders unified diff, file explanations, and regression tests for valid patch', () => {
    renderWithClient(
      <PatchReviewCard
        issueUrl="https://github.com/facebook/react/issues/100"
        initialPatch={eligiblePatch}
      />
    );

    expect(screen.getByText('Validated (Dry-Run Clean)')).toBeDefined();
    expect(screen.getByText('Proposed Unified Diff')).toBeDefined();
    expect(screen.getByText('src/index.js')).toBeDefined();
    expect(screen.getByText('Added log statement')).toBeDefined();
    expect(screen.getByText('should log upon start')).toBeDefined();
    expect(screen.getByText('Status: not_run (Safety Boundary)')).toBeDefined();
  });

  it('allows copying the unified diff and regression test code to clipboard', async () => {
    renderWithClient(
      <PatchReviewCard
        issueUrl="https://github.com/facebook/react/issues/100"
        initialPatch={eligiblePatch}
      />
    );

    const copyDiffButton = screen.getByText('Copy Diff');
    fireEvent.click(copyDiffButton);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(sampleDiff);

    await waitFor(() => {
      expect(screen.getByText('Copied')).toBeDefined();
    });
  });

  it('renders verification panel and performs structural verification on action', async () => {
    const mockVerification: PatchVerificationResponse = {
      issueUrl: 'https://github.com/facebook/react/issues/100',
      structuralValidation: {
        status: 'validated',
        isValid: true,
        appliedCleanly: true,
        validationErrors: [],
        validationWarnings: [],
        parsedFiles: [
          {
            oldPath: 'src/index.js',
            newPath: 'src/index.js',
            additions: 1,
            deletions: 0,
            hunksCount: 1,
          },
        ],
        totalAdditions: 1,
        totalDeletions: 0,
      },
      testExecutionStatus: 'not_run',
      sandboxDetails: {
        available: false,
        status: 'not_run',
        reason: 'Host test execution is disabled to maintain strict isolation boundaries.',
      },
      verifiedAt: '2024-01-01T00:00:00Z',
    };

    vi.mocked(apiModule.verifyPatchApi).mockResolvedValueOnce(mockVerification);

    renderWithClient(
      <PatchReviewCard
        issueUrl="https://github.com/facebook/react/issues/100"
        initialPatch={eligiblePatch}
      />
    );

    expect(screen.getByText('Patch Verification & Sandbox Boundary')).toBeDefined();
    const verifyButton = screen.getByRole('button', { name: /Verify Patch/i });
    expect(verifyButton).toBeDefined();

    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(apiModule.verifyPatchApi).toHaveBeenCalledWith({
        analysisId: undefined,
        issueUrl: 'https://github.com/facebook/react/issues/100',
        unifiedDiff: sampleDiff,
        runSandboxTests: false,
      });
      expect(screen.getByText('Safe (Repository Rooted)')).toBeDefined();
      expect(screen.getByText(/Important Verification Distinction/i)).toBeDefined();
    });
  });

  it('handles sandbox execution request gracefully returning sandbox_unavailable', async () => {
    const mockSandboxUnavailable: PatchVerificationResponse = {
      issueUrl: 'https://github.com/facebook/react/issues/100',
      structuralValidation: {
        status: 'validated',
        isValid: true,
        appliedCleanly: true,
        validationErrors: [],
        validationWarnings: [],
        parsedFiles: [
          {
            oldPath: 'src/index.js',
            newPath: 'src/index.js',
            additions: 1,
            deletions: 0,
            hunksCount: 1,
          },
        ],
        totalAdditions: 1,
        totalDeletions: 0,
      },
      testExecutionStatus: 'sandbox_unavailable',
      sandboxDetails: {
        available: false,
        status: 'sandbox_unavailable',
        reason:
          'Safe containerized sandbox execution environment is not configured on this host. Untrusted test code execution was safely aborted.',
      },
      verifiedAt: '2024-01-01T00:00:00Z',
    };

    vi.mocked(apiModule.verifyPatchApi).mockResolvedValueOnce(mockSandboxUnavailable);

    renderWithClient(
      <PatchReviewCard
        issueUrl="https://github.com/facebook/react/issues/100"
        initialPatch={eligiblePatch}
      />
    );

    const checkbox = screen.getByLabelText(/Request Sandbox Run/i);
    fireEvent.click(checkbox);

    const verifyButton = screen.getByRole('button', { name: /Verify Patch/i });
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(apiModule.verifyPatchApi).toHaveBeenCalledWith({
        analysisId: undefined,
        issueUrl: 'https://github.com/facebook/react/issues/100',
        unifiedDiff: sampleDiff,
        runSandboxTests: true,
      });
      expect(screen.getByText('sandbox_unavailable')).toBeDefined();
      expect(
        screen.getByText(/Safe containerized sandbox execution environment is not configured/i)
      ).toBeDefined();
    });
  });
});
