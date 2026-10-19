import { z } from 'zod';

export const GITHUB_ISSUE_URL_REGEX =
  /^https:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/issues\/(\d+)(#.*)?$/;

export const analyzeIssueRequestSchema = z.object({
  issueUrl: z
    .string()
    .trim()
    .min(1, { message: 'Issue URL is required' })
    .url({ message: 'Please enter a valid URL' })
    .regex(GITHUB_ISSUE_URL_REGEX, {
      message: 'Must be a public GitHub issue URL (e.g. https://github.com/owner/repo/issues/123)',
    }),
});

export type AnalyzeIssueRequest = z.infer<typeof analyzeIssueRequestSchema>;

export interface ParsedGithubIssueUrl {
  owner: string;
  repo: string;
  issueNumber: number;
}

export function parseGithubIssueUrl(url: string): ParsedGithubIssueUrl | null {
  const match = url.trim().match(GITHUB_ISSUE_URL_REGEX);
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2],
    issueNumber: parseInt(match[3], 10),
  };
}
