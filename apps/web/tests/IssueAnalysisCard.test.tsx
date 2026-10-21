// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { IssueAnalysisCard } from '../src/components/github/IssueAnalysisCard';
import type { IssueAnalysis } from '@prpilot/shared';

describe('IssueAnalysisCard Frontend Component (Phase 5 Evidence Display)', () => {
  const baseAnalysis: IssueAnalysis = {
    problemSummary: 'Race condition in concurrent work loop causing dropped lanes.',
    expectedBehaviour: 'All lanes should be scheduled and executed deterministically.',
    rootCauseHypotheses: ['Lanes bitmask is overwritten during concurrent yield.'],
    evidenceAndMissingInformation: {
      verifiedFacts: ['Observed in packages/react-reconciler/src/ReactFiberWorkLoop.js line 452.'],
      hypotheses: ['Concurrent yield allows interleaved dispatcher invocation.'],
      missingInformation: ['Specific React priority level and browser engine.'],
    },
    filesOrComponentsToInvestigate: [
      {
        name: 'packages/react-reconciler/src/ReactFiberWorkLoop.js',
        reason: 'Contains the concurrent work loop.',
        isGroundedEvidence: true,
        htmlUrl:
          'https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberWorkLoop.js',
      },
      {
        name: 'packages/scheduler/src/Scheduler.js',
        reason: 'Hypothetical scheduling coordinator.',
        isGroundedEvidence: false,
      },
    ],
    proposedFixSteps: [
      'Add atomic check to lane bitmask update.',
      'Run concurrent regression tests.',
    ],
    regressionTestPlan: ['Add a multi-lane concurrent yield stress test.'],
    repositoryContextAvailable: true,
    repositoryContextLimitation: 'Analysis grounded in 1 retrieved repository source file(s).',
    repositoryEvidence: {
      status: 'completed',
      inspectedFileCount: 1,
      limitation: null,
      treeTruncated: false,
      files: [
        {
          path: 'packages/react-reconciler/src/ReactFiberWorkLoop.js',
          sizeBytes: 15400,
          relevanceScore: 160,
          relevanceReason: 'Explicitly referenced path in issue',
          htmlUrl:
            'https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberWorkLoop.js',
          excerpt:
            '1: export function workLoopConcurrent() {\n2:   while (workInProgress !== null) {\n3:     performUnitOfWork(workInProgress);\n4:   }\n5: }',
        },
      ],
    },
    isClosedIssue: false,
    closedIssueNotice: null,
  };

  it('renders grounded evidence with inspected files, scores, reasons, and clickable GitHub links', () => {
    render(<IssueAnalysisCard analysis={baseAnalysis} />);

    // Section title & metrics
    expect(screen.getByText(/Repository Intelligence & Inspected Source Files/i)).toBeDefined();
    expect(screen.getByText(/Direct Source Grounded/i)).toBeDefined();
    expect(screen.getByText(/1 source file\(s\) retrieved and analyzed/i)).toBeDefined();

    // Inspected file card
    expect(screen.getByText('Score: 160')).toBeDefined();
    expect(screen.getByText(/Explicitly referenced path in issue/i)).toBeDefined();

    // GitHub link
    const ghLink = screen.getByRole('link', { name: /View on GitHub/i });
    expect(ghLink.getAttribute('href')).toBe(
      'https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberWorkLoop.js'
    );
    expect(ghLink.getAttribute('target')).toBe('_blank');

    // Code snippet with line numbers (expanded by default)
    expect(screen.getByText(/1: export function workLoopConcurrent\(\)/i)).toBeDefined();
    expect(screen.getByText(/Line numbers preserved/i)).toBeDefined();

    // Section 4 Observed evidence vs Hypotheses vs Missing Info
    expect(screen.getByText(/Observed Evidence \(Facts\)/i)).toBeDefined();
    expect(screen.getAllByText(/Hypotheses/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Missing Information \(Unknowns\)/i)).toBeDefined();

    // Section 5 grounded vs uninspected hypothesis badges
    expect(screen.getByText('Direct Grounded Evidence')).toBeDefined();
    expect(screen.getByText('Hypothesis (Uninspected)')).toBeDefined();
  });

  it('allows toggling the code excerpt between expanded and collapsed states', () => {
    render(<IssueAnalysisCard analysis={baseAnalysis} />);

    // Initially expanded
    expect(screen.getByText(/Hide Excerpt/i)).toBeDefined();
    expect(screen.getByText(/1: export function workLoopConcurrent\(\)/i)).toBeDefined();

    // Click toggle to collapse
    const toggleBtn = screen.getByRole('button', { name: /Hide Excerpt/i });
    fireEvent.click(toggleBtn);

    expect(screen.getByText(/View Excerpt/i)).toBeDefined();
    expect(screen.queryByText(/1: export function workLoopConcurrent\(\)/i)).toBeNull();

    // Click toggle to re-expand
    fireEvent.click(toggleBtn);
    expect(screen.getByText(/Hide Excerpt/i)).toBeDefined();
    expect(screen.getByText(/1: export function workLoopConcurrent\(\)/i)).toBeDefined();
  });

  it('renders partial source inspection badge and limitation warning when retrieval was partial', () => {
    const partialAnalysis: IssueAnalysis = {
      ...baseAnalysis,
      repositoryEvidence: {
        ...baseAnalysis.repositoryEvidence!,
        status: 'partial',
        limitation: 'Repository tree truncated due to size; analyzed top available files.',
        treeTruncated: true,
      },
    };

    render(<IssueAnalysisCard analysis={partialAnalysis} />);

    expect(screen.getByText(/Partial Source Inspection/i)).toBeDefined();
    expect(
      screen.getByText(/Repository tree truncated due to size; analyzed top available files\./i)
    ).toBeDefined();
  });

  it('renders prominent metadata-only warning banner when repository files could not be inspected', () => {
    const metadataOnlyAnalysis: IssueAnalysis = {
      ...baseAnalysis,
      repositoryContextAvailable: false,
      repositoryContextLimitation:
        'Repository source files were not retrieved at this triage stage; file suggestions and root causes are hypotheses based on issue description, stack traces, and metadata.',
      repositoryEvidence: {
        status: 'unavailable',
        inspectedFileCount: 0,
        limitation: 'GitHub API rate limit reached; repository tree inspection skipped.',
        treeTruncated: false,
        files: [],
      },
      filesOrComponentsToInvestigate: [
        {
          name: 'packages/react-reconciler/src/ReactFiberWorkLoop.js',
          reason: 'Candidate target inferred from stack trace.',
          isGroundedEvidence: false,
        },
      ],
    };

    render(<IssueAnalysisCard analysis={metadataOnlyAnalysis} />);

    expect(screen.getByText(/Analysis Based on Issue Metadata Only/i)).toBeDefined();
    expect(screen.getByText(/Repository Context Limitation/i)).toBeDefined();
    expect(
      screen.getByText(/Repository source files were not retrieved at this triage stage/i)
    ).toBeDefined();

    // All section 5 targets marked as hypothesis
    expect(screen.getByText(/Hypothesis \(Uninspected\)/i)).toBeDefined();
    expect(screen.queryByText(/Grounded Evidence/i)).toBeNull();
  });

  it('renders prominent Insufficient Repository Evidence card and External Repository Advisory box', () => {
    const insufficientEvidenceAnalysis: IssueAnalysis = {
      ...baseAnalysis,
      repositoryContextAvailable: false,
      repositoryContextLimitation:
        'Implementation likely resides in external repository (reactjs/react.dev). The current repository contains core library code.',
      repositoryEvidence: {
        status: 'insufficient_evidence',
        inspectedFileCount: 0,
        limitation:
          'Implementation likely resides in external repository (reactjs/react.dev). The current repository (facebook/react) contains core library code, not the reported website UI or documentation.',
        treeTruncated: false,
        externalRepositoryAdvisory:
          'The reported issue describes behavior on the react.dev documentation website. The documentation website is maintained in a dedicated external repository (reactjs/react.dev).',
        files: [],
      },
      filesOrComponentsToInvestigate: [
        {
          name: 'reactjs/react.dev',
          reason: 'External repository containing website code.',
          isGroundedEvidence: false,
        },
      ],
    };

    render(<IssueAnalysisCard analysis={insufficientEvidenceAnalysis} />);

    // Insufficient evidence card headers
    expect(screen.getByText('Insufficient Repository Evidence')).toBeDefined();
    expect(screen.getByText('Implementation Not in Repository')).toBeDefined();

    // Limitation text
    expect(
      screen.getByText(
        /Implementation likely resides in external repository \(reactjs\/react\.dev\)/i
      )
    ).toBeDefined();

    // External repository advisory box
    expect(screen.getByText('External Repository Advisory')).toBeDefined();
    expect(
      screen.getByText(
        /The reported issue describes behavior on the react\.dev documentation website/i
      )
    ).toBeDefined();

    // Should not render grounded evidence section
    expect(screen.queryByText(/Direct Source Grounded/i)).toBeNull();
  });

  it('renders indirect reference pattern badges when retrieved files serve as indirect references', () => {
    const indirectAnalysis: IssueAnalysis = {
      ...baseAnalysis,
      repositoryEvidence: {
        ...baseAnalysis.repositoryEvidence!,
        evidenceQuality: 'indirect_reference',
        files: [
          {
            ...baseAnalysis.repositoryEvidence!.files[0],
            evidenceRole: 'indirect_reference',
          },
        ],
      },
      filesOrComponentsToInvestigate: [
        {
          name: 'packages/react-reconciler/src/ReactFiberWorkLoop.js',
          reason: 'Pattern reference',
          isGroundedEvidence: false,
          evidenceRole: 'indirect_reference',
        },
      ],
    };

    render(<IssueAnalysisCard analysis={indirectAnalysis} />);

    expect(screen.getByText(/Indirect Reference Patterns/i)).toBeDefined();
    expect(screen.getByText(/Indirect Reference Pattern/i)).toBeDefined();
    expect(screen.queryByText(/Direct Source Grounded/i)).toBeNull();
  });
});
