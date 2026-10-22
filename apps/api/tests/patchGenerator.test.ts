import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { PatchGeneratorService } from '../src/services/patchGenerator.service.js';
import {
  AnalysisStorageService,
  analysisStorageService,
} from '../src/services/analysisStorage.service.js';
import { GithubService } from '../src/services/github.service.js';
import { AiAnalysisService } from '../src/services/ai.service.js';
import type {
  AnalyzeIssueResponse,
  PersistedAnalysis,
  PatchGenerationResponse,
} from '@prpilot/shared';

describe('Phase 6: AI Patch Generation & Regression Test Service', () => {
  const analysisId = 'a1111111-2222-3333-4444-555555555555';

  const mockAnalysisResult: AnalyzeIssueResponse = {
    id: analysisId,
    issue: {
      number: 42,
      title: 'Fix off-by-one boundary check in slice helper',
      body: 'Calling slice with end index equal to array length throws an error.',
      state: 'open',
      htmlUrl: 'https://github.com/facebook/react/issues/42',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      closedAt: null,
      authorLogin: 'developer',
      authorAssociation: 'NONE',
      labels: [],
      commentsCount: 0,
      comments: [],
    },
    repository: {
      name: 'react',
      fullName: 'facebook/react',
      ownerLogin: 'facebook',
      description: 'React library',
      htmlUrl: 'https://github.com/facebook/react',
      defaultBranch: 'main',
      stars: 200000,
      openIssueCount: 10,
      primaryLanguage: 'JavaScript',
      isArchived: false,
    },
    analysis: {
      problemSummary: 'Boundary check failure when indexing slice end',
      expectedBehaviour: 'Handles end index gracefully',
      rootCauseHypotheses: ['Strict less than check instead of less-than-or-equal'],
      evidenceAndMissingInformation: {
        verifiedFacts: ['Error thrown on end == length'],
        hypotheses: ['Check boundary operator'],
        missingInformation: [],
      },
      filesOrComponentsToInvestigate: [
        {
          name: 'packages/shared/slice.js',
          reason: 'Direct slice implementation',
          isGroundedEvidence: true,
          evidenceRole: 'direct_evidence',
        },
      ],
      recommendedFixSteps: ['Change < to <='],
      regressionTestPlan: ['Test slice(0, length)'],
      repositoryContextAvailable: true,
      repositoryContextLimitation: null,
      repositoryEvidence: {
        status: 'completed',
        evidenceQuality: 'direct_grounded',
        inspectedFileCount: 1,
        limitation: null,
        treeTruncated: false,
        externalRepositoryAdvisory: null,
        files: [
          {
            path: 'packages/shared/slice.js',
            sizeBytes: 250,
            relevanceScore: 95,
            relevanceReason: 'Direct slice implementation',
            evidenceRole: 'direct_evidence',
            htmlUrl: 'https://github.com/facebook/react/blob/main/packages/shared/slice.js',
            excerpt:
              '1: export function slice(arr, start, end) { if (end > arr.length) throw new Error(); }',
          },
        ],
      },
      isClosedIssue: false,
      closedIssueNotice: null,
    },
  };

  const mockPersistedRecord: PersistedAnalysis = {
    id: analysisId,
    issueUrl: 'https://github.com/facebook/react/issues/42',
    issueTitle: 'Fix off-by-one boundary check in slice helper',
    repository: 'facebook/react',
    analysisResult: mockAnalysisResult,
    status: 'completed',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  const sampleFileContent = `export function slice(arr, start, end) {
  if (end > arr.length) {
    throw new Error('Index out of bounds');
  }
  return arr.slice(start, end);
}`;

  const validUnifiedDiff = `--- a/packages/shared/slice.js
+++ b/packages/shared/slice.js
@@ -1,6 +1,6 @@
 export function slice(arr, start, end) {
-  if (end > arr.length) {
+  if (end > arr.length && arr.length > 0) {
     throw new Error('Index out of bounds');
   }
   return arr.slice(start, end);
`;

  let mockStorage: Partial<AnalysisStorageService>;
  let mockGithub: Partial<GithubService>;
  let mockAi: Partial<AiAnalysisService>;
  let patchService: PatchGeneratorService;

  beforeEach(() => {
    mockStorage = {
      getAnalysisById: vi.fn().mockResolvedValue(mockPersistedRecord),
      savePatchResult: vi.fn().mockResolvedValue(undefined),
      getPatchByAnalysisId: vi.fn().mockResolvedValue(null),
      listAnalyses: vi.fn().mockResolvedValue({ items: [], total: 0, limit: 10, offset: 0 }),
    };

    mockGithub = {
      fetchFileContent: vi.fn().mockResolvedValue({
        content: sampleFileContent,
        size: sampleFileContent.length,
        htmlUrl: 'https://github.com/facebook/react/blob/main/packages/shared/slice.js',
      }),
    };

    mockAi = {
      generateJsonCompletion: vi.fn().mockResolvedValue({
        suspectedRootCause: 'Boundary comparison failed to account for empty arrays',
        unifiedDiff: validUnifiedDiff,
        fileExplanations: [
          {
            path: 'packages/shared/slice.js',
            relevanceReason: 'Direct slice implementation',
            changeSummary: 'Adjusted bounds check',
            addressedRegressionTest: 'handles empty arrays',
          },
        ],
        regressionTests: [
          {
            title: 'should handle empty arrays correctly',
            targetFile: 'packages/shared/slice.js',
            testFramework: 'vitest',
            testCode: "it('handles empty arrays', () => { expect(slice([], 0, 0)).toEqual([]); });",
            description: 'Verifies empty arrays do not throw index error',
          },
        ],
        assumptionsAndUncertainties: ['Assumes array length is nonnegative'],
      }),
    };

    patchService = new PatchGeneratorService({
      storageService: mockStorage as AnalysisStorageService,
      githubService: mockGithub as GithubService,
      aiService: mockAi as AiAnalysisService,
    });
  });

  describe('Service unit execution', () => {
    it('generates, validates, and marks regression tests as not_run for eligible issues', async () => {
      const response = await patchService.generatePatch({ analysisId });

      expect(response.status).toBe('generated');
      expect(response.eligibility.eligible).toBe(true);
      expect(response.validation?.isValid).toBe(true);
      expect(response.validation?.appliedCleanly).toBe(true);
      expect(response.regressionTests).toHaveLength(1);
      expect(response.regressionTests[0].executionStatus).toBe('not_run');
      expect(mockStorage.savePatchResult).toHaveBeenCalledWith(analysisId, expect.anything());
    });

    it('returns not_eligible without calling Gemini when issue is closed without override', async () => {
      const closedAnalysis: PersistedAnalysis = {
        ...mockPersistedRecord,
        analysisResult: {
          ...mockAnalysisResult,
          issue: {
            ...mockAnalysisResult.issue,
            state: 'closed',
            closedAt: '2024-01-02T00:00:00Z',
          },
        },
      };

      mockStorage.getAnalysisById = vi.fn().mockResolvedValue(closedAnalysis);

      const response = await patchService.generatePatch({ analysisId, forceAllowClosed: false });

      expect(response.status).toBe('not_eligible');
      expect(response.eligibility.eligible).toBe(false);
      expect(response.unifiedDiff).toBeNull();
      expect(mockAi.generateJsonCompletion).not.toHaveBeenCalled();
    });

    it('generates patch for closed issue when forceAllowClosed is true', async () => {
      const closedAnalysis: PersistedAnalysis = {
        ...mockPersistedRecord,
        analysisResult: {
          ...mockAnalysisResult,
          issue: {
            ...mockAnalysisResult.issue,
            state: 'closed',
            closedAt: '2024-01-02T00:00:00Z',
          },
        },
      };

      mockStorage.getAnalysisById = vi.fn().mockResolvedValue(closedAnalysis);

      const response = await patchService.generatePatch({ analysisId, forceAllowClosed: true });

      expect(response.status).toBe('generated');
      expect(response.eligibility.eligible).toBe(true);
      expect(mockAi.generateJsonCompletion).toHaveBeenCalled();
    });

    it('handles AI provider failure gracefully and returns failed status without crash', async () => {
      mockAi.generateJsonCompletion = vi.fn().mockRejectedValue(new Error('AI rate limit'));

      const response = await patchService.generatePatch({ analysisId });

      expect(response.status).toBe('failed');
      expect(response.unifiedDiff).toBeNull();
      expect(response.assumptionsAndUncertainties[0]).toContain('AI rate limit');
    });

    it('flags validation failure when diff does not apply cleanly to original snapshot', async () => {
      // Mock snapshot with completely different content
      mockGithub.fetchFileContent = vi.fn().mockResolvedValue({
        content: 'const completelyDifferentCode = true;',
        size: 35,
        htmlUrl: 'https://github.com/facebook/react/blob/main/packages/shared/slice.js',
      });

      const response = await patchService.generatePatch({ analysisId });

      expect(response.status).toBe('generated');
      expect(response.validation?.isValid).toBe(false);
      expect(response.validation?.status).toBe('validation_failed');
      expect(response.validation?.appliedCleanly).toBe(false);
      expect(response.validation?.validationErrors.length).toBeGreaterThan(0);
    });
  });

  describe('REST Endpoints integration', () => {
    it('POST /api/v1/patches/generate returns 400 when missing both analysisId and issueUrl', async () => {
      const res = await request(app).post('/api/v1/patches/generate').send({});
      expect(res.status).toBe(400);
    });

    it('POST /api/v1/analyses/:id/patch returns 404 for nonexistent UUID', async () => {
      vi.spyOn(analysisStorageService, 'getAnalysisById').mockResolvedValue(null);
      const nonexistentId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app).post(`/api/v1/analyses/${nonexistentId}/patch`).send({});
      expect(res.status).toBe(404);
    });

    it('GET /api/v1/analyses/:id/patch returns 404 when no patch exists', async () => {
      vi.spyOn(analysisStorageService, 'getPatchByAnalysisId').mockResolvedValue(null);
      const res = await request(app).get(`/api/v1/analyses/${analysisId}/patch`);
      expect(res.status).toBe(404);
    });

    it('GET /api/v1/analyses/:id/patch returns 200 when saved patch exists', async () => {
      const mockSavedPatch: PatchGenerationResponse = {
        analysisId,
        issueUrl: 'https://github.com/facebook/react/issues/42',
        repository: 'facebook/react',
        eligibility: { eligible: true, status: 'eligible', blockers: [], allowOverride: false },
        status: 'generated',
        suspectedRootCause: 'Off-by-one boundary',
        unifiedDiff: validUnifiedDiff,
        fileExplanations: [],
        regressionTests: [],
        assumptionsAndUncertainties: [],
        validation: null,
        generatedAt: '2024-01-01T00:00:00Z',
      };

      vi.spyOn(analysisStorageService, 'getPatchByAnalysisId').mockResolvedValue(mockSavedPatch);
      const res = await request(app).get(`/api/v1/analyses/${analysisId}/patch`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('generated');
      expect(res.body.suspectedRootCause).toBe('Off-by-one boundary');
    });
  });
});
