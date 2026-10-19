import { Router } from 'express';
import { healthRouter } from './health.router.js';
import { analyzeIssueRequestSchema } from '@prpilot/shared';

export const apiRouter = Router();

// Canonical health check: /api/v1/health
const v1Router = Router();
v1Router.use('/health', healthRouter);

// Phase 2 placeholder demonstrating shared Zod request validation
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
