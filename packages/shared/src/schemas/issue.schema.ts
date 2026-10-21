import { z } from 'zod';

export interface ParsedGithubIssueUrl {
  owner: string;
  repo: string;
  issueNumber: number;
}

export type IssueUrlValidationResult =
  { success: true; data: ParsedGithubIssueUrl } | { success: false; error: string };

/**
 * Strict canonical GitHub issue URL parser and validator.
 * Accepts only canonical public issue URLs:
 *   https://github.com/{owner}/{repository}/issues/{issueNumber}
 */
export function validateAndParseGithubIssueUrl(rawUrl: string): IssueUrlValidationResult {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return { success: false, error: 'Issue URL is required' };
  }

  const trimmed = rawUrl.trim();

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { success: false, error: 'Please enter a valid URL' };
  }

  // 1. Require HTTPS
  if (parsed.protocol !== 'https:') {
    return { success: false, error: 'Only HTTPS URLs are allowed (http is not permitted)' };
  }

  // 2. Allow only exact github.com hostname
  if (parsed.hostname.toLowerCase() !== 'github.com') {
    return { success: false, error: 'Only public GitHub (github.com) URLs are supported' };
  }

  // 3. Reject credentials embedded in URLs
  if (parsed.username || parsed.password) {
    return { success: false, error: 'URLs with embedded credentials are not allowed' };
  }

  // 4. Reject custom ports
  if (parsed.port) {
    return { success: false, error: 'Custom ports are not allowed in GitHub URLs' };
  }

  // 5. Reject query strings outside canonical format
  if (parsed.search && parsed.search.length > 0) {
    return { success: false, error: 'Query parameters are not permitted in canonical issue URLs' };
  }

  // 6. Fragment/Hash validation: allow only empty or canonical issue anchor (e.g. #issue-123 or #issuecomment-123)
  if (parsed.hash) {
    const validHashRegex = /^#(?:issue(?:comment)?-\d+|top)$/;
    if (!validHashRegex.test(parsed.hash)) {
      return { success: false, error: 'Unexpected fragment/hash in issue URL' };
    }
  }

  // 7. Normalize pathname and inspect structure
  const pathname = parsed.pathname.replace(/\/+$/, '');

  // Detect and reject pull request URLs with clear messaging
  if (/\/(?:pull|pulls)\//i.test(pathname)) {
    return {
      success: false,
      error: 'The provided URL points to a pull request, not an issue (/pull/ is not supported)',
    };
  }

  // Detect and reject discussion URLs
  if (/\/(?:discussions?)\//i.test(pathname)) {
    return {
      success: false,
      error: 'The provided URL points to a GitHub discussion, not an issue',
    };
  }

  const segments = pathname.split('/').filter(Boolean);
  if (segments.length !== 4 || segments[2] !== 'issues') {
    return {
      success: false,
      error:
        'URL path must match canonical structure: https://github.com/{owner}/{repository}/issues/{issueNumber}',
    };
  }

  const [owner, repo, , issueNumStr] = segments;

  // Validate owner format (GitHub usernames/orgs: 1-39 chars, alphanumeric with - or _, no traversal)
  const ownerRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]{0,38})$/;
  if (!ownerRegex.test(owner) || owner.includes('..')) {
    return { success: false, error: 'Invalid repository owner in URL' };
  }

  // Validate repository name (1-100 chars, alphanumeric with -, _, ., no path traversal)
  const repoRegex = /^[a-zA-Z0-9_.-]{1,100}$/;
  if (!repoRegex.test(repo) || repo === '.' || repo === '..' || repo.includes('/')) {
    return { success: false, error: 'Invalid repository name in URL' };
  }

  // Validate issue number: strictly positive integer without leading zeros
  const issueNumRegex = /^[1-9]\d*$/;
  if (!issueNumRegex.test(issueNumStr)) {
    return {
      success: false,
      error: 'Issue number must be a positive integer without leading zeros',
    };
  }

  const issueNumber = parseInt(issueNumStr, 10);
  if (!Number.isSafeInteger(issueNumber) || issueNumber <= 0 || issueNumber > 2147483647) {
    return { success: false, error: 'Issue number is out of allowable range' };
  }

  return {
    success: true,
    data: {
      owner,
      repo,
      issueNumber,
    },
  };
}

export function parseGithubIssueUrl(url: string): ParsedGithubIssueUrl | null {
  const result = validateAndParseGithubIssueUrl(url);
  return result.success ? result.data : null;
}

