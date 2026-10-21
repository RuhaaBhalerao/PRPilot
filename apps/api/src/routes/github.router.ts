import { Router } from 'express';
import { lookupIssueController } from '../controllers/github.controller.js';

export const githubRouter = Router();

// POST /api/v1/github/issues/lookup
githubRouter.post('/issues/lookup', lookupIssueController);
