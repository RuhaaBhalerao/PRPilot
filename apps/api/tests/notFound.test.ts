import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('404 Not Found Handling', () => {
  it('returns a JSON 404 response for unknown routes', async () => {
    const res = await request(app).get('/api/non-existent-endpoint');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toEqual({
      error: 'Not Found',
      message: 'Cannot GET /api/non-existent-endpoint',
    });
  });

  it('returns a JSON 404 response for root unknown paths', async () => {
    const res = await request(app).post('/random-unknown-path');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toEqual({
      error: 'Not Found',
      message: 'Cannot POST /random-unknown-path',
    });
  });
});