// Request Schema
export const analyzeIssueRequestSchema = z.object({
  issueUrl: z
    .string()
    .trim()
    .min(1, { message: 'Issue URL is required' })
    .superRefine((val, ctx) => {
      const result = validateAndParseGithubIssueUrl(val);
      if (!result.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: result.error,
        });
      }
    }),
});

export const issueLookupRequestSchema = analyzeIssueRequestSchema;

export type AnalyzeIssueRequest = z.infer<typeof analyzeIssueRequestSchema>;
export type IssueLookupRequest = AnalyzeIssueRequest;

// Label Schema
export const githubIssueLabelSchema = z.object({
  id: z.number().optional(),
  name: z.string(),
  color: z.string().optional(),
  description: z.string().nullable().optional(),
});

// Normalized Issue Schema
export const githubIssueSchema = z.object({
  number: z.number().int().positive(),
  title: z.string(),
  body: z.string().nullable(),
  state: z.enum(['open', 'closed']),
  htmlUrl: z.string().url(),
  authorLogin: z.string().nullable(),
  labels: z.array(githubIssueLabelSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
  closedAt: z.string().nullable(),
  isPullRequest: z.boolean(),
});

// Normalized Repository Schema
export const githubRepositorySchema = z.object({
  ownerLogin: z.string(),
  name: z.string(),
  fullName: z.string(),
  description: z.string().nullable(),
  htmlUrl: z.string().url(),
  defaultBranch: z.string(),
  primaryLanguage: z.string().nullable(),
  stars: z.number().int().nonnegative(),
  openIssueCount: z.number().int().nonnegative(),
  isArchived: z.boolean(),
});

// Endpoint Response Schema
export const issueLookupResponseSchema = z.object({
  issue: githubIssueSchema,
  repository: githubRepositorySchema,
});

export type GithubIssueLabel = z.infer<typeof githubIssueLabelSchema>;
export type GithubIssue = z.infer<typeof githubIssueSchema>;
export type GithubRepository = z.infer<typeof githubRepositorySchema>;
export type IssueLookupResponse = z.infer<typeof issueLookupResponseSchema>;

// Evidence and Missing Information Sub-schema
export const evidenceAndMissingInfoSchema = z.object({
  verifiedFacts: z
    .array(z.string())
    .describe('Facts directly stated in the issue report, stack traces, or confirmed metadata'),
  hypotheses: z
    .array(z.string())
    .describe('Analytical hypotheses or inferences derived from the available evidence'),
  missingInformation: z
    .array(z.string())
    .describe('Critical information or reproduction details absent from the issue report'),
});

// File / Component Target Sub-schema
export const fileInvestigationTargetSchema = z.object({
  name: z.string().describe('File path, module name, or component to investigate'),
  reason: z.string().describe('Explanation of why this file or component is relevant'),
});

// Full Issue Analysis Section Schema
export const issueAnalysisSectionSchema = z.object({
  problemSummary: z.string().describe('Concise description of the reported problem'),
  expectedBehaviour: z
    .string()
    .describe('Expected vs observed behaviour of the system or application'),
  rootCauseHypotheses: z
    .array(z.string())
    .describe('List of potential root-cause hypotheses explaining the failure'),
  evidenceAndMissingInformation: evidenceAndMissingInfoSchema,
  filesOrComponentsToInvestigate: z
    .array(fileInvestigationTargetSchema)
    .describe('Candidate source files or components to investigate'),
  proposedFixSteps: z
    .array(z.string())
    .describe('Step-by-step guidance for formulating and applying a code fix'),
  regressionTestPlan: z
    .array(z.string())
    .describe('Recommended test assertions and test scenarios to prevent regressions'),
  repositoryContextAvailable: z.boolean().default(false),
  repositoryContextLimitation: z
    .string()
    .describe('Explicit notice explaining that repository source files were not retrieved'),
  isClosedIssue: z.boolean().default(false),
  closedIssueNotice: z.string().nullable().optional(),
});

// Complete Analysis Endpoint Response Schema
export const analyzeIssueResponseSchema = z.object({
  issue: githubIssueSchema,
  repository: githubRepositorySchema,
  analysis: issueAnalysisSectionSchema,
});

export type EvidenceAndMissingInfo = z.infer<typeof evidenceAndMissingInfoSchema>;
export type FileInvestigationTarget = z.infer<typeof fileInvestigationTargetSchema>;
export type IssueAnalysis = z.infer<typeof issueAnalysisSectionSchema>;
export type AnalyzeIssueResponse = z.infer<typeof analyzeIssueResponseSchema>;
