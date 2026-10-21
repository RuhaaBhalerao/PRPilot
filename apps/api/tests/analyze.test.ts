import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { githubService } from '../src/services/github.service.js';
import { aiAnalysisService, AiAnalysisService } from '../src/services/ai.service.js';
import { analysisStorageService } from '../src/services/analysisStorage.service.js';
import type { IssueAnalysis, GithubIssue, GithubRepository } from '@prpilot/shared';

const mockIssue: GithubIssue = {
  number: 27986,
  title: 'Bug: Found an error on React Documentation Site',
  body: 'The code snippet in useEffect documentation is missing a closing bracket on line 12.',
  state: 'open',
  htmlUrl: 'https://github.com/facebook/react/issues/27986',
  authorLogin: 'doccontributor',
  labels: [{ id: 1, name: 'Documentation', color: '0075ca' }],
  createdAt: '2024-02-15T10:00:00Z',
  updatedAt: '2024-02-16T12:00:00Z',
  closedAt: null,
  isPullRequest: false,
};

const mockRepo: GithubRepository = {
  ownerLogin: 'facebook',
  name: 'react',
  fullName: 'facebook/react',
  description: 'The library for web and native user interfaces.',
  htmlUrl: 'https://github.com/facebook/react',
  defaultBranch: 'main',
  primaryLanguage: 'JavaScript',
  stars: 225000,
  openIssueCount: 1200,
  isArchived: false,
};

const mockAnalysisPayload: IssueAnalysis = {
  problemSummary: 'A syntax error exists in the useEffect code example on the React docs.',
  expectedBehaviour:
    'Documentation code examples should be syntactically valid and runnable without errors.',
  rootCauseHypotheses: [
    'A documentation refactoring PR omitted the closing bracket during an edit.',
  ],
  evidenceAndMissingInformation: {
    verifiedFacts: ['Reported snippet in useEffect doc is missing a closing bracket.'],
    hypotheses: ['The markdown source file for useEffect documentation has a typo.'],
    missingInformation: ['Specific URL path or translation locale of the documentation page.'],
  },
  filesOrComponentsToInvestigate: [
    {
      name: 'packages/react-dom/docs/useEffect.md',
      reason: 'Likely location of the useEffect tutorial snippet in the docs hierarchy.',
    },
  ],
  proposedFixSteps: [
    'Locate the useEffect documentation markdown file.',
    'Add the missing closing bracket to the code example block.',
    'Run documentation linting and format checkers.',
  ],
  regressionTestPlan: ['Verify markdown code blocks pass documentation syntax validation in CI.'],
  repositoryContextAvailable: false,
  repositoryContextLimitation:
    'Repository source files were not retrieved at this triage stage; file suggestions and root causes are hypotheses based on the issue description, stack traces, and metadata.',
  isClosedIssue: false,
  closedIssueNotice: null,
};

