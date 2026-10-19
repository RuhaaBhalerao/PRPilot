import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { healthResponseSchema } from '@prpilot/shared';

describe('Health Endpoints', () => {
  it('GET /api/v1/health returns 200 and matches shared HealthResponse schema', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);

    // Validate using shared Zod schema
    const parseResult = healthResponseSchema.safeParse(res.body);
    expect(parseResult.success).toBe(true);

    if (parseResult.success) {
      expect(parseResult.data.status).toBe('ok');
      expect(parseResult.data.service).toBe('prpilot-api');
      expect(typeof parseResult.data.uptime).toBe('number');
      expect(typeof parseResult.data.timestamp).toBe('string');
    }
  });

  it('GET /api/health behaves consistently with /api/v1/health', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);

    const parseResult = healthResponseSchema.safeParse(res.body);
    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      expect(parseResult.data.status).toBe('ok');
      expect(parseResult.data.service).toBe('prpilot-api');
    }
  });
});
