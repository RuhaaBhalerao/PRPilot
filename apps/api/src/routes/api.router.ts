import { Router } from 'express';
import { healthRouter } from './health.router.js';
import { githubRouter } from './github.router.js';
import { analyzeIssueRequestSchema } from '@prpilot/shared';

export const apiRouter = Router();

// Canonical v1 router
const v1Router = Router();
v1Router.use('/health', healthRouter);
v1Router.use('/github', githubRouter);

// Phase 1 / Phase 2 placeholder for backward compatibility
v1Router.post('/analyze', (req, res, next) => {
  try {
    const validated = analyzeIssueRequestSchema.parse(req.body);
    res.status(501).json({
      error: 'Not Implemented',
      message: 'GitHub issue analysis agent is scheduled for Phase 2',
      requestedUrl: validated.issueUrl,
    });
  } catch (error) {
    next(error);
  }
});

// Mount /api/v1
apiRouter.use('/v1', v1Router);

// Consistent shortcut: /api/health
apiRouter.use('/health', healthRouter);
