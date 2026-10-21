import type { Request, Response, NextFunction } from 'express';
import {
  analyzeIssueRequestSchema,
  parseGithubIssueUrl,
  type AnalyzeIssueResponse,
} from '@prpilot/shared';
import { githubService, GithubService } from '../services/github.service.js';
import { aiAnalysisService, AiAnalysisService } from '../services/ai.service.js';
import {
  analysisStorageService,
  AnalysisStorageService,
} from '../services/analysisStorage.service.js';
import { BadGatewayError } from '../errors/httpError.js';

export function createAnalyzeIssueController(
  github: GithubService = githubService,
  ai: AiAnalysisService = aiAnalysisService,
  storage: AnalysisStorageService = analysisStorageService
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = analyzeIssueRequestSchema.parse(req.body);
      const parsedUrl = parseGithubIssueUrl(validated.issueUrl);

      if (!parsedUrl) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid GitHub issue URL format',
        });
        return;
      }

      // Step 1: Retrieve and normalize real issue and repository metadata from GitHub
      const { issue, repository } = await github.getIssueAndRepo(
        parsedUrl.owner,
        parsedUrl.repo,
        parsedUrl.issueNumber,
        { includeComments: true }
      );

      // Step 2: Gather repository evidence using Git tree and transparent file ranking
      const evidence = await github.gatherRepositoryEvidence(
        parsedUrl.owner,
        parsedUrl.repo,
        issue,
        repository
      );

      // Step 3: Formulate evidence-grounded 7-section structured triage analysis with AI
      const analysis = await ai.analyzeIssue(issue, repository, evidence);

      const analysisResult: AnalyzeIssueResponse = {
        issue,
        repository,
        analysis,
      };

      // Step 3: Persist analysis to PostgreSQL database
      let savedId: string | undefined;
      try {
        const saved = await storage.saveAnalysis({
          issueUrl: issue.htmlUrl,
          issueTitle: issue.title,
          repository: repository.fullName,
          analysisResult,
          status: 'completed',
        });
        savedId = saved.id;
      } catch (dbError) {
        // Handle database failures deliberately; do not silently report as saved if insert failed
        throw new BadGatewayError(
          `Failed to persist analysis to database: ${dbError instanceof Error ? dbError.message : 'Database error'}`
        );
      }

      res.status(200).json({
        id: savedId,
        issue,
        repository,
        analysis,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const analyzeIssueController = createAnalyzeIssueController();
