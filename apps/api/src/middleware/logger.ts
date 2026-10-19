import type { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  // Avoid excessive logs in test environment
  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, originalUrl } = req;
    const { statusCode } = res;

    // Log request summary safely without printing headers or body secrets
    console.log(`[HTTP] ${method} ${originalUrl} -> ${statusCode} (${duration}ms)`);
  });

  next();
}
