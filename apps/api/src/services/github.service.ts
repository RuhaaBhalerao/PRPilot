import { Octokit } from '@octokit/rest';
import type { IssueLookupResponse, GithubIssue, GithubRepository } from '@prpilot/shared';
import { env } from '../config/env.js';
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
  token?: string;
  timeoutMs?: number;
}

export class GithubService {
  private octokit: Octokit;
  readonly isTokenConfigured: boolean;

  constructor(options: GithubServiceOptions = {}) {
    const rawToken = options.token !== undefined ? options.token : env.GITHUB_TOKEN;
    const cleanToken =
      typeof rawToken === 'string' && rawToken.trim().length > 0 ? rawToken.trim() : undefined;

    this.isTokenConfigured = Boolean(cleanToken);

    this.octokit =
      options.octokit ||
      new Octokit({
        auth: cleanToken,
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

      // Case-insensitive header lookup helper
      const getHeader = (headerName: string): string | undefined => {
        if (!err.response?.headers) return undefined;
        const lower = headerName.toLowerCase();
        for (const [key, val] of Object.entries(err.response.headers)) {
          if (key.toLowerCase() === lower && typeof val === 'string') {
            return val;
          }
        }
        return undefined;
      };

      const remainingLimit = getHeader('x-ratelimit-remaining');
      const resetTime = getHeader('x-ratelimit-reset');
      const retryAfter = getHeader('retry-after');

      const responseDataMessage =
        typeof err.response?.data === 'object' &&
        err.response.data !== null &&
        'message' in err.response.data &&
        typeof (err.response.data as { message: unknown }).message === 'string'
          ? (err.response.data as { message: string }).message
          : '';
      const combinedMessage = `${err.message || ''} ${responseDataMessage}`.toLowerCase();

      // Differentiate Secondary vs Primary Rate Limits
      // Secondary: status 429, or mentions "secondary rate", or has "retry-after" header
      const isSecondaryRateLimit =
        status === 429 ||
        combinedMessage.includes('secondary rate') ||
        (status === 403 && retryAfter !== undefined);

      // Primary: status 403 with remaining 0, or message explicitly says rate limit exceeded
      const isPrimaryRateLimit =
        status === 403 &&
        (remainingLimit === '0' ||
          combinedMessage.includes('api rate limit exceeded') ||
          combinedMessage.includes('rate limit'));

      if (isSecondaryRateLimit || isPrimaryRateLimit) {
        let resetDateString: string | undefined;
        let retryAfterSeconds: number | undefined;

        if (retryAfter) {
          const parsedSeconds = parseInt(retryAfter, 10);
          if (!isNaN(parsedSeconds) && parsedSeconds > 0) {
            retryAfterSeconds = parsedSeconds;
            resetDateString = new Date(Date.now() + parsedSeconds * 1000).toISOString();
          } else {
            const parsedTimestamp = Date.parse(retryAfter);
            if (!isNaN(parsedTimestamp) && parsedTimestamp > Date.now()) {
              retryAfterSeconds = Math.max(1, Math.ceil((parsedTimestamp - Date.now()) / 1000));
              resetDateString = new Date(parsedTimestamp).toISOString();
            }
          }
        }

        if (!resetDateString && resetTime) {
          const resetSeconds = parseInt(resetTime, 10);
          if (!isNaN(resetSeconds) && resetSeconds > 0) {
            resetDateString = new Date(resetSeconds * 1000).toISOString();
          }
        }

        if (isSecondaryRateLimit) {
          const resetFormatted = resetDateString
            ? ` Throttled until ${new Date(resetDateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.`
            : ' Please wait a few minutes before retrying.';

          throw new RateLimitExceededError(
            `GitHub API secondary rate limit triggered.${resetFormatted} Repeated requests before the cooldown period may prolong the block.`,
            {
              rateLimitType: 'secondary',
              resetAt: resetDateString,
              ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
            }
          );
        }

        // Primary rate limit
        const resetFormatted = resetDateString
          ? ` Limit will reset at ${new Date(resetDateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.`
          : '';

        const tokenAdvice = !this.isTokenConfigured
          ? ' To raise the hourly limit from 60 to 5,000 requests, configure an optional server-side GITHUB_TOKEN.'
          : '';

        throw new RateLimitExceededError(
          `GitHub API primary rate limit exceeded.${resetFormatted} Please wait until the reset time before retrying.${tokenAdvice}`,
          {
            rateLimitType: 'primary',
            resetAt: resetDateString,
          }
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
