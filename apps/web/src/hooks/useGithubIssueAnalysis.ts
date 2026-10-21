import { useMutation } from '@tanstack/react-query';
import { analyzeGithubIssue, ApiError } from '../lib/api';
import type { AnalyzeIssueResponse } from '@prpilot/shared';

export function useGithubIssueAnalysis() {
  return useMutation<AnalyzeIssueResponse, ApiError, string>({
    mutationFn: (issueUrl: string) => analyzeGithubIssue(issueUrl),
    retry: false,
  });
}
