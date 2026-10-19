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

  it('accepts a valid GitHub issue URL and returns honest 501 Phase 2 message', async () => {
    const res = await request(app)
      .post('/api/v1/analyze')
      .send({ issueUrl: 'https://github.com/facebook/react/issues/12345' });

    expect(res.status).toBe(501);
    expect(res.body.error).toBe('Not Implemented');
    expect(res.body.message).toContain('Phase 2');
    expect(res.body.requestedUrl).toBe('https://github.com/facebook/react/issues/12345');
  });
});
