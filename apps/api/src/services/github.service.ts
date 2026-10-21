import { Octokit } from '@octokit/rest';
import type { IssueLookupResponse, GithubIssue, GithubRepository } from '@prpilot/shared';
import {
  NotFoundError,
  UnprocessableEntityError,
  RateLimitExceededError,
  BadGatewayError,
  GatewayTimeoutError,
  HttpError,
} from '../errors/httpError.js';

export interface GithubServiceOptions {
  octokit?: Octokit;
  timeoutMs?: number;
}

export class GithubService {
  private octokit: Octokit;

  constructor(options: GithubServiceOptions = {}) {
    this.octokit =
      options.octokit ||
      new Octokit({
        auth: process.env.GITHUB_TOKEN || undefined,
        request: {
          timeout: options.timeoutMs ?? 10000,
        },
      });
  }

  /**
   * Fetches and normalizes public issue and repository metadata from GitHub.
   */
  async getIssueAndRepo(
    owner: string,
    repo: string,
    issueNumber: number
  ): Promise<IssueLookupResponse> {
    try {
      const [issueResponse, repoResponse] = await Promise.all([
        this.octokit.rest.issues.get({
          owner,
          repo,
          issue_number: issueNumber,
        }),
        this.octokit.rest.repos.get({
          owner,
          repo,
        }),
      ]);

      const rawIssue = issueResponse.data;
      const rawRepo = repoResponse.data;

      // GitHub represents pull requests through its issues API as well.
      // If the pull_request property exists, this resource is a PR, not an issue.
      if (rawIssue.pull_request) {
        throw new UnprocessableEntityError(
          'The provided URL corresponds to a pull request, not an issue. PRPilot only analyzes GitHub issues.',
          {
            isPullRequest: true,
            issueNumber,
            htmlUrl: rawIssue.html_url,
          }
        );
      }

      // Normalize issue response to our stable application model
      const issue: GithubIssue = {
        number: rawIssue.number,
        title: rawIssue.title,
        body: rawIssue.body ?? null,
        state: rawIssue.state as 'open' | 'closed',
        htmlUrl: rawIssue.html_url,
        authorLogin: rawIssue.user ? rawIssue.user.login : null,
        labels: (rawIssue.labels || []).map((lbl) => {
          if (typeof lbl === 'string') {
            return { name: lbl };
          }
          return {
            id: lbl.id,
            name: lbl.name || '',
            color: lbl.color || undefined,
            description: lbl.description ?? null,
          };
        }),
        createdAt: rawIssue.created_at,
        updatedAt: rawIssue.updated_at,
        closedAt: rawIssue.closed_at ?? null,
        isPullRequest: false,
      };

      // Normalize repository response
      const repository: GithubRepository = {
        ownerLogin: rawRepo.owner.login,
        name: rawRepo.name,
        fullName: rawRepo.full_name,
        description: rawRepo.description ?? null,
        htmlUrl: rawRepo.html_url,
        defaultBranch: rawRepo.default_branch,
        primaryLanguage: rawRepo.language ?? null,
        stars: rawRepo.stargazers_count,
        openIssueCount: rawRepo.open_issues_count,
        isArchived: rawRepo.archived,
      };

      return { issue, repository };
    } catch (error) {
      this.handleUpstreamError(error, owner, repo, issueNumber);
    }
  }

  private handleUpstreamError(
    error: unknown,
    owner: string,
    repo: string,
    issueNumber: number
  ): never {
    if (error instanceof HttpError) {
      throw error;
    }

    if (typeof error === 'object' && error !== null) {
      const err = error as {
        status?: number;
        name?: string;
        code?: string;
        message?: string;
        response?: {
          headers?: Record<string, string | undefined>;
          data?: unknown;
        };
      };

      const status = err.status;
      const headers = err.response?.headers || {};
      const remainingLimit = headers['x-ratelimit-remaining'];
      const resetTime = headers['x-ratelimit-reset'];

      // Rate limit detection
      const isRateLimit =
        status === 429 ||
        (status === 403 &&
          (remainingLimit === '0' ||
            (err.message && err.message.toLowerCase().includes('rate limit')) ||
            (err.message && err.message.toLowerCase().includes('secondary rate'))));

      if (isRateLimit) {
        let resetDateString: string | undefined;
        if (resetTime) {
          const resetSeconds = parseInt(resetTime, 10);
          if (!isNaN(resetSeconds)) {
            resetDateString = new Date(resetSeconds * 1000).toISOString();
          }
        }

        throw new RateLimitExceededError(
          'GitHub API rate limit exceeded. Please wait before retrying.',
          resetDateString ? { resetAt: resetDateString } : undefined
        );
      }

      // 404: repository or issue not found / private
      if (status === 404) {
        throw new NotFoundError(
          `GitHub issue or repository '${owner}/${repo}#${issueNumber}' not found. Verify that the repository is public and the issue exists.`
        );
      }

      // Timeout detection
      if (
        err.name === 'AbortError' ||
        err.name === 'TimeoutError' ||
        err.code === 'ETIMEDOUT' ||
        err.code === 'UND_ERR_CONNECT_TIMEOUT' ||
        (err.message && err.message.toLowerCase().includes('timed out'))
      ) {
        throw new GatewayTimeoutError('Upstream request to GitHub API timed out.');
      }

      // Network / DNS errors
      if (
        err.code === 'ENOTFOUND' ||
        err.code === 'ECONNREFUSED' ||
        err.code === 'EAI_AGAIN' ||
        (err.message && err.message.toLowerCase().includes('fetch failed'))
      ) {
        throw new BadGatewayError(
          'Failed to connect to upstream GitHub API. Check network connectivity.'
        );
      }

      // Upstream server errors (5xx)
      if (status && status >= 500) {
        throw new BadGatewayError('Upstream GitHub API encountered an internal error.');
      }

      if (status === 401) {
        throw new BadGatewayError('Upstream GitHub API authentication failed.');
      }
    }

    throw new BadGatewayError('An unexpected error occurred while communicating with GitHub.');
  }
}

export const githubService = new GithubService();
