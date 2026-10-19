import type { Request, Response } from 'express';
import type { HealthResponse } from '@prpilot/shared';

export function getHealth(req: Request, res: Response<HealthResponse>): void {
  const response: HealthResponse = {
    status: 'ok',
    service: 'prpilot-api',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    uptime: Number(process.uptime().toFixed(2)),
  };

  res.status(200).json(response);
}
