import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // Express identifies error handlers by having exactly 4 parameters, so `_next` is preserved
  _next: NextFunction
): void {
  // Handle Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Request payload validation failed',
      details: err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }

  // Handle malformed JSON body errors
  if (err instanceof SyntaxError && 'status' in err && err.status === 400 && 'body' in err) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Malformed JSON payload in request body',
    });
    return;
  }

  // Generic internal server error
  const isProduction = process.env.NODE_ENV === 'production';
  const errorMessage = err instanceof Error ? err.message : 'Unknown server error';

  if (!isProduction && process.env.NODE_ENV !== 'test') {
    console.error('[Error]', err);
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: isProduction ? 'An unexpected error occurred' : errorMessage,
  });
}
