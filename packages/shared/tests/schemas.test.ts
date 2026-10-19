import { describe, it, expect } from 'vitest';
import {
  healthResponseSchema,
  analyzeIssueRequestSchema,
  parseGithubIssueUrl,
} from '../src/index.js';

describe('Shared Schemas', () => {
  describe('healthResponseSchema', () => {
    it('validates a correct health response payload', () => {
      const validPayload = {
        status: 'ok',
        service: 'prpilot-api',
        timestamp: new Date().toISOString(),
        version: '0.1.0',
        uptime: 12.34,
      };

      const result = healthResponseSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('ok');
        expect(result.data.service).toBe('prpilot-api');
      }
    });

    it('rejects an invalid health response payload missing required fields', () => {
      const invalidPayload = {
        status: 'error',
      };

      const result = healthResponseSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe('analyzeIssueRequestSchema', () => {
    it('accepts valid public GitHub issue URLs', () => {
      const validUrls = [
        'https://github.com/facebook/react/issues/12345',
        'https://github.com/nodejs/node/issues/1',
        'https://github.com/owner-name/repo.name/issues/999#issuecomment-123',
      ];

      for (const issueUrl of validUrls) {
        const result = analyzeIssueRequestSchema.safeParse({ issueUrl });
        expect(result.success).toBe(true);
      }
    });

    it('rejects invalid or non-issue URLs', () => {
      const invalidUrls = [
        'https://gitlab.com/owner/repo/issues/1',
        'https://github.com/owner/repo/pull/123',
        'https://github.com/owner/repo',
        'not-a-url',
        '',
      ];

      for (const issueUrl of invalidUrls) {
        const result = analyzeIssueRequestSchema.safeParse({ issueUrl });
        expect(result.success).toBe(false);
      }
    });
  });

  describe('parseGithubIssueUrl', () => {
    it('correctly parses owner, repo, and issue number', () => {
      const parsed = parseGithubIssueUrl('https://github.com/facebook/react/issues/28000');
      expect(parsed).toEqual({
        owner: 'facebook',
        repo: 'react',
        issueNumber: 28000,
      });
    });

    it('returns null for non-matching URLs', () => {
      const parsed = parseGithubIssueUrl('https://google.com');
      expect(parsed).toBeNull();
    });
  });
});
