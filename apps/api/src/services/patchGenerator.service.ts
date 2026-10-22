import type {
  GithubIssue,
  GithubRepository,
  IssueAnalysis,
  PatchGenerationResponse,
  PatchValidationResult,
  FilePatchExplanation,
  RegressionTestProposal,
  GeneratePatchRequest,
} from '@prpilot/shared';
import { validateAndParseGithubIssueUrl } from '@prpilot/shared';
import { evaluatePatchEligibility } from './patchEligibility.js';
import { validatePatch } from './patchValidator.js';
import { AiAnalysisService, aiAnalysisService } from './ai.service.js';
import { GithubService, githubService } from './github.service.js';
import { AnalysisStorageService, analysisStorageService } from './analysisStorage.service.js';
import { BadRequestError, NotFoundError, UnprocessableEntityError } from '../errors/httpError.js';

export interface PatchGeneratorServiceOptions {
  aiService?: AiAnalysisService;
  githubService?: GithubService;
  storageService?: AnalysisStorageService;
}

export class PatchGeneratorService {
  private aiService: AiAnalysisService;
  private githubService: GithubService;
  private storageService: AnalysisStorageService;

  constructor(options: PatchGeneratorServiceOptions = {}) {
    this.aiService = options.aiService || aiAnalysisService;
    this.githubService = options.githubService || githubService;
    this.storageService = options.storageService || analysisStorageService;
  }

