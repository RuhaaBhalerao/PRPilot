import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { DatabaseService } from '../src/db/connection.js';
import {
  analysisStorageService,
  AnalysisStorageService,
} from '../src/services/analysisStorage.service.js';
import type { PersistedAnalysis, AnalyzeIssueResponse } from '@prpilot/shared';

const mockAnalysisResult: AnalyzeIssueResponse = {
  id: '11111111-2222-3333-4444-555555555555',
  issue: {
    number: 100,
    title: 'Race condition in cache invalidation',
    body: 'Reproduction steps...',
    state: 'open',
    htmlUrl: 'https://github.com/facebook/react/issues/100',
    authorLogin: 'testuser',
    labels: [{ name: 'bug' }],
    createdAt: '2024-03-01T10:00:00Z',
    updatedAt: '2024-03-01T12:00:00Z',
    closedAt: null,
    isPullRequest: false,
  },
  repository: {
    ownerLogin: 'facebook',
    name: 'react',
    fullName: 'facebook/react',
    description: 'React library',
    htmlUrl: 'https://github.com/facebook/react',
    defaultBranch: 'main',
    primaryLanguage: 'TypeScript',
    stars: 200000,
    openIssueCount: 500,
    isArchived: false,
  },
  analysis: {
    problemSummary: 'Cache key invalidation occurs before write resolves.',
    expectedBehaviour: 'Cache key should be invalidated after write confirms.',
    rootCauseHypotheses: ['Missing await on cache.del() call.'],
    evidenceAndMissingInformation: {
      verifiedFacts: ['Log line 84 shows stale read.'],
      hypotheses: ['Async timing error.'],
      missingInformation: ['Redis cluster configuration.'],
    },
    filesOrComponentsToInvestigate: [
      { name: 'src/cache/store.ts', reason: 'Contains cache invalidation logic.' },
    ],
    proposedFixSteps: ['Await cache invalidation before returning.'],
    regressionTestPlan: ['Run concurrency test with 50 parallel requests.'],
    repositoryContextAvailable: false,
    repositoryContextLimitation:
      'Repository source files were not retrieved at this triage stage; file suggestions and root causes are hypotheses based on the issue description, stack traces, and metadata.',
    isClosedIssue: false,
    closedIssueNotice: null,
  },
};

const mockPersistedRecord: PersistedAnalysis = {
  id: '11111111-2222-3333-4444-555555555555',
  issueUrl: 'https://github.com/facebook/react/issues/100',
  issueTitle: 'Race condition in cache invalidation',
  repository: 'facebook/react',
  analysisResult: mockAnalysisResult,
  status: 'completed',
  createdAt: '2024-03-01T10:00:00.000Z',
  updatedAt: '2024-03-01T10:00:00.000Z',
};

