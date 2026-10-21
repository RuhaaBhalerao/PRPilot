import { Octokit } from '@octokit/rest';
import type {
  IssueLookupResponse,
  GithubIssue,
  GithubRepository,
  RetrievedSourceFile,
  RepositoryEvidence,
} from '@prpilot/shared';
import {
  rankRepositoryFiles,
  isGeneratedFileContent,
  detectExternalRepositoryTarget,
  type TreeFileItem,
} from './fileRanker.js';
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
    issueNumber: number,
    options?: { includeComments?: boolean }
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

      // Retrieve issue comments to extract maintainer discussion and closing rationale when requested
      let comments:
        | Array<{ id: number; authorLogin: string | null; body: string; createdAt: string }>
        | undefined;
      if (options?.includeComments) {
        try {
          const commentsRes = await this.octokit.rest.issues.listComments({
            owner,
            repo,
            issue_number: issueNumber,
            per_page: 15,
          });
          comments = (commentsRes.data || []).map((c) => ({
            id: c.id,
            authorLogin: c.user ? c.user.login : null,
            body: c.body || '',
            createdAt: c.created_at,
          }));
        } catch {
          comments = [];
        }
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
        ...(comments !== undefined ? { comments } : {}),
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

  /**
   * Retrieves the repository Git tree recursively using the Git Trees API.
   * Handles truncated trees and empty repositories gracefully.
   */
  async getRepoTree(
    owner: string,
    repo: string,
    treeSha: string
  ): Promise<{ tree: TreeFileItem[]; truncated: boolean }> {
    try {
      const response = await this.octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: treeSha,
        recursive: '1',
      });

      const rawTree = response.data.tree || [];
      const tree: TreeFileItem[] = [];

      for (const item of rawTree) {
        if (item.path && item.type === 'blob') {
          tree.push({
            path: item.path,
            size: item.size,
            type: item.type,
          });
        }
      }

      return {
        tree,
        truncated: Boolean(response.data.truncated),
      };
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'status' in error) {
        const status = (error as { status?: number }).status;
        // 409 = Git Repository is empty, 404 = branch or tree not found
        if (status === 409 || status === 404) {
          return { tree: [], truncated: false };
        }
      }
      throw error;
    }
  }

  /**
   * Fetches raw content of a specific repository file via the Contents API.
   * Validates size, decodes base64, and filters binary content.
   */
  async fetchFileContent(
    owner: string,
    repo: string,
    path: string,
    ref: string
  ): Promise<{ content: string; size: number; htmlUrl: string } | null> {
    try {
      const response = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref,
      });

      if (Array.isArray(response.data) || response.data.type !== 'file') {
        return null;
      }

      const fileData = response.data;
      if (!fileData.content) {
        return null;
      }

      const rawContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
      // Detect binary content with null bytes and discard
      if (rawContent.includes('\0')) {
        return null;
      }

      // Detect and discard generated file content
      if (isGeneratedFileContent(rawContent)) {
        return null;
      }

      return {
        content: rawContent,
        size: fileData.size,
        htmlUrl: fileData.html_url || `https://github.com/${owner}/${repo}/blob/${ref}/${path}`,
      };
    } catch {
      return null;
    }
  }

  /**
   * Orchestrates repository intelligence: inspects the git tree, ranks candidate files,
   * retrieves source file contents with bounded limits, and produces grounded evidence.
   * Degrades gracefully if the repository is large, truncated, or rate-limited.
   */
  async gatherRepositoryEvidence(
    owner: string,
    repo: string,
    issue: GithubIssue,
    repository: GithubRepository,
    options?: {
      maxFiles?: number;
      maxFileSizeBytes?: number;
      maxExcerptLines?: number;
    }
  ): Promise<RepositoryEvidence> {
    try {
      // Check for external repository ownership (e.g., website/docs vs core library)
      const externalAdvisory = detectExternalRepositoryTarget(issue, repository);
      if (externalAdvisory) {
        return {
          status: 'insufficient_evidence',
          evidenceQuality: 'insufficient',
          inspectedFileCount: 0,
          limitation: `Implementation likely resides in external repository (${externalAdvisory.targetRepository}). The current repository (${repository.fullName}) contains core library code, not the reported website UI or documentation.`,
          externalRepositoryAdvisory: externalAdvisory.advisoryMessage,
          treeTruncated: false,
          files: [],
        };
      }

      let treeResult: { tree: TreeFileItem[]; truncated: boolean };
      try {
        treeResult = await this.getRepoTree(owner, repo, repository.defaultBranch);
      } catch (treeError) {
        const isRateLimit =
          typeof treeError === 'object' &&
          treeError !== null &&
          'status' in treeError &&
          ((treeError as { status?: number }).status === 403 ||
            (treeError as { status?: number }).status === 429);

        return {
          status: 'unavailable',
          evidenceQuality: 'unavailable',
          inspectedFileCount: 0,
          limitation: isRateLimit
            ? 'GitHub API rate limit reached; repository tree inspection skipped.'
            : 'Failed to inspect repository tree from GitHub.',
          treeTruncated: false,
          externalRepositoryAdvisory: null,
          files: [],
        };
      }

      if (treeResult.tree.length === 0) {
        return {
          status: 'unavailable',
          evidenceQuality: 'unavailable',
          inspectedFileCount: 0,
          limitation: 'Repository is empty or no files were discovered in the default branch.',
          treeTruncated: treeResult.truncated,
          externalRepositoryAdvisory: null,
          files: [],
        };
      }

      const ranked = rankRepositoryFiles(treeResult.tree, issue, repository, {
        maxResults: options?.maxFiles ?? 3,
        maxFileSizeBytes: options?.maxFileSizeBytes ?? 60 * 1024,
      });

      if (ranked.length === 0) {
        return {
          status: 'insufficient_evidence',
          evidenceQuality: 'insufficient',
          inspectedFileCount: 0,
          limitation: treeResult.truncated
            ? 'Repository tree was truncated due to repository size, and no candidate source files met the relevance threshold.'
            : 'Insufficient relevant source evidence: repository source files were inspected, but no candidate files met the minimum relevance threshold for the reported issue.',
          treeTruncated: treeResult.truncated,
          externalRepositoryAdvisory: null,
          files: [],
        };
      }

      const maxExcerptLines = options?.maxExcerptLines ?? 120;

      // Bounded parallel file retrieval
      const retrievedPromises = ranked.map(async (file) => {
        try {
          const fetched = await this.fetchFileContent(
            owner,
            repo,
            file.path,
            repository.defaultBranch
          );
          if (!fetched) {
            return null;
          }

          const lines = fetched.content.split('\n');
          const sliced = lines.slice(0, maxExcerptLines);
          const numbered = sliced.map((line, idx) => `${idx + 1}: ${line}`).join('\n');
          const excerpt =
            lines.length > maxExcerptLines
              ? `${numbered}\n... [${lines.length - maxExcerptLines} lines omitted for context budget]`
              : numbered;

          const retrievedFile: RetrievedSourceFile = {
            path: file.path,
            sizeBytes: fetched.size,
            relevanceScore: file.score,
            relevanceReason: file.reason,
            evidenceRole: file.evidenceRole,
            htmlUrl:
              fetched.htmlUrl ||
              `https://github.com/${owner}/${repo}/blob/${repository.defaultBranch}/${file.path}`,
            excerpt,
          };
          return retrievedFile;
        } catch {
          return null;
        }
      });

      const settled = await Promise.all(retrievedPromises);
      const successfulFiles = settled.filter((f): f is RetrievedSourceFile => f !== null);

      if (successfulFiles.length === 0) {
        return {
          status: 'insufficient_evidence',
          evidenceQuality: 'insufficient',
          inspectedFileCount: 0,
          limitation:
            'Insufficient relevant source evidence: candidate repository files were retrieved, but their contents were identified as generated, binary, or discarded runtime artifacts.',
          treeTruncated: treeResult.truncated,
          externalRepositoryAdvisory: null,
          files: [],
        };
      }

      const hasDirectEvidence = successfulFiles.some((f) => f.evidenceRole === 'direct_evidence');
      const evidenceQuality = hasDirectEvidence ? 'direct_grounded' : 'indirect_reference';

      const isPartial = successfulFiles.length < ranked.length || treeResult.truncated;
      const status = isPartial ? 'partial' : 'completed';
      const limitation = !hasDirectEvidence
        ? 'Retrieved source files provide indirect reference patterns or shared components, but direct implementation evidence was not identified in this repository.'
        : treeResult.truncated
          ? 'Repository tree was truncated due to size; analyzed top available files.'
          : isPartial
            ? `Successfully inspected ${successfulFiles.length} of ${ranked.length} candidate files.`
            : null;

      return {
        status,
        evidenceQuality,
        inspectedFileCount: successfulFiles.length,
        limitation,
        treeTruncated: treeResult.truncated,
        externalRepositoryAdvisory: null,
        files: successfulFiles,
      };
    } catch (err) {
      return {
        status: 'unavailable',
        evidenceQuality: 'unavailable',
        inspectedFileCount: 0,
        limitation: `Repository intelligence encountered an unexpected error: ${err instanceof Error ? err.message : 'Unknown'}`,
        treeTruncated: false,
        externalRepositoryAdvisory: null,
        files: [],
      };
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
