import {
  healthResponseSchema,
  issueLookupResponseSchema,
  analyzeIssueResponseSchema,
  analysisHistoryListResponseSchema,
  persistedAnalysisSchema,
  type HealthResponse,
  type IssueLookupResponse,
  type AnalyzeIssueResponse,
  type AnalysisHistoryListResponse,
  type PersistedAnalysis,
} from '@prpilot/shared';

// API base URL configured via environment variables with fallback
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Calls the PRPilot backend health endpoint and validates the response schema.
 */
export async function fetchApiHealth(): Promise<HealthResponse> {
  const url = `${API_BASE_URL}/api/v1/health`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      throw new ApiError(`Health check failed with status ${res.status}`, res.status);
    }

    const json = await res.json();
    const parsed = healthResponseSchema.safeParse(json);

    if (!parsed.success) {
      throw new ApiError(
        'Health check response failed schema validation',
        res.status,
        parsed.error
      );
    }

    return parsed.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      `Failed to connect to PRPilot API at ${API_BASE_URL}. Ensure the backend is running.`,
      undefined,
      error
    );
  }
}

/**
 * Calls the PRPilot backend GitHub issue lookup endpoint and validates response schema.
 */
export async function lookupGithubIssue(issueUrl: string): Promise<IssueLookupResponse> {
  const url = `${API_BASE_URL}/api/v1/github/issues/lookup`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ issueUrl }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message =
        json && typeof json.message === 'string'
          ? json.message
          : `GitHub lookup failed with HTTP ${res.status}`;
      throw new ApiError(message, res.status, json.details ?? json);
    }

    const parsed = issueLookupResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new ApiError(
        'GitHub issue lookup response failed schema validation',
        res.status,
        parsed.error
      );
    }

    return parsed.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      `Unable to connect to PRPilot API at ${API_BASE_URL}. Verify the backend service is running.`,
      undefined,
      error
    );
  }
}

/**
 * Calls the PRPilot backend AI-powered issue analysis endpoint and validates response schema.
 */
export async function analyzeGithubIssue(issueUrl: string): Promise<AnalyzeIssueResponse> {
  const url = `${API_BASE_URL}/api/v1/analyze`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ issueUrl }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message =
        json && typeof json.message === 'string'
          ? json.message
          : `Analysis failed with HTTP ${res.status}`;
      throw new ApiError(message, res.status, json.details ?? json);
    }

    const parsed = analyzeIssueResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new ApiError(
        'AI issue analysis response failed schema validation',
        res.status,
        parsed.error
      );
    }

    return parsed.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      `Unable to connect to PRPilot API at ${API_BASE_URL}. Verify the backend service is running.`,
      undefined,
      error
    );
  }
}

/**
 * Fetches recent analysis history from the backend.
 */
export async function fetchAnalysesHistory(
  limit: number = 20,
  offset: number = 0
): Promise<AnalysisHistoryListResponse> {
  const url = `${API_BASE_URL}/api/v1/analyses?limit=${limit}&offset=${offset}`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message =
        json && typeof json.message === 'string'
          ? json.message
          : `Failed to fetch history (HTTP ${res.status})`;
      throw new ApiError(message, res.status);
    }

    const parsed = analysisHistoryListResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new ApiError(
        'Analysis history response failed schema validation',
        res.status,
        parsed.error
      );
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      `Unable to connect to PRPilot API at ${API_BASE_URL}. Verify backend service is running.`,
      undefined,
      error
    );
  }
}

/**
 * Fetches a single persisted analysis record by ID.
 */
export async function fetchAnalysisById(id: string): Promise<PersistedAnalysis> {
  const url = `${API_BASE_URL}/api/v1/analyses/${encodeURIComponent(id)}`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message =
        json && typeof json.message === 'string'
          ? json.message
          : `Analysis record '${id}' not found`;
      throw new ApiError(message, res.status);
    }

    const parsed = persistedAnalysisSchema.safeParse(json);
    if (!parsed.success) {
      throw new ApiError('Analysis record failed schema validation', res.status, parsed.error);
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      `Unable to connect to PRPilot API at ${API_BASE_URL}. Verify backend service is running.`,
      undefined,
      error
    );
  }
}
