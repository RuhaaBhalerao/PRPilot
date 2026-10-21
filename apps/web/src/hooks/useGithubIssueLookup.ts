import { useMutation } from '@tanstack/react-query';
import { lookupGithubIssue, ApiError } from '../lib/api';
import type { IssueLookupResponse } from '@prpilot/shared';

export function useGithubIssueLookup() {
  return useMutation<IssueLookupResponse, ApiError, string>({
    mutationFn: (issueUrl: string) => lookupGithubIssue(issueUrl),
    retry: false,
  });
}
