import type { Request, Response, NextFunction } from 'express';
import { issueLookupRequestSchema, parseGithubIssueUrl } from '@prpilot/shared';
import { githubService, GithubService } from '../services/github.service.js';

export function createLookupIssueController(service: GithubService = githubService) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = issueLookupRequestSchema.parse(req.body);
      const parsedUrl = parseGithubIssueUrl(validated.issueUrl);

      if (!parsedUrl) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid GitHub issue URL format',
        });
        return;
      }

      const data = await service.getIssueAndRepo(
        parsedUrl.owner,
        parsedUrl.repo,
        parsedUrl.issueNumber
      );

      res.status(200).json(data);
    } catch (error) {
      next(error);
    }
  };
}

export const lookupIssueController = createLookupIssueController();
