import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { githubService } from '../src/services/github.service.js';

describe('POST /api/v1/github/issues/lookup', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Validation & Security checks', () => {
    it('returns 400 when request body is empty or missing issueUrl', async () => {
      const res = await request(app).post('/api/v1/github/issues/lookup').send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
      expect(res.body.details).toBeDefined();
    });

    it('returns 400 when issueUrl is an HTTP URL instead of HTTPS', async () => {
      const res = await request(app)
        .post('/api/v1/github/issues/lookup')
        .send({ issueUrl: 'http://github.com/facebook/react/issues/123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
      expect(res.body.details[0].message).toContain('HTTPS');
    });

    it('returns 400 for non-GitHub hosts and lookalike domains', async () => {
      const invalidUrls = [
        'https://gitlab.com/facebook/react/issues/123',
        'https://github.com.attacker.com/facebook/react/issues/123',
        'https://fakegithub.com/facebook/react/issues/123',
        'https://api.github.com/facebook/react/issues/123',
      ];

      for (const issueUrl of invalidUrls) {
        const res = await request(app).post('/api/v1/github/issues/lookup').send({ issueUrl });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation Error');
        expect(res.body.details[0].message).toContain('github.com');
      }
    });

    it('returns 400 for embedded credentials and custom ports', async () => {
      const invalidUrls = [
        'https://user:pass@github.com/facebook/react/issues/123',
        'https://github.com:8443/facebook/react/issues/123',
      ];

      for (const issueUrl of invalidUrls) {
        const res = await request(app).post('/api/v1/github/issues/lookup').send({ issueUrl });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation Error');
      }
    });

    it('returns 400 for query strings and invalid fragments', async () => {
      const invalidUrls = [
        'https://github.com/facebook/react/issues/123?tab=comments',
        'https://github.com/facebook/react/issues/123#<script>alert(1)</script>',
      ];

      for (const issueUrl of invalidUrls) {
        const res = await request(app).post('/api/v1/github/issues/lookup').send({ issueUrl });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation Error');
      }
    });

    it('returns 400 when a pull request URL is supplied directly', async () => {
      const res = await request(app)
        .post('/api/v1/github/issues/lookup')
        .send({ issueUrl: 'https://github.com/facebook/react/pull/123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
      expect(res.body.details[0].message).toContain('pull request');
    });

    it('returns 400 for unsupported paths (discussions, repository root, releases)', async () => {
      const unsupported = [
        'https://github.com/facebook/react/discussions/123',
        'https://github.com/facebook/react',
        'https://github.com/facebook/react/issues',
        'https://github.com/facebook/react/releases/tag/v1.0.0',
      ];

      for (const issueUrl of unsupported) {
        const res = await request(app).post('/api/v1/github/issues/lookup').send({ issueUrl });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation Error');
      }
    });

    it('returns 400 for invalid issue numbers (zeros, non-numeric, negative)', async () => {
      const invalidNumbers = [
        'https://github.com/facebook/react/issues/0',
        'https://github.com/facebook/react/issues/001',
        'https://github.com/facebook/react/issues/-10',
        'https://github.com/facebook/react/issues/foo',
      ];

      for (const issueUrl of invalidNumbers) {
        const res = await request(app).post('/api/v1/github/issues/lookup').send({ issueUrl });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation Error');
      }
    });

    it('returns 400 Bad Request for malformed JSON payloads', async () => {
      const res = await request(app)
        .post('/api/v1/github/issues/lookup')
        .set('Content-Type', 'application/json')
        .send('{"issueUrl": "broken-json');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bad Request');
      expect(res.body.message).toContain('Malformed JSON');
    });
  });

  describe('GitHub API integration (Mocked)', () => {
    it('successfully returns normalized issue and repository data for a valid issue', async () => {
      const mockIssue = {
        number: 28000,
        title: 'Fix state preservation during transitions',
        body: 'Detailed issue description with *markdown* formatting.',
        state: 'open',
        html_url: 'https://github.com/facebook/react/issues/28000',
        user: { login: 'acdlite' },
        labels: [
          {
            id: 101,
            name: 'React Core',
            color: '61dafb',
            description: 'Issues related to React core algorithms',
          },
        ],
        created_at: '2024-02-15T10:00:00Z',
        updated_at: '2024-02-16T12:00:00Z',
        closed_at: null,
      };

      const mockRepo = {
        owner: { login: 'facebook' },
        name: 'react',
        full_name: 'facebook/react',
        description: 'The library for web and native user interfaces.',
        html_url: 'https://github.com/facebook/react',
        default_branch: 'main',
        language: 'JavaScript',
        stargazers_count: 225000,
        open_issues_count: 1200,
        archived: false,
      };

      // Mock Octokit rest methods on the singleton instance
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const octokit = (githubService as any).octokit;
      vi.spyOn(octokit.rest.issues, 'get').mockResolvedValue({ data: mockIssue });
      vi.spyOn(octokit.rest.repos, 'get').mockResolvedValue({ data: mockRepo });

      const res = await request(app)
        .post('/api/v1/github/issues/lookup')
        .send({ issueUrl: 'https://github.com/facebook/react/issues/28000' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        issue: {
          number: 28000,
          title: 'Fix state preservation during transitions',
          body: 'Detailed issue description with *markdown* formatting.',
          state: 'open',
          htmlUrl: 'https://github.com/facebook/react/issues/28000',
          authorLogin: 'acdlite',
          labels: [
            {
              id: 101,
              name: 'React Core',
              color: '61dafb',
              description: 'Issues related to React core algorithms',
            },
          ],
          createdAt: '2024-02-15T10:00:00Z',
          updatedAt: '2024-02-16T12:00:00Z',
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
          stars: 225000,
          openIssueCount: 1200,
          isArchived: false,
        },
      });
    });

    it('returns 422 Unprocessable Entity when the GitHub issue is detected to be a pull request', async () => {
      const mockPrIssue = {
        number: 28005,
        title: 'Implement feature X',
        body: 'Pull request description',
        state: 'open',
        html_url: 'https://github.com/facebook/react/pull/28005',
        user: { login: 'contributor' },
        labels: [],
        created_at: '2024-02-15T10:00:00Z',
        updated_at: '2024-02-16T12:00:00Z',
        closed_at: null,
        // When an issue is actually a pull request, GitHub returns the pull_request property
        pull_request: {
          url: 'https://api.github.com/repos/facebook/react/pulls/28005',
          html_url: 'https://github.com/facebook/react/pull/28005',
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const octokit = (githubService as any).octokit;
      vi.spyOn(octokit.rest.issues, 'get').mockResolvedValue({ data: mockPrIssue });
      vi.spyOn(octokit.rest.repos, 'get').mockResolvedValue({
        data: {
          owner: { login: 'facebook' },
          name: 'react',
          full_name: 'facebook/react',
          description: 'React library',
          html_url: 'https://github.com/facebook/react',
          default_branch: 'main',
          language: 'JavaScript',
          stargazers_count: 220000,
          open_issues_count: 500,
          archived: false,
        },
      });

      const res = await request(app)
        .post('/api/v1/github/issues/lookup')
        .send({ issueUrl: 'https://github.com/facebook/react/issues/28005' });

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Unprocessable Entity');
      expect(res.body.message).toContain('pull request');
      expect(res.body.details).toEqual({
        isPullRequest: true,
        issueNumber: 28005,
        htmlUrl: 'https://github.com/facebook/react/pull/28005',
      });
    });

    it('returns 404 when repository or issue does not exist or is private', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const octokit = (githubService as any).octokit;
      vi.spyOn(octokit.rest.issues, 'get').mockRejectedValue({
        status: 404,
        message: 'Not Found',
      });
      vi.spyOn(octokit.rest.repos, 'get').mockResolvedValue({ data: {} });

      const res = await request(app)
        .post('/api/v1/github/issues/lookup')
        .send({ issueUrl: 'https://github.com/facebook/react/issues/9999999' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
      expect(res.body.message).toContain('not found');
    });

    it('returns 429 when GitHub rate limit is exceeded', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const octokit = (githubService as any).octokit;
      vi.spyOn(octokit.rest.issues, 'get').mockRejectedValue({
        status: 403,
        message: 'API rate limit exceeded for 127.0.0.1',
        response: {
          headers: {
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': '1735689600',
          },
        },
      });
      vi.spyOn(octokit.rest.repos, 'get').mockResolvedValue({ data: {} });

      const res = await request(app)
        .post('/api/v1/github/issues/lookup')
        .send({ issueUrl: 'https://github.com/facebook/react/issues/123' });

      expect(res.status).toBe(429);
      expect(res.body.error).toBe('Rate Limit Exceeded');
      expect(res.body.message).toContain('rate limit exceeded');
      expect(res.body.details).toBeDefined();
    });

    it('returns 504 Gateway Timeout when upstream GitHub request times out', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const octokit = (githubService as any).octokit;
      vi.spyOn(octokit.rest.issues, 'get').mockRejectedValue({
        name: 'AbortError',
        message: 'The operation was aborted due to timeout',
      });
      vi.spyOn(octokit.rest.repos, 'get').mockResolvedValue({ data: {} });

      const res = await request(app)
        .post('/api/v1/github/issues/lookup')
        .send({ issueUrl: 'https://github.com/facebook/react/issues/123' });

      expect(res.status).toBe(504);
      expect(res.body.error).toBe('Gateway Timeout');
      expect(res.body.message).toContain('timed out');
    });

    it('returns 502 Bad Gateway when network connection to GitHub fails', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const octokit = (githubService as any).octokit;
      vi.spyOn(octokit.rest.issues, 'get').mockRejectedValue({
        code: 'ENOTFOUND',
        message: 'getaddrinfo ENOTFOUND api.github.com',
      });
      vi.spyOn(octokit.rest.repos, 'get').mockResolvedValue({ data: {} });

      const res = await request(app)
        .post('/api/v1/github/issues/lookup')
        .send({ issueUrl: 'https://github.com/facebook/react/issues/123' });

      expect(res.status).toBe(502);
      expect(res.body.error).toBe('Bad Gateway');
      expect(res.body.message).toContain('network connectivity');
    });
  });
});
