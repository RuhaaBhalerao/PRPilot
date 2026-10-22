import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { env } from '../config/env.js';

export interface QueryClient {
  query<T = Record<string, unknown>>(queryText: string, params?: unknown[]): Promise<T[]>;
}

export class DatabaseService {
  private sql?: NeonQueryFunction<false, false>;
  private customClient?: QueryClient;
  readonly isConfigured: boolean;

  constructor(customClient?: QueryClient, databaseUrl?: string) {
    if (customClient) {
      this.customClient = customClient;
      this.isConfigured = true;
      return;
    }

    const url = databaseUrl !== undefined ? databaseUrl : env.DATABASE_URL;
    if (typeof url === 'string' && url.trim().length > 0) {
      this.sql = neon(url.trim());
      this.isConfigured = true;
    } else {
      this.isConfigured = false;
    }
  }

  /**
   * Executes a safe, parameterized SQL query.
   * Parameter values ($1, $2, ...) are passed separately from query text.
   */
  async query<T = Record<string, unknown>>(
    queryText: string,
    params: unknown[] = []
  ): Promise<T[]> {
    if (this.customClient) {
      return this.customClient.query<T>(queryText, params);
    }

    if (!this.isConfigured || !this.sql) {
      throw new Error(
        'Database connection is not configured. Please set DATABASE_URL in apps/api/.env.'
      );
    }

    try {
      const rows = (await this.sql.query(queryText, params)) as T[];
      return rows;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Database error';
      // Throw clean error message without logging credentials or connection string
      throw new Error(`Database query failure: ${message}`);
    }
  }

  /**
   * Verifies database connectivity using a lightweight SELECT 1 test query.
   */
  async verifyConnection(): Promise<boolean> {
    try {
      const rows = await this.query<{ connected: number }>('SELECT 1 as connected');
      return rows.length > 0 && rows[0].connected === 1;
    } catch {
      return false;
    }
  }

  /**
   * Initializes the database schema and indexes if they do not already exist.
   */
  async initSchema(): Promise<void> {
    await this.query(`
      CREATE TABLE IF NOT EXISTS analyses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        issue_url TEXT NOT NULL,
        issue_title TEXT NOT NULL,
        repository TEXT NOT NULL,
        analysis_result JSONB NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'completed',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await this.query(`
      CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses (created_at DESC)
    `);

    await this.query(`
      CREATE INDEX IF NOT EXISTS idx_analyses_issue_url ON analyses (issue_url)
    `);

    await this.query(`
      CREATE INDEX IF NOT EXISTS idx_analyses_repository ON analyses (repository)
    `);

    // Phase 6 migration: patch_result column for AI-generated patches and regression tests
    await this.query(`
      ALTER TABLE analyses ADD COLUMN IF NOT EXISTS patch_result JSONB
    `);
  }
}

export const db = new DatabaseService();
