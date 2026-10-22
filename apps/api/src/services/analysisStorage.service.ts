import type {
  AnalyzeIssueResponse,
  PersistedAnalysis,
  AnalysisHistoryItem,
  AnalysisHistoryListResponse,
  PatchGenerationResponse,
} from '@prpilot/shared';
import { db, DatabaseService } from '../db/connection.js';

interface RawAnalysisRow {
  id: string;
  issue_url: string;
  issue_title: string;
  repository: string;
  analysis_result: AnalyzeIssueResponse;
  patch_result?: PatchGenerationResponse | string | null;
  status: 'completed' | 'failed';
  created_at: Date | string;
  updated_at: Date | string;
}

interface RawAnalysisSummaryRow {
  id: string;
  issue_url: string;
  issue_title: string;
  repository: string;
  status: 'completed' | 'failed';
  created_at: Date | string;
  updated_at: Date | string;
}

export interface SaveAnalysisInput {
  issueUrl: string;
  issueTitle: string;
  repository: string;
  analysisResult: AnalyzeIssueResponse;
  status?: 'completed' | 'failed';
}

export class AnalysisStorageService {
  constructor(private readonly database: DatabaseService = db) {}

  /**
   * Saves a completed or failed analysis to the database.
   * Protects against duplicate records from rapid accidental double submissions (within 30s).
   */
  async saveAnalysis(input: SaveAnalysisInput): Promise<PersistedAnalysis> {
    const status = input.status ?? 'completed';

    // Check for a recent identical submission to avoid accidental duplicates
    try {
      const existing = await this.database.query<RawAnalysisRow>(
        `SELECT id, issue_url, issue_title, repository, analysis_result, status, created_at, updated_at
         FROM analyses
         WHERE issue_url = $1
           AND status = $2
           AND created_at > NOW() - INTERVAL '30 seconds'
         ORDER BY created_at DESC
         LIMIT 1`,
        [input.issueUrl, status]
      );

      if (existing.length > 0) {
        return this.mapToPersistedAnalysis(existing[0]);
      }
    } catch {
      // If the duplicate check fails, continue to insert attempt
    }

    const rows = await this.database.query<RawAnalysisRow>(
      `INSERT INTO analyses (issue_url, issue_title, repository, analysis_result, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, issue_url, issue_title, repository, analysis_result, status, created_at, updated_at`,
      [
        input.issueUrl,
        input.issueTitle,
        input.repository,
        JSON.stringify(input.analysisResult),
        status,
      ]
    );

    if (!rows || rows.length === 0) {
      throw new Error('Database insert failed: no record returned.');
    }

    return this.mapToPersistedAnalysis(rows[0]);
  }

  /**
   * Retrieves an analysis record by its primary key UUID.
   */
  async getAnalysisById(id: string): Promise<PersistedAnalysis | null> {
    // Validate UUID format to prevent malformed queries
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return null;
    }

    const rows = await this.database.query<RawAnalysisRow>(
      `SELECT id, issue_url, issue_title, repository, analysis_result, patch_result, status, created_at, updated_at
       FROM analyses
       WHERE id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return null;
    }

    return this.mapToPersistedAnalysis(rows[0]);
  }

  /**
   * Updates an existing analysis record with the generated patch result.
   */
  async savePatchResult(analysisId: string, patchResult: PatchGenerationResponse): Promise<void> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(analysisId)) {
      throw new Error(`Invalid analysis ID format: ${analysisId}`);
    }

    await this.database.query(
      `UPDATE analyses
       SET patch_result = $1, updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(patchResult), analysisId]
    );
  }

  /**
   * Retrieves just the patch result associated with an analysis ID.
   */
  async getPatchByAnalysisId(analysisId: string): Promise<PatchGenerationResponse | null> {
    const analysis = await this.getAnalysisById(analysisId);
    return analysis?.patchResult ?? null;
  }

  /**
   * Lists analyses ordered newest first with limit and offset pagination.
   */
  async listAnalyses(
    options: { limit?: number; offset?: number } = {}
  ): Promise<AnalysisHistoryListResponse> {
    const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
    const offset = Math.max(Number(options.offset) || 0, 0);

    const countRows = await this.database.query<{ count: string | number }>(
      'SELECT COUNT(*)::int as count FROM analyses'
    );
    const total = Number(countRows[0]?.count || 0);

    const rows = await this.database.query<RawAnalysisSummaryRow>(
      `SELECT id, issue_url, issue_title, repository, status, created_at, updated_at
       FROM analyses
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const items: AnalysisHistoryItem[] = rows.map((row) => ({
      id: row.id,
      issueUrl: row.issue_url,
      issueTitle: row.issue_title,
      repository: row.repository,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    }));

    return {
      items,
      total,
      limit,
      offset,
    };
  }

  private mapToPersistedAnalysis(row: RawAnalysisRow): PersistedAnalysis {
    let result = row.analysis_result;
    if (typeof result === 'string') {
      try {
        result = JSON.parse(result);
      } catch {
        // Fallback if already object
      }
    }

    // Ensure database ID is attached to analysisResult
    if (result && typeof result === 'object') {
      result.id = row.id;
    }

    let patchResult: PatchGenerationResponse | undefined;
    if (row.patch_result) {
      if (typeof row.patch_result === 'string') {
        try {
          patchResult = JSON.parse(row.patch_result);
        } catch {
          patchResult = undefined;
        }
      } else {
        patchResult = row.patch_result as PatchGenerationResponse;
      }
    }

    return {
      id: row.id,
      issueUrl: row.issue_url,
      issueTitle: row.issue_title,
      repository: row.repository,
      analysisResult: result,
      patchResult,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }
}

export const analysisStorageService = new AnalysisStorageService();
