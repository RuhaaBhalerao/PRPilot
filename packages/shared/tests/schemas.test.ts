import { describe, it, expect } from 'vitest';
import {
  healthResponseSchema,
  analyzeIssueRequestSchema,
  issueLookupRequestSchema,
  validateAndParseGithubIssueUrl,
  parseGithubIssueUrl,
  issueLookupResponseSchema,
  type IssueLookupResponse,
  issueAnalysisSectionSchema,
  analyzeIssueResponseSchema,
  type AnalyzeIssueResponse,
  retrievedSourceFileSchema,
  repositoryEvidenceSchema,
} from '../src/index.js';

describe('Shared Schemas', () => {
  describe('healthResponseSchema', () => {
    it('validates a correct health response payload', () => {
      const validPayload = {
        status: 'ok',
        service: 'prpilot-api',
        timestamp: new Date().toISOString(),
        version: '0.1.0',
        uptime: 12.34,
      };

      const result = healthResponseSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('ok');
        expect(result.data.service).toBe('prpilot-api');
      }
    });

    it('rejects an invalid health response payload missing required fields', () => {
      const invalidPayload = {
        status: 'error',
      };

      const result = healthResponseSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe('validateAndParseGithubIssueUrl & analyzeIssueRequestSchema', () => {
    it('accepts valid canonical public GitHub issue URLs', () => {
      const validUrls = [
        'https://github.com/facebook/react/issues/12345',
        'https://github.com/nodejs/node/issues/1',
        'https://github.com/owner-name/repo.name/issues/999',
        'https://github.com/owner-name/repo.name/issues/999#issuecomment-123',
      ];

      for (const issueUrl of validUrls) {
        const result = analyzeIssueRequestSchema.safeParse({ issueUrl });
        expect(result.success).toBe(true);

        const parsed = validateAndParseGithubIssueUrl(issueUrl);
        expect(parsed.success).toBe(true);
      }
    });

    it('rejects non-HTTPS URLs', () => {
      const res = validateAndParseGithubIssueUrl('http://github.com/facebook/react/issues/123');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('HTTPS');
      }
    });

    it('rejects non-github.com hosts and spoofed lookalike domains', () => {
      const spoofedUrls = [
        'https://gitlab.com/facebook/react/issues/123',
        'https://github.com.evil.com/facebook/react/issues/123',
        'https://fakegithub.com/facebook/react/issues/123',
        'https://api.github.com/repos/facebook/react/issues/123',
      ];

      for (const url of spoofedUrls) {
        const res = validateAndParseGithubIssueUrl(url);
        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.error).toContain('github.com');
        }
      }
    });

    it('rejects embedded credentials in URLs', () => {
      const res = validateAndParseGithubIssueUrl(
        'https://admin:secret@github.com/facebook/react/issues/123'
      );
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('credentials');
      }
    });

    it('rejects custom/unexpected ports', () => {
      const res = validateAndParseGithubIssueUrl(
        'https://github.com:8443/facebook/react/issues/123'
      );
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('port');
      }
    });

    it('rejects query strings in issue URLs', () => {
      const res = validateAndParseGithubIssueUrl(
        'https://github.com/facebook/react/issues/123?tab=comments'
      );
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('Query parameters');
      }
    });

    it('rejects unexpected fragments/hashes', () => {
      const res = validateAndParseGithubIssueUrl(
        'https://github.com/facebook/react/issues/123#<script>alert(1)</script>'
      );
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('fragment');
      }
    });

    it('rejects pull request URLs with clear messaging', () => {
      const prUrls = [
        'https://github.com/facebook/react/pull/123',
        'https://github.com/facebook/react/pulls/123',
      ];

      for (const url of prUrls) {
        const res = validateAndParseGithubIssueUrl(url);
        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.error).toContain('pull request');
        }
      }
    });

    it('rejects discussions and other non-issue paths', () => {
      const nonIssueUrls = [
        'https://github.com/facebook/react/discussions/123',
        'https://github.com/facebook/react',
        'https://github.com/facebook/react/issues',
        'https://github.com/facebook/react/releases/tag/v1.0.0',
      ];

      for (const url of nonIssueUrls) {
        const res = validateAndParseGithubIssueUrl(url);
        expect(res.success).toBe(false);
      }
    });

    it('rejects invalid or malformed issue numbers', () => {
      const malformed = [
        'https://github.com/facebook/react/issues/0',
        'https://github.com/facebook/react/issues/012',
        'https://github.com/facebook/react/issues/-5',
        'https://github.com/facebook/react/issues/abc',
      ];

      for (const url of malformed) {
        const res = validateAndParseGithubIssueUrl(url);
        expect(res.success).toBe(false);
      }
    });

    it('issueLookupRequestSchema is consistent with analyzeIssueRequestSchema', () => {
      const res = issueLookupRequestSchema.safeParse({
        issueUrl: 'https://github.com/facebook/react/issues/123',
      });
      expect(res.success).toBe(true);
    });
  });

  describe('parseGithubIssueUrl', () => {
    it('correctly parses owner, repo, and issue number', () => {
      const parsed = parseGithubIssueUrl('https://github.com/facebook/react/issues/28000');
      expect(parsed).toEqual({
        owner: 'facebook',
        repo: 'react',
        issueNumber: 28000,
      });
    });

    it('returns null for non-matching URLs', () => {
      const parsed = parseGithubIssueUrl('https://google.com');
      expect(parsed).toBeNull();
    });
  });

  describe('issueLookupResponseSchema', () => {
    it('validates a complete issue lookup response payload', () => {
      const mockResponse: IssueLookupResponse = {
        issue: {
          number: 28000,
          title: 'Bug in fiber reconciliation',
          body: 'Detailed reproduction steps...',
          state: 'open',
          htmlUrl: 'https://github.com/facebook/react/issues/28000',
          authorLogin: 'gaearon',
          labels: [
            { id: 1, name: 'Component: Core', color: 'b60205', description: 'Core package' },
          ],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
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

      const result = issueLookupResponseSchema.safeParse(mockResponse);
      expect(result.success).toBe(true);
    });

    it('handles nullable optional fields gracefully', () => {
      const mockMinimalResponse = {
        issue: {
          number: 1,
          title: 'Initial issue',
          body: null,
          state: 'closed',
          htmlUrl: 'https://github.com/owner/repo/issues/1',
          authorLogin: null,
          labels: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
          closedAt: '2024-01-03T00:00:00Z',
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
          stars: 0,
          openIssueCount: 0,
          isArchived: false,
        },
      };

      const result = issueLookupResponseSchema.safeParse(mockMinimalResponse);
      expect(result.success).toBe(true);
    });
  });

  describe('issueAnalysisSectionSchema & analyzeIssueResponseSchema', () => {
    const validAnalysis = {
      problemSummary: 'Race condition when toggling rapidly',
      expectedBehaviour: 'Toggle should debounce or queue state changes cleanly',
      rootCauseHypotheses: ['Hypothesis 1: State hook does not cancel in-flight async request'],
      evidenceAndMissingInformation: {
        verifiedFacts: ['Error log indicates uncaught rejection on line 42'],
        hypotheses: ['May affect all mobile browsers with slow connections'],
        missingInformation: ['Exact OS build number was omitted in the report'],
      },
      filesOrComponentsToInvestigate: [
        {
          name: 'src/components/Toggle.tsx',
          reason: 'Contains the state toggle handler',
        },
      ],
      proposedFixSteps: [
        'Add AbortController to in-flight requests',
        'Update cleanup in useEffect hook',
      ],
      regressionTestPlan: ['Simulate 10 fast clicks within 50ms and assert single resolution'],
      repositoryContextAvailable: false,
      repositoryContextLimitation:
        'Repository source files have not been cloned or inspected. File locations are hypotheses.',
      isClosedIssue: false,
    };

    it('validates a well-formed 7-section analysis schema', () => {
      const result = issueAnalysisSectionSchema.safeParse(validAnalysis);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.problemSummary).toBe('Race condition when toggling rapidly');
        expect(result.data.repositoryContextAvailable).toBe(false);
      }
    });

    it('rejects analysis missing required sections', () => {
      const invalid = {
        problemSummary: 'Something is broken',
      };
      const result = issueAnalysisSectionSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('validates a complete analyzeIssueResponseSchema', () => {
      const fullResponse: AnalyzeIssueResponse = {
        issue: {
          number: 28000,
          title: 'Bug report',
          body: 'Repro steps...',
          state: 'closed',
          htmlUrl: 'https://github.com/facebook/react/issues/28000',
          authorLogin: 'gaearon',
          labels: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
          closedAt: '2024-01-03T00:00:00Z',
          isPullRequest: false,
        },
        repository: {
          ownerLogin: 'facebook',
          name: 'react',
          fullName: 'facebook/react',
          description: 'A JS library',
          htmlUrl: 'https://github.com/facebook/react',
          defaultBranch: 'main',
          primaryLanguage: 'JavaScript',
          stars: 200000,
          openIssueCount: 500,
          isArchived: false,
        },
        analysis: {
          ...validAnalysis,
          isClosedIssue: true,
          closedIssueNotice: 'This issue is closed on GitHub. It may already be resolved.',
        },
      };

      const result = analyzeIssueResponseSchema.safeParse(fullResponse);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.analysis.isClosedIssue).toBe(true);
        expect(result.data.analysis.closedIssueNotice).toBeDefined();
      }
    });
  });

  describe('Phase 5 Schemas: retrievedSourceFileSchema & repositoryEvidenceSchema', () => {
    it('validates a valid retrievedSourceFileSchema object', () => {
      const validFile = {
        path: 'src/index.ts',
        sizeBytes: 1024,
        relevanceScore: 125,
        relevanceReason: 'Explicit path referenced in issue',
        htmlUrl: 'https://github.com/facebook/react/blob/main/src/index.ts',
        excerpt: '1: export const App = () => null;',
      };

      const result = retrievedSourceFileSchema.safeParse(validFile);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.path).toBe('src/index.ts');
        expect(result.data.relevanceScore).toBe(125);
      }
    });

    it('validates repositoryEvidenceSchema with completed and partial statuses', () => {
      const completedEvidence = {
        status: 'completed',
        inspectedFileCount: 2,
        limitation: null,
        treeTruncated: false,
        files: [
          {
            path: 'src/app.ts',
            sizeBytes: 500,
            relevanceScore: 80,
            relevanceReason: 'Keyword match',
            htmlUrl: 'https://github.com/facebook/react/blob/main/src/app.ts',
          },
        ],
      };

      const result = repositoryEvidenceSchema.safeParse(completedEvidence);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('completed');
        expect(result.data.inspectedFileCount).toBe(2);
      }
    });

    it('validates repositoryEvidenceSchema with insufficient_evidence status and externalRepositoryAdvisory', () => {
      const insufficientEvidence = {
        status: 'insufficient_evidence',
        inspectedFileCount: 0,
        limitation:
          'Repository source files were inspected, but no files met the minimum relevance threshold.',
        treeTruncated: false,
        externalRepositoryAdvisory:
          'Implementation likely resides in external repository (reactjs/react.dev).',
        files: [],
      };

      const result = repositoryEvidenceSchema.safeParse(insufficientEvidence);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('insufficient_evidence');
        expect(result.data.externalRepositoryAdvisory).toContain('reactjs/react.dev');
      }
    });

    it('validates repositoryEvidenceSchema with defaults when fields omitted', () => {
      const result = repositoryEvidenceSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('unavailable');
        expect(result.data.inspectedFileCount).toBe(0);
        expect(result.data.treeTruncated).toBe(false);
        expect(result.data.files).toEqual([]);
      }
    });
  });
});