describe('POST /api/v1/analyze (AI-Powered Issue Triage)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(analysisStorageService, 'saveAnalysis').mockImplementation(async (input) => ({
      id: 'a0000000-0000-0000-0000-000000000001',
      issueUrl: input.issueUrl,
      issueTitle: input.issueTitle,
      repository: input.repository,
      analysisResult: input.analysisResult,
      status: input.status ?? 'completed',
      createdAt: '2024-02-16T12:00:00.000Z',
      updatedAt: '2024-02-16T12:00:00.000Z',
    }));
  });

  describe('Input Validation', () => {
    it('returns 400 when issueUrl is missing from request body', async () => {
      const res = await request(app).post('/api/v1/analyze').send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
      expect(res.body.details).toBeDefined();
    });

    it('returns 400 when issueUrl points to a pull request', async () => {
      const res = await request(app)
        .post('/api/v1/analyze')
        .send({ issueUrl: 'https://github.com/facebook/react/pull/28000' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
      expect(res.body.details[0].message).toContain('pull request');
    });

    it('returns 400 when issueUrl points to non-GitHub host', async () => {
      const res = await request(app)
        .post('/api/v1/analyze')
        .send({ issueUrl: 'https://gitlab.com/owner/repo/issues/100' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
      expect(res.body.details[0].message).toContain('github.com');
    });
  });

  describe('End-to-End Analysis Workflow', () => {
    it('successfully retrieves issue and returns 7-section structured AI analysis', async () => {
      vi.spyOn(githubService, 'getIssueAndRepo').mockResolvedValue({
        issue: mockIssue,
        repository: mockRepo,
      });

      vi.spyOn(aiAnalysisService, 'analyzeIssue').mockResolvedValue(mockAnalysisPayload);

      const res = await request(app)
        .post('/api/v1/analyze')
        .send({ issueUrl: 'https://github.com/facebook/react/issues/27986' });

      expect(res.status).toBe(200);
      expect(res.body.issue).toEqual(mockIssue);
      expect(res.body.repository).toEqual(mockRepo);
      expect(res.body.analysis).toBeDefined();

      const analysis = res.body.analysis;
      expect(analysis.problemSummary).toBe(mockAnalysisPayload.problemSummary);
      expect(analysis.expectedBehaviour).toBe(mockAnalysisPayload.expectedBehaviour);
      expect(analysis.rootCauseHypotheses).toHaveLength(1);
      expect(analysis.evidenceAndMissingInformation.verifiedFacts).toHaveLength(1);
      expect(analysis.evidenceAndMissingInformation.hypotheses).toHaveLength(1);
      expect(analysis.evidenceAndMissingInformation.missingInformation).toHaveLength(1);
      expect(analysis.filesOrComponentsToInvestigate).toHaveLength(1);
      expect(analysis.proposedFixSteps).toHaveLength(3);
      expect(analysis.regressionTestPlan).toHaveLength(1);
      expect(analysis.repositoryContextAvailable).toBe(false);
      expect(analysis.repositoryContextLimitation).toContain(
        'Repository source files were not retrieved'
      );
      expect(analysis.isClosedIssue).toBe(false);
      expect(res.body.id).toBe('a0000000-0000-0000-0000-000000000001');
    });

    it('returns 502 Bad Gateway when database persistence fails deliberately', async () => {
      vi.spyOn(githubService, 'getIssueAndRepo').mockResolvedValue({
        issue: mockIssue,
        repository: mockRepo,
      });

      vi.spyOn(aiAnalysisService, 'analyzeIssue').mockResolvedValue(mockAnalysisPayload);

      vi.spyOn(analysisStorageService, 'saveAnalysis').mockRejectedValue(
        new Error('Connection terminated unexpectedly')
      );

      const res = await request(app)
        .post('/api/v1/analyze')
        .send({ issueUrl: 'https://github.com/facebook/react/issues/27986' });

      expect(res.status).toBe(502);
      expect(res.body.message).toContain('Failed to persist analysis to database');
    });

    it('handles closed issues normally while attaching closed issue advisory warning', async () => {
      const closedIssue: GithubIssue = {
        ...mockIssue,
        state: 'closed',
        closedAt: '2024-02-18T12:00:00Z',
      };

      vi.spyOn(githubService, 'getIssueAndRepo').mockResolvedValue({
        issue: closedIssue,
        repository: mockRepo,
      });

      const closedAnalysis: IssueAnalysis = {
        ...mockAnalysisPayload,
        isClosedIssue: true,
        closedIssueNotice:
          'Notice: This issue is closed on GitHub. Closed issues may have already been resolved or rejected, and are not active candidates for contribution.',
      };

      vi.spyOn(aiAnalysisService, 'analyzeIssue').mockResolvedValue(closedAnalysis);

      const res = await request(app)
        .post('/api/v1/analyze')
        .send({ issueUrl: 'https://github.com/facebook/react/issues/27986' });

      expect(res.status).toBe(200);
      expect(res.body.issue.state).toBe('closed');
      expect(res.body.analysis.isClosedIssue).toBe(true);
      expect(res.body.analysis.closedIssueNotice).toContain('closed on GitHub');
    });

    it('also responds identically on /api/v1/github/issues/analyze route', async () => {
      vi.spyOn(githubService, 'getIssueAndRepo').mockResolvedValue({
        issue: mockIssue,
        repository: mockRepo,
      });

      vi.spyOn(aiAnalysisService, 'analyzeIssue').mockResolvedValue(mockAnalysisPayload);

      const res = await request(app)
        .post('/api/v1/github/issues/analyze')
        .send({ issueUrl: 'https://github.com/facebook/react/issues/27986' });

      expect(res.status).toBe(200);
      expect(res.body.issue.number).toBe(27986);
      expect(res.body.analysis.problemSummary).toBe(mockAnalysisPayload.problemSummary);
    });
  });

  describe('Upstream GitHub Error Propagation', () => {
    it('returns 404 when target issue or repository is not found', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const octokit = (githubService as any).octokit;
      vi.spyOn(octokit.rest.issues, 'get').mockRejectedValue({
        status: 404,
        message: 'Not Found',
      });
      vi.spyOn(octokit.rest.repos, 'get').mockResolvedValue({ data: {} });

      const res = await request(app)
        .post('/api/v1/analyze')
        .send({ issueUrl: 'https://github.com/facebook/react/issues/99999999' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });

    it('returns 429 when GitHub API rate limit is exceeded during issue fetch', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const octokit = (githubService as any).octokit;
      vi.spyOn(octokit.rest.issues, 'get').mockRejectedValue({
        status: 403,
        message: 'API rate limit exceeded',
        response: {
          headers: {
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': '1735689600',
          },
        },
      });
      vi.spyOn(octokit.rest.repos, 'get').mockResolvedValue({ data: {} });

      const res = await request(app)
        .post('/api/v1/analyze')
        .send({ issueUrl: 'https://github.com/facebook/react/issues/123' });

      expect(res.status).toBe(429);
      expect(res.body.error).toBe('Rate Limit Exceeded');
    });
  });

  describe('AI Service Unit Tests & Error Resilience', () => {
    it('throws BadGatewayError when AI service is not configured with an API key', async () => {
      const unconfiguredService = new AiAnalysisService({ apiKey: undefined });

      await expect(unconfiguredService.analyzeIssue(mockIssue, mockRepo)).rejects.toThrow(
        'AI service is not configured'
      );
    });

    it('correctly parses valid JSON response from AI provider and sets honest metadata', async () => {
      const rawAiResponse = JSON.stringify({
        problemSummary: 'Synthetic problem summary',
        expectedBehaviour: 'Synthetic expected behavior',
        rootCauseHypotheses: ['Hypothesis A'],
        evidenceAndMissingInformation: {
          verifiedFacts: ['Fact 1'],
          hypotheses: ['Hypothesis 1'],
          missingInformation: ['Missing info 1'],
        },
        filesOrComponentsToInvestigate: [{ name: 'src/index.ts', reason: 'Entry point' }],
        proposedFixSteps: ['Step 1'],
        regressionTestPlan: ['Test 1'],
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: rawAiResponse } }],
        }),
      });

      const service = new AiAnalysisService({
        apiKey: 'sk-test-key-12345',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const result = await service.analyzeIssue(mockIssue, mockRepo);

      expect(result.problemSummary).toBe('Synthetic problem summary');
      expect(result.repositoryContextAvailable).toBe(false);
      expect(result.repositoryContextLimitation).toBeDefined();
      expect(result.isClosedIssue).toBe(false);
    });

    it('strips markdown code fences from AI provider JSON completion', async () => {
      const rawWithFences = `\`\`\`json
{
  "problemSummary": "Fenced problem summary",
  "expectedBehaviour": "Fenced expected behavior",
  "rootCauseHypotheses": ["Fenced hypothesis"],
  "evidenceAndMissingInformation": {
    "verifiedFacts": ["Fenced fact"],
    "hypotheses": ["Fenced hyp"],
    "missingInformation": ["Fenced missing"]
  },
  "filesOrComponentsToInvestigate": [{ "name": "fenced.ts", "reason": "Reason" }],
  "proposedFixSteps": ["Fix step"],
  "regressionTestPlan": ["Test step"]
}
\`\`\``;

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: rawWithFences } }],
        }),
      });

      const service = new AiAnalysisService({
        apiKey: 'sk-test-key',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const result = await service.analyzeIssue(mockIssue, mockRepo);
      expect(result.problemSummary).toBe('Fenced problem summary');
    });

    it('throws BadGatewayError when AI provider returns malformed or invalid JSON', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'not-valid-json' } }],
        }),
      });

      const service = new AiAnalysisService({
        apiKey: 'sk-test-key',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      await expect(service.analyzeIssue(mockIssue, mockRepo)).rejects.toThrow(
        'AI provider completion could not be parsed as valid JSON'
      );
    });

    it('throws BadGatewayError when AI provider fails with 401 authentication error', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'Incorrect API key provided' } }),
      });

      const service = new AiAnalysisService({
        apiKey: 'sk-bad-key',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      await expect(service.analyzeIssue(mockIssue, mockRepo)).rejects.toThrow(
        'AI provider authentication failed'
      );
    });

    it('throws RateLimitExceededError when AI provider rate limits the request (429)', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: 'Rate limit exceeded' } }),
      });

      const service = new AiAnalysisService({
        apiKey: 'sk-test-key',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      await expect(service.analyzeIssue(mockIssue, mockRepo)).rejects.toThrow(
        'AI provider rate limit reached'
      );
    });

    it('throws GatewayTimeoutError when AI provider request times out', async () => {
      const mockFetch = vi.fn().mockRejectedValue({
        name: 'AbortError',
        message: 'The operation was aborted',
      });

      const service = new AiAnalysisService({
        apiKey: 'sk-test-key',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      await expect(service.analyzeIssue(mockIssue, mockRepo)).rejects.toThrow(
        'Upstream AI provider request timed out'
      );
    });

    it('never leaks API key secrets in error messages or responses', async () => {
      const secretKey = 'sk-or-v1-super-secret-key-999';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: `Internal error for key ${secretKey}` }),
      });

      const service = new AiAnalysisService({
        apiKey: secretKey,
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      try {
        await service.analyzeIssue(mockIssue, mockRepo);
        expect.unreachable('Should have thrown error');
      } catch (err: unknown) {
        const errorString = JSON.stringify(err);
        expect(errorString).not.toContain(secretKey);
      }
    });
  });
});
