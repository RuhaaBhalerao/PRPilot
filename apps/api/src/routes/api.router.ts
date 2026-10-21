import { Router } from 'express';
import { healthRouter } from './health.router.js';
import { githubRouter } from './github.router.js';
import { analyzeIssueController } from '../controllers/analyze.controller.js';
import { historyController } from '../controllers/history.controller.js';

export const apiRouter = Router();

// Canonical v1 router
const v1Router = Router();
v1Router.use('/health', healthRouter);
v1Router.use('/github', githubRouter);

// AI-powered GitHub issue analysis endpoint
v1Router.post('/analyze', analyzeIssueController);

// Analysis history endpoints
v1Router.get('/analyses', historyController.listAnalyses);
v1Router.get('/analyses/:id', historyController.getAnalysisById);

// Mount /api/v1
apiRouter.use('/v1', v1Router);

// Consistent shortcut: /api/health
apiRouter.use('/health', healthRouter);
