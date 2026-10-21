import { Router } from 'express';
import { lookupIssueController } from '../controllers/github.controller.js';
import { analyzeIssueController } from '../controllers/analyze.controller.js';

export const githubRouter = Router();

// POST /api/v1/github/issues/lookup
githubRouter.post('/issues/lookup', lookupIssueController);

// POST /api/v1/github/issues/analyze
githubRouter.post('/issues/analyze', analyzeIssueController);
