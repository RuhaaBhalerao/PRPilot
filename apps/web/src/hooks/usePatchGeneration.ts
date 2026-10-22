import { useMutation } from '@tanstack/react-query';
import { generatePatchApi, ApiError } from '../lib/api';
import type { GeneratePatchRequest, PatchGenerationResponse } from '@prpilot/shared';

export function usePatchGeneration() {
  return useMutation<PatchGenerationResponse, ApiError, GeneratePatchRequest>({
    mutationFn: (request: GeneratePatchRequest) => generatePatchApi(request),
    retry: false,
  });
}
