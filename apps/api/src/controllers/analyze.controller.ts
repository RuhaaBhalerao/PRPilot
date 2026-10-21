import type { Request, Response, NextFunction } from 'express';
import { analyzeIssueRequestSchema, parseGithubIssueUrl } from '@prpilot/shared';
import { githubService, GithubService } from '../services/github.service.js';
import { aiAnalysisService, AiAnalysisService } from '../services/ai.service.js';

export function createAnalyzeIssueController(
  github: GithubService = githubService,
  ai: AiAnalysisService = aiAnalysisService
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
        parsedUrl.issueNumber
      );

      // Step 2: Formulate 7-section structured triage analysis with AI
      const analysis = await ai.analyzeIssue(issue, repository);

      res.status(200).json({
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