  /**
   * Main entry point for patch generation.
   * Enforces eligibility, fetches authentic repository snapshots,
   * queries Gemini with strict safety boundaries, and validates the diff deterministically.
   */
  async generatePatch(request: GeneratePatchRequest): Promise<PatchGenerationResponse> {
    let issue: GithubIssue;
    let repository: GithubRepository;
    let analysis: IssueAnalysis;
    let analysisId: string | undefined = request.analysisId;

    // 1. Resolve analysis and source evidence
    if (analysisId) {
      const persisted = await this.storageService.getAnalysisById(analysisId);
      if (!persisted) {
        throw new NotFoundError(`Analysis with ID '${analysisId}' was not found.`);
      }
      issue = persisted.analysisResult.issue;
      repository = persisted.analysisResult.repository;
      analysis = persisted.analysisResult.analysis;
    } else if (request.issueUrl) {
      const parseResult = validateAndParseGithubIssueUrl(request.issueUrl);
      if (!parseResult.success) {
        throw new BadRequestError(parseResult.error);
      }
      const { owner, repo, issueNumber } = parseResult.data;

      // Check if an analysis already exists in Neon database
      const existingAnalyses = await this.storageService.listAnalyses({ limit: 10 });
      const matched = existingAnalyses.items.find(
        (item) => item.issueUrl.toLowerCase() === request.issueUrl?.toLowerCase()
      );

      if (matched) {
        analysisId = matched.id;
        const persisted = await this.storageService.getAnalysisById(matched.id);
        if (persisted) {
          issue = persisted.analysisResult.issue;
          repository = persisted.analysisResult.repository;
          analysis = persisted.analysisResult.analysis;
        } else {
          // If record lookup failed, analyze afresh
          const fresh = await this.analyzeIssueAfresh(owner, repo, issueNumber);
          issue = fresh.issue;
          repository = fresh.repository;
          analysis = fresh.analysis;
        }
      } else {
        // Run fresh Phase 5 analysis if no saved analysis exists
        const fresh = await this.analyzeIssueAfresh(owner, repo, issueNumber);
        issue = fresh.issue;
        repository = fresh.repository;
        analysis = fresh.analysis;
      }
    } else {
      throw new BadRequestError('Either analysisId or issueUrl must be provided.');
    }

    // 2. Add patch generation eligibility checks
    const eligibility = evaluatePatchEligibility(issue, repository, analysis, {
      forceAllowClosed: request.forceAllowClosed,
    });

    if (!eligibility.eligible) {
      const notEligibleResult: PatchGenerationResponse = {
        analysisId,
        issueUrl: issue.htmlUrl,
        repository: repository.fullName,
        eligibility,
        status: 'not_eligible',
        suspectedRootCause: null,
        unifiedDiff: null,
        fileExplanations: [],
        regressionTests: [],
        assumptionsAndUncertainties: [],
        validation: null,
        generatedAt: new Date().toISOString(),
      };

      if (analysisId) {
        try {
          await this.storageService.savePatchResult(analysisId, notEligibleResult);
        } catch {
          // Persistence failure should not break response
        }
      }

      return notEligibleResult;
    }

    // 3. Retrieve authentic file snapshots from repository
    const fileSnapshots = new Map<string, string>();
    const filesToExamine: Array<{ path: string; content: string }> = [];

    // Prioritize direct evidence files from repository evidence
    const candidateFiles = (analysis.repositoryEvidence?.files || [])
      .filter((f) => f.evidenceRole !== 'indirect_reference')
      .slice(0, 3);

    for (const cand of candidateFiles) {
      try {
        const fetched = await this.githubService.fetchFileContent(
          repository.ownerLogin,
          repository.name,
          cand.path,
          repository.defaultBranch
        );
        if (fetched) {
          fileSnapshots.set(cand.path.toLowerCase(), fetched.content);
          fileSnapshots.set(cand.path, fetched.content);
          filesToExamine.push({
            path: cand.path,
            content: fetched.content,
          });
        }
      } catch {
        // Continue if single file retrieval fails
      }
    }

    if (filesToExamine.length === 0) {
      throw new UnprocessableEntityError(
        'Unable to retrieve authentic source file snapshots from the repository default branch. Patch generation cannot proceed without verified source snapshots.'
      );
    }

    // 4. Construct Gemini prompt requesting minimal unified diff & regression test
    const systemPrompt = `You are PRPilot's AI Patch Generation & Regression Test Synthesis engine.
Your mission is to generate the smallest justified, surgical code modification that fixes the reported issue, plus a robust regression test.

Rules and Strict Safety Constraints:
1. Provide the code modification strictly as a standard UNIFIED DIFF starting with '--- a/<filepath>' and '+++ b/<filepath>'.
2. Use authentic, repository-relative file paths matching the provided source files. Never invent paths or use absolute paths or '..' traversal.
3. Hunk headers MUST use standard format: @@ -<start>,<count> +<start>,<count> @@
4. Make the MINIMAL change necessary. Do NOT reformat unaffected code or introduce cosmetic edits.
5. Provide a realistic proposed regression test using standard JavaScript/TypeScript testing framework (vitest or jest).
6. Return structured JSON with:
   - "suspectedRootCause": detailed explanation of why the bug occurs.
   - "unifiedDiff": valid unified diff string.
   - "fileExplanations": array of objects { "path": string, "relevanceReason": string, "changeSummary": string, "addressedRegressionTest": string }
   - "regressionTests": array of objects { "title": string, "targetFile": string, "testFramework": string, "testCode": string, "description": string }
   - "assumptionsAndUncertainties": array of strings describing unverified assumptions or known edge cases.
`;

    const sourceContextText = filesToExamine
      .map((f) => {
        // Send up to 200 lines per file to maintain focused context
        const lines = f.content.split('\n');
        const preview = lines.slice(0, 200).join('\n');
        return `FILE: ${f.path}\n\`\`\`\n${preview}\n\`\`\``;
      })
      .join('\n\n');

    const userPrompt = `Issue Details:
Title: ${issue.title}
Number: #${issue.number}
Repository: ${repository.fullName}
URL: ${issue.htmlUrl}

Issue Description:
${(issue.body || 'No description provided').slice(0, 2000)}

Phase 5 Triage Summary:
${analysis.problemSummary}

Suspected Root Cause Hypotheses:
- ${analysis.rootCauseHypotheses.join('\n- ')}

Verified Repository Source Files:
${sourceContextText}

Generate the minimal unified diff and regression test in JSON format now.`;

    let modelResult: Record<string, unknown>;
    try {
      modelResult = await this.aiService.generateJsonCompletion(systemPrompt, userPrompt, {
        maxTokens: 4000,
        temperature: 0.1,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'AI completion failed';
      const failedResult: PatchGenerationResponse = {
        analysisId,
        issueUrl: issue.htmlUrl,
        repository: repository.fullName,
        eligibility,
        status: 'failed',
        suspectedRootCause: null,
        unifiedDiff: null,
        fileExplanations: [],
        regressionTests: [],
        assumptionsAndUncertainties: [`Model generation error: ${errorMsg}`],
        validation: null,
        generatedAt: new Date().toISOString(),
      };
      return failedResult;
    }

    // 5. Extract model outputs
    const suspectedRootCause =
      typeof modelResult.suspectedRootCause === 'string'
        ? modelResult.suspectedRootCause
        : 'Suspected root cause derived from issue and source inspection';

    const rawUnifiedDiff =
      typeof modelResult.unifiedDiff === 'string' ? modelResult.unifiedDiff.trim() : '';

    const rawExplanations = Array.isArray(modelResult.fileExplanations)
      ? modelResult.fileExplanations
      : [];
    const fileExplanations: FilePatchExplanation[] = rawExplanations.map((exp: unknown) => {
      const e = (exp && typeof exp === 'object' ? exp : {}) as Record<string, unknown>;
      return {
        path: String(e.path || 'unknown'),
        relevanceReason: String(e.relevanceReason || 'Identified source file'),
        changeSummary: String(e.changeSummary || 'Applied fix'),
        addressedRegressionTest: e.addressedRegressionTest
          ? String(e.addressedRegressionTest)
          : undefined,
      };
    });

    const rawTests = Array.isArray(modelResult.regressionTests) ? modelResult.regressionTests : [];
    const regressionTests: RegressionTestProposal[] = rawTests.map((test: unknown) => {
      const t = (test && typeof test === 'object' ? test : {}) as Record<string, unknown>;
      return {
        title: String(t.title || 'Regression Test'),
        targetFile: String(t.targetFile || filesToExamine[0]?.path || 'tests/regression.test.ts'),
        testFramework: String(t.testFramework || 'vitest/jest'),
        testCode: String(t.testCode || '// No test code generated'),
        description: String(t.description || 'Tests reproduction of the reported issue'),
        executionStatus: 'not_run' as const,
      };
    });

    const assumptionsAndUncertainties = Array.isArray(modelResult.assumptionsAndUncertainties)
      ? modelResult.assumptionsAndUncertainties.map(String)
      : ['AI patch generated based on source snapshot inspection. Manual review required.'];

    // 6. Deterministic Patch Validation
    let validation: PatchValidationResult | null = null;
    if (rawUnifiedDiff) {
      validation = validatePatch(rawUnifiedDiff, fileSnapshots);
    } else {
      validation = {
        isValid: false,
        status: 'validation_failed',
        appliedCleanly: false,
        validationErrors: ['Model did not produce any unified diff content.'],
        validationWarnings: [],
        parsedFiles: [],
        totalAdditions: 0,
        totalDeletions: 0,
      };
    }

    const finalResponse: PatchGenerationResponse = {
      analysisId,
      issueUrl: issue.htmlUrl,
      repository: repository.fullName,
      eligibility,
      status: 'generated',
      suspectedRootCause,
      unifiedDiff: rawUnifiedDiff,
      fileExplanations,
      regressionTests,
      assumptionsAndUncertainties,
      validation,
      generatedAt: new Date().toISOString(),
    };

    // 7. Persist patch result in database
    if (analysisId) {
      try {
        await this.storageService.savePatchResult(analysisId, finalResponse);
      } catch {
        // Non-blocking persistence
      }
    }

    return finalResponse;
  }

  private async analyzeIssueAfresh(
    owner: string,
    repo: string,
    issueNumber: number
  ): Promise<{ issue: GithubIssue; repository: GithubRepository; analysis: IssueAnalysis }> {
    const issueAndRepo = await this.githubService.getIssueAndRepo(owner, repo, issueNumber, {
      includeComments: true,
    });
    const repoEvidence = await this.githubService.gatherRepositoryEvidence(
      owner,
      repo,
      issueAndRepo.issue,
      issueAndRepo.repository
    );
    const analysis = await this.aiService.analyzeIssue(
      issueAndRepo.issue,
      issueAndRepo.repository,
      repoEvidence
    );
    return {
      issue: issueAndRepo.issue,
      repository: issueAndRepo.repository,
      analysis,
    };
  }
}

export const patchGeneratorService = new PatchGeneratorService();
