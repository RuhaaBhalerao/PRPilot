import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { PatchVerificationService } from '../src/services/patchVerification.service.js';
import {
  AnalysisStorageService,
  analysisStorageService,
} from '../src/services/analysisStorage.service.js';
import { GithubService } from '../src/services/github.service.js';
import type { PersistedAnalysis, PatchGenerationResponse } from '@prpilot/shared';

describe('Phase 7: Patch Verification Service & Endpoint', () => {
  const analysisId = 'b1111111-2222-3333-4444-555555555555';

  const validDiff = `--- a/src/index.js
+++ b/src/index.js
@@ -1,3 +1,4 @@
 function main() {
+  console.log('init');
   return 0;
 }
`;

  const invalidDiff = `--- a/src/index.js
+++ b/src/index.js
@@ -1,2 +1,3 @@
 function completelyDifferentFunction() {
+  return 1;
 }
`;

  const sampleSnapshot = `function main() {
  return 0;
}`;

  const mockPatchResult: PatchGenerationResponse = {
    analysisId,
    issueUrl: 'https://github.com/facebook/react/issues/999',
    repository: 'facebook/react',
    eligibility: { eligible: true, status: 'eligible', blockers: [], allowOverride: false },
    status: 'generated',
    suspectedRootCause: 'Missing log statement',
    unifiedDiff: validDiff,
    fileExplanations: [],
    regressionTests: [],
    assumptionsAndUncertainties: [],
    validation: {
      isValid: true,
      status: 'validated',
      appliedCleanly: true,
      validationErrors: [],
      validationWarnings: [],
      parsedFiles: [],
      totalAdditions: 1,
      totalDeletions: 0,
    },
    generatedAt: '2024-01-01T00:00:00Z',
  };

  const mockPersistedAnalysis: PersistedAnalysis = {
    id: analysisId,
    issueUrl: 'https://github.com/facebook/react/issues/999',
    issueTitle: 'Test issue',
    repository: 'facebook/react',
    analysisResult: {
      id: analysisId,
      issue: {
        number: 999,
        title: 'Test issue',
        body: 'Details',
        state: 'open',
        htmlUrl: 'https://github.com/facebook/react/issues/999',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        closedAt: null,
        authorLogin: 'testuser',
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
        problemSummary: 'Issue summary',
        expectedBehaviour: 'Expected behavior',
        rootCauseHypotheses: ['Hypothesis'],
        evidenceAndMissingInformation: {
          verifiedFacts: [],
          hypotheses: [],
          missingInformation: [],
        },
        filesOrComponentsToInvestigate: [],
        recommendedFixSteps: [],
        regressionTestPlan: [],
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
              path: 'src/index.js',
              sizeBytes: 100,
              relevanceScore: 90,
              relevanceReason: 'Direct file',
              evidenceRole: 'direct_evidence',
              htmlUrl: 'https://github.com/facebook/react/blob/main/src/index.js',
              excerpt: '1: function main() { return 0; }',
            },
          ],
        },
        isClosedIssue: false,
        closedIssueNotice: null,
      },
    },
    patchResult: mockPatchResult,
    status: 'completed',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  let mockStorage: Partial<AnalysisStorageService>;
  let mockGithub: Partial<GithubService>;
  let verificationService: PatchVerificationService;

  beforeEach(() => {
    mockStorage = {
      getAnalysisById: vi.fn().mockResolvedValue(mockPersistedAnalysis),
      savePatchResult: vi.fn().mockResolvedValue(undefined),
    };

    mockGithub = {
      fetchFileContent: vi.fn().mockResolvedValue({
        content: sampleSnapshot,
        size: sampleSnapshot.length,
        htmlUrl: 'https://github.com/facebook/react/blob/main/src/index.js',
      }),
    };

    verificationService = new PatchVerificationService({
      storageService: mockStorage as AnalysisStorageService,
      githubService: mockGithub as GithubService,
    });
  });

  describe('Verification unit tests', () => {
    it('verifies a valid patch structurally and returns testExecutionStatus: not_run by default', async () => {
      const result = await verificationService.verifyPatch({
        analysisId,
        runSandboxTests: false,
      });

      expect(result.structuralValidation.isValid).toBe(true);
      expect(result.structuralValidation.appliedCleanly).toBe(true);
      expect(result.testExecutionStatus).toBe('not_run');
      expect(result.sandboxDetails.available).toBe(false);
      expect(result.sandboxDetails.status).toBe('not_run');
    });

    it('returns sandbox_unavailable safely when sandbox execution is requested without host execution', async () => {
      const result = await verificationService.verifyPatch({
        analysisId,
        runSandboxTests: true,
      });

      expect(result.structuralValidation.isValid).toBe(true);
      expect(result.testExecutionStatus).toBe('sandbox_unavailable');
      expect(result.sandboxDetails.available).toBe(false);
      expect(result.sandboxDetails.status).toBe('sandbox_unavailable');
      expect(result.sandboxDetails.reason).toContain(
        'Host execution of untrusted AI-generated code is strictly prohibited'
      );
    });

    it('rejects an invalid diff with structural validation errors', async () => {
      const result = await verificationService.verifyPatch({
        analysisId,
        unifiedDiff: invalidDiff,
        runSandboxTests: false,
      });

      expect(result.structuralValidation.isValid).toBe(false);
      expect(result.structuralValidation.appliedCleanly).toBe(false);
      expect(result.structuralValidation.validationErrors.length).toBeGreaterThan(0);
    });

    it('throws BadRequestError when no diff can be located', async () => {
      mockStorage.getAnalysisById = vi.fn().mockResolvedValue({
        ...mockPersistedAnalysis,
        patchResult: null,
      });

      await expect(verificationService.verifyPatch({ analysisId })).rejects.toThrow(
        'Unified diff content is required'
      );
    });
  });

  describe('REST Verification Endpoint integration', () => {
    it('POST /api/v1/patches/verify returns 400 when body lacks required fields', async () => {
      const res = await request(app).post('/api/v1/patches/verify').send({});
      expect(res.status).toBe(400);
    });

    it('POST /api/v1/analyses/:id/patch/verify returns 404 for nonexistent UUID', async () => {
      vi.spyOn(analysisStorageService, 'getAnalysisById').mockResolvedValue(null);
      const nonexistentId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .post(`/api/v1/analyses/${nonexistentId}/patch/verify`)
        .send({});
      expect(res.status).toBe(404);
    });
  });
});
