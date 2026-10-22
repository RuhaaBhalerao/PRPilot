import type {
  VerifyPatchRequest,
  PatchVerificationResponse,
  PatchValidationResult,
  PatchGenerationResponse,
} from '@prpilot/shared';
import { validatePatch } from './patchValidator.js';
import { AnalysisStorageService, analysisStorageService } from './analysisStorage.service.js';
import { GithubService, githubService } from './github.service.js';
import { BadRequestError, NotFoundError } from '../errors/httpError.js';

export interface PatchVerificationServiceOptions {
  storageService?: AnalysisStorageService;
  githubService?: GithubService;
}

export class PatchVerificationService {
  private storageService: AnalysisStorageService;
  private githubService: GithubService;

  constructor(options: PatchVerificationServiceOptions = {}) {
    this.storageService = options.storageService || analysisStorageService;
    this.githubService = options.githubService || githubService;
  }

  /**
   * Verifies an AI-generated patch structurally and checks isolated sandbox readiness.
   * Host execution of generated code or tests is strictly prohibited.
   */
  async verifyPatch(request: VerifyPatchRequest): Promise<PatchVerificationResponse> {
    let diffToVerify: string | undefined = request.unifiedDiff;
    let savedPatchResult: PatchGenerationResponse | null = null;
    const fileSnapshots = new Map<string, string>();

    // 1. Resolve analysis and existing patch if analysisId is provided
    if (request.analysisId) {
      const persisted = await this.storageService.getAnalysisById(request.analysisId);
      if (!persisted) {
        throw new NotFoundError(`Analysis with ID '${request.analysisId}' was not found.`);
      }

      savedPatchResult = persisted.patchResult ?? null;
      if (!diffToVerify && savedPatchResult?.unifiedDiff) {
        diffToVerify = savedPatchResult.unifiedDiff;
      }

      const repo = persisted.analysisResult.repository;

      // Retrieve authentic source file snapshots for direct evidence files
      const candidateFiles = (persisted.analysisResult.analysis.repositoryEvidence?.files || [])
        .filter((f) => f.evidenceRole !== 'indirect_reference')
        .slice(0, 5);

      for (const cand of candidateFiles) {
        try {
          const fetched = await this.githubService.fetchFileContent(
            repo.ownerLogin,
            repo.name,
            cand.path,
            repo.defaultBranch
          );
          if (fetched) {
            fileSnapshots.set(cand.path.toLowerCase(), fetched.content);
            fileSnapshots.set(cand.path, fetched.content);
          }
        } catch {
          // Continue if file snapshot retrieval fails
        }
      }
    }

    if (!diffToVerify || diffToVerify.trim().length === 0) {
      throw new BadRequestError('Unified diff content is required for patch verification.');
    }

    // 2. Perform deterministic structural validation
    const structuralValidation: PatchValidationResult = validatePatch(diffToVerify, fileSnapshots);

    // 3. Evaluate sandbox execution policy
    // Strict safety constraint: Never execute untrusted generated code on host API process.
    let testExecutionStatus: PatchVerificationResponse['testExecutionStatus'] = 'not_run';
    let sandboxStatus: 'not_run' | 'sandbox_unavailable' = 'not_run';
    let sandboxReason =
      'Structural diff validation passed. Test execution is not_run (human review mode).';

    if (request.runSandboxTests) {
      testExecutionStatus = 'sandbox_unavailable';
      sandboxStatus = 'sandbox_unavailable';
      sandboxReason =
        'Isolated execution sandbox is unavailable. Host execution of untrusted AI-generated code is strictly prohibited for security.';
    }

    const verificationResponse: PatchVerificationResponse = {
      analysisId: request.analysisId,
      issueUrl: request.issueUrl || savedPatchResult?.issueUrl,
      structuralValidation,
      testExecutionStatus,
      sandboxDetails: {
        available: false,
        status: sandboxStatus,
        reason: sandboxReason,
      },
      verifiedAt: new Date().toISOString(),
    };

    // 4. Update persisted record if analysisId is present
    if (request.analysisId && savedPatchResult) {
      const updatedPatch: PatchGenerationResponse = {
        ...savedPatchResult,
        verification: verificationResponse,
      };
      try {
        await this.storageService.savePatchResult(request.analysisId, updatedPatch);
      } catch {
        // Non-blocking persistence
      }
    }

    return verificationResponse;
  }
}

export const patchVerificationService = new PatchVerificationService();
