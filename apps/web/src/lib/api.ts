import { healthResponseSchema, type HealthResponse } from '@prpilot/shared';

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
