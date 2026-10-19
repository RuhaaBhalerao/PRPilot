import express from 'express';
import corsMiddleware from 'cors';
import { env } from './config/env.js';
import { requestLogger } from './middleware/logger.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiRouter } from './routes/api.router.js';

export function createApp() {
  const app = express();

  // Security & Cross-Origin Resource Sharing
  app.use(
    corsMiddleware({
      origin: [env.WEB_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    })
  );

  // Body parsing middleware
  app.use(express.json());

  // Structured HTTP logger
  app.use(requestLogger);

  // Mount API routes
  app.use('/api', apiRouter);

  // Handle undefined routes with consistent JSON 404
  app.use(notFoundHandler);

  // Centralized error handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