describe('Phase 4: Persistent Analysis History Endpoints & Storage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/v1/analyses (List History)', () => {
    it('returns 200 with paginated list of recent analyses ordered newest first', async () => {
      vi.spyOn(analysisStorageService, 'listAnalyses').mockResolvedValue({
        items: [
          {
            id: mockPersistedRecord.id,
            issueUrl: mockPersistedRecord.issueUrl,
            issueTitle: mockPersistedRecord.issueTitle,
            repository: mockPersistedRecord.repository,
            status: mockPersistedRecord.status,
            createdAt: mockPersistedRecord.createdAt,
            updatedAt: mockPersistedRecord.updatedAt,
          },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      });

      const res = await request(app).get('/api/v1/analyses');

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.total).toBe(1);
      expect(res.body.items[0].id).toBe(mockPersistedRecord.id);
      expect(res.body.items[0].issueTitle).toBe('Race condition in cache invalidation');
    });

    it('passes custom limit and offset query parameters to storage service', async () => {
      const listSpy = vi.spyOn(analysisStorageService, 'listAnalyses').mockResolvedValue({
        items: [],
        total: 0,
        limit: 10,
        offset: 5,
      });

      const res = await request(app).get('/api/v1/analyses?limit=10&offset=5');

      expect(res.status).toBe(200);
      expect(listSpy).toHaveBeenCalledWith({ limit: 10, offset: 5 });
    });

    it('returns 500 when database storage throws an unexpected error', async () => {
      vi.spyOn(analysisStorageService, 'listAnalyses').mockRejectedValue(
        new Error('Database query failure: connection refused')
      );

      const res = await request(app).get('/api/v1/analyses');

      expect(res.status).toBe(500);
      expect(res.body.message).toContain('Database query failure');
    });
  });

  describe('GET /api/v1/analyses/:id (Retrieve Single Analysis)', () => {
    it('returns 200 with full persisted analysis record when valid ID exists', async () => {
      vi.spyOn(analysisStorageService, 'getAnalysisById').mockResolvedValue(mockPersistedRecord);

      const res = await request(app).get('/api/v1/analyses/11111111-2222-3333-4444-555555555555');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(mockPersistedRecord.id);
      expect(res.body.issueTitle).toBe(mockPersistedRecord.issueTitle);
      expect(res.body.analysisResult).toBeDefined();
      expect(res.body.analysisResult.analysis.problemSummary).toBe(
        mockAnalysisResult.analysis.problemSummary
      );
    });

    it('returns 404 when analysis ID does not exist in the database', async () => {
      vi.spyOn(analysisStorageService, 'getAnalysisById').mockResolvedValue(null);

      const res = await request(app).get('/api/v1/analyses/99999999-9999-9999-9999-999999999999');

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('not found');
    });

    it('returns 404 when ID format is not a valid UUID', async () => {
      const res = await request(app).get('/api/v1/analyses/invalid-not-a-uuid');

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('not found');
    });

    it('returns 500 when database throws an error during lookup', async () => {
      vi.spyOn(analysisStorageService, 'getAnalysisById').mockRejectedValue(
        new Error('Database query timeout')
      );

      const res = await request(app).get('/api/v1/analyses/11111111-2222-3333-4444-555555555555');

      expect(res.status).toBe(500);
      expect(res.body.message).toContain('Database query timeout');
    });
  });

  describe('AnalysisStorageService Unit Tests (Mocked DB Client)', () => {
    it('saves an analysis and maps database row to PersistedAnalysis', async () => {
      const mockQueryClient = {
        query: vi
          .fn()
          // 1st call: duplicate check returns empty
          .mockResolvedValueOnce([])
          // 2nd call: insert query returns the inserted row
          .mockResolvedValueOnce([
            {
              id: 'a1111111-2222-3333-4444-555555555555',
              issue_url: 'https://github.com/facebook/react/issues/100',
              issue_title: 'Title',
              repository: 'facebook/react',
              analysis_result: mockAnalysisResult,
              status: 'completed',
              created_at: new Date('2024-03-01T10:00:00Z'),
              updated_at: new Date('2024-03-01T10:00:00Z'),
            },
          ]),
      };

      const testDb = new DatabaseService(mockQueryClient);
      const storage = new AnalysisStorageService(testDb);

      const saved = await storage.saveAnalysis({
        issueUrl: 'https://github.com/facebook/react/issues/100',
        issueTitle: 'Title',
        repository: 'facebook/react',
        analysisResult: mockAnalysisResult,
      });

      expect(saved.id).toBe('a1111111-2222-3333-4444-555555555555');
      expect(saved.status).toBe('completed');
      expect(mockQueryClient.query).toHaveBeenCalledTimes(2);
    });

    it('reuses existing record if duplicate submission occurs within 30 seconds', async () => {
      const mockQueryClient = {
        query: vi.fn().mockResolvedValueOnce([
          {
            id: 'existing-uuid-1234',
            issue_url: 'https://github.com/facebook/react/issues/100',
            issue_title: 'Title',
            repository: 'facebook/react',
            analysis_result: mockAnalysisResult,
            status: 'completed',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ]),
      };

      const testDb = new DatabaseService(mockQueryClient);
      const storage = new AnalysisStorageService(testDb);

      const saved = await storage.saveAnalysis({
        issueUrl: 'https://github.com/facebook/react/issues/100',
        issueTitle: 'Title',
        repository: 'facebook/react',
        analysisResult: mockAnalysisResult,
      });

      expect(saved.id).toBe('existing-uuid-1234');
      // Should not call insert query (only the duplicate check query)
      expect(mockQueryClient.query).toHaveBeenCalledTimes(1);
    });

    it('rejects malformed UUIDs in getAnalysisById before querying the database', async () => {
      const mockQueryClient = {
        query: vi.fn(),
      };

      const testDb = new DatabaseService(mockQueryClient);
      const storage = new AnalysisStorageService(testDb);

      const res = await storage.getAnalysisById('malformed-id-123');

      expect(res).toBeNull();
      expect(mockQueryClient.query).not.toHaveBeenCalled();
    });

    it('handles JSON string stored in analysis_result gracefully', async () => {
      const mockQueryClient = {
        query: vi.fn().mockResolvedValueOnce([
          {
            id: '11111111-2222-3333-4444-555555555555',
            issue_url: 'https://github.com/facebook/react/issues/100',
            issue_title: 'Title',
            repository: 'facebook/react',
            analysis_result: JSON.stringify(mockAnalysisResult),
            status: 'completed',
            created_at: new Date('2024-03-01T10:00:00Z'),
            updated_at: new Date('2024-03-01T10:00:00Z'),
          },
        ]),
      };

      const testDb = new DatabaseService(mockQueryClient);
      const storage = new AnalysisStorageService(testDb);

      const res = await storage.getAnalysisById('11111111-2222-3333-4444-555555555555');

      expect(res).not.toBeNull();
      expect(res?.analysisResult.issue.number).toBe(100);
    });
  });

  describe('DatabaseService Safety & Credentials', () => {
    it('throws clear error when database is not configured without exposing secrets', async () => {
      const unconfiguredDb = new DatabaseService(undefined, '');

      expect(unconfiguredDb.isConfigured).toBe(false);
      await expect(unconfiguredDb.query('SELECT 1')).rejects.toThrow(
        'Database connection is not configured'
      );
    });

    it('verifyConnection returns true on successful query and false on failure', async () => {
      const successfulDb = new DatabaseService({
        query: vi.fn().mockResolvedValue([{ connected: 1 }]),
      });
      const failingDb = new DatabaseService({
        query: vi.fn().mockRejectedValue(new Error('Connection lost')),
      });

      expect(await successfulDb.verifyConnection()).toBe(true);
      expect(await failingDb.verifyConnection()).toBe(false);
    });
  });
});
