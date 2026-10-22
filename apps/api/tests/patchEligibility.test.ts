import { describe, it, expect } from 'vitest';
import { evaluatePatchEligibility } from '../src/services/patchEligibility.js';
import type {
  GithubIssue,
  GithubRepository,
  IssueAnalysis,
  RepositoryEvidence,
} from '@prpilot/shared';

describe('Phase 6: Patch Generation Eligibility Checker', () => {
  const baseRepo: GithubRepository = {
    name: 'react',
    fullName: 'facebook/react',
    description: 'The library for web and native user interfaces',
    htmlUrl: 'https://github.com/facebook/react',
    defaultBranch: 'main',
    stars: 220000,
    openIssueCount: 800,
    primaryLanguage: 'JavaScript',
    isArchived: false,
    ownerLogin: 'facebook',
  };

  const baseIssue: GithubIssue = {
    number: 12345,
    title: 'Bug in useId hook during hydration',
    body: 'During SSR hydration, useId throws an invariant error when nested inside Suspense.',
    state: 'open',
    htmlUrl: 'https://github.com/facebook/react/issues/12345',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    closedAt: null,
    authorLogin: 'testuser',
    authorAssociation: 'NONE',
    labels: [{ name: 'Component: Hooks', color: 'blue' }],
    commentsCount: 2,
    comments: [
      {
        id: 1,
        authorLogin: 'contributor',
        body: 'I reproduced this on latest canary.',
        createdAt: '2024-01-01T01:00:00Z',
      },
    ],
  };

  const directEvidence: RepositoryEvidence = {
    status: 'completed',
    evidenceQuality: 'direct_grounded',
    inspectedFileCount: 2,
    limitation: null,
    treeTruncated: false,
    externalRepositoryAdvisory: null,
    files: [
      {
        path: 'packages/react/src/ReactHooks.js',
        sizeBytes: 1500,
        relevanceScore: 92,
        relevanceReason: 'Direct implementation of useId hook',
        evidenceRole: 'direct_evidence',
        htmlUrl: 'https://github.com/facebook/react/blob/main/packages/react/src/ReactHooks.js',
        excerpt: '1: export function useId() { return resolveDispatcher().useId(); }',
      },
    ],
  };

  const baseAnalysis: IssueAnalysis = {
    problemSummary: 'Hydration invariant error in useId hook.',
    expectedBehaviour: 'useId generates matching deterministic identifier.',
    rootCauseHypotheses: ['Dispatcher mismatch during concurrent hydration'],
    evidenceAndMissingInformation: {
      verifiedFacts: ['Occurs inside Suspense'],
      hypotheses: ['Dispatcher mismatch'],
      missingInformation: [],
    },
    filesOrComponentsToInvestigate: [
      {
        name: 'packages/react/src/ReactHooks.js',
        reason: 'Direct implementation',
        isGroundedEvidence: true,
        evidenceRole: 'direct_evidence',
      },
    ],
    recommendedFixSteps: ['Align dispatcher in ReactFiberHooks'],
    regressionTestPlan: ['Assert matching ID in Suspense hydration'],
    repositoryContextAvailable: true,
    repositoryContextLimitation: null,
    repositoryEvidence: directEvidence,
    isClosedIssue: false,
    closedIssueNotice: null,
  };

  it('approves eligible issue with verified direct source evidence', () => {
    const result = evaluatePatchEligibility(baseIssue, baseRepo, baseAnalysis);
    expect(result.eligible).toBe(true);
    expect(result.status).toBe('eligible');
    expect(result.blockers).toHaveLength(0);
    expect(result.details?.hasDirectEvidence).toBe(true);
    expect(result.details?.isClosed).toBe(false);
  });

  it('blocks closed issues by default with clear blocker message', () => {
    const closedIssue: GithubIssue = {
      ...baseIssue,
      state: 'closed',
      closedAt: '2024-01-02T00:00:00Z',
    };

    const result = evaluatePatchEligibility(closedIssue, baseRepo, baseAnalysis);
    expect(result.eligible).toBe(false);
    expect(result.status).toBe('not_eligible');
    expect(result.allowOverride).toBe(true);
    expect(result.blockers[0]).toContain('Issue is closed on GitHub');
  });

  it('allows closed issue patch generation when explicit review override is provided', () => {
    const closedIssue: GithubIssue = {
      ...baseIssue,
      state: 'closed',
      closedAt: '2024-01-02T00:00:00Z',
    };

    const result = evaluatePatchEligibility(closedIssue, baseRepo, baseAnalysis, {
      forceAllowClosed: true,
    });
    expect(result.eligible).toBe(true);
    expect(result.status).toBe('eligible');
    expect(result.blockers).toHaveLength(0);
  });

  it('strictly blocks intentional behavior / exercise issues based on maintainer discussion', () => {
    const intentionalIssue: GithubIssue = {
      ...baseIssue,
      state: 'closed',
      comments: [
        {
          id: 99,
          authorLogin: 'rickhanlonii',
          body: 'This is intentional. The challenge is meant to test understanding of state mutations.',
          createdAt: '2024-01-02T00:00:00Z',
        },
      ],
    };

    const result = evaluatePatchEligibility(intentionalIssue, baseRepo, baseAnalysis);
    expect(result.eligible).toBe(false);
    expect(result.details?.isIntentionalOrResolved).toBe(true);
    expect(result.blockers[0]).toContain('intentional by design');
  });

  it('blocks issues with cross-repository mismatch (external advisory present)', () => {
    const crossRepoEvidence: RepositoryEvidence = {
      ...directEvidence,
      externalRepositoryAdvisory: 'reactjs/react.dev',
    };

    const crossRepoAnalysis: IssueAnalysis = {
      ...baseAnalysis,
      repositoryEvidence: crossRepoEvidence,
    };

    const result = evaluatePatchEligibility(baseIssue, baseRepo, crossRepoAnalysis);
    expect(result.eligible).toBe(false);
    expect(result.details?.hasExternalRepoMismatch).toBe(true);
    expect(result.blockers.some((b) => b.includes('Cross-repository mismatch'))).toBe(true);
  });

  it('blocks patch generation when Phase 5 repository evidence is insufficient', () => {
    const insufficientEvidence: RepositoryEvidence = {
      status: 'insufficient_evidence',
      evidenceQuality: 'insufficient',
      inspectedFileCount: 0,
      limitation: 'No relevant implementation files found in repository.',
      treeTruncated: false,
      externalRepositoryAdvisory: null,
      files: [],
    };

    const insufficientAnalysis: IssueAnalysis = {
      ...baseAnalysis,
      repositoryEvidence: insufficientEvidence,
    };

    const result = evaluatePatchEligibility(baseIssue, baseRepo, insufficientAnalysis);
    expect(result.eligible).toBe(false);
    expect(result.blockers.some((b) => b.includes('Insufficient relevant source evidence'))).toBe(
      true
    );
  });

  it('blocks patch generation when all retrieved files are indirect reference files', () => {
    const indirectEvidence: RepositoryEvidence = {
      status: 'completed',
      evidenceQuality: 'indirect_reference',
      inspectedFileCount: 1,
      limitation: 'Retrieved files are shared configurations',
      treeTruncated: false,
      externalRepositoryAdvisory: null,
      files: [
        {
          path: 'packages/shared/ReactSymbols.js',
          sizeBytes: 800,
          relevanceScore: 40,
          relevanceReason: 'Indirect shared constant',
          evidenceRole: 'indirect_reference',
          htmlUrl: 'https://github.com/facebook/react/blob/main/packages/shared/ReactSymbols.js',
          excerpt: '1: export const REACT_ELEMENT_TYPE = Symbol.for("react.element");',
        },
      ],
    };

    const indirectAnalysis: IssueAnalysis = {
      ...baseAnalysis,
      repositoryEvidence: indirectEvidence,
      filesOrComponentsToInvestigate: [
        {
          name: 'packages/shared/ReactSymbols.js',
          reason: 'Indirect',
          isGroundedEvidence: false,
          evidenceRole: 'indirect_reference',
        },
      ],
    };

    const result = evaluatePatchEligibility(baseIssue, baseRepo, indirectAnalysis);
    expect(result.eligible).toBe(false);
    expect(result.blockers.some((b) => b.includes('No direct grounded evidence files'))).toBe(true);
  });
});
