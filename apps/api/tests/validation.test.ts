import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('POST /api/v1/analyze validation', () => {
  it('rejects an invalid GitHub issue URL with 400 Bad Request and validation error details', async () => {
    const res = await request(app)
      .post('/api/v1/analyze')
      .send({ issueUrl: 'https://gitlab.com/owner/repo/issues/123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
    expect(res.body.details).toBeDefined();
    expect(res.body.details[0].path).toBe('issueUrl');
  });

  it('rejects an empty request body with 400 Bad Request', async () => {
    const res = await request(app).post('/api/v1/analyze').send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
    expect(res.body.details).toBeDefined();
  });
});
