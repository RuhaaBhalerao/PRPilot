import type { GithubIssue, GithubRepository, IssueAnalysis } from '@prpilot/shared';
import { issueAnalysisSectionSchema } from '@prpilot/shared';
import { env } from '../config/env.js';
import {
  BadGatewayError,
  GatewayTimeoutError,
  RateLimitExceededError,
} from '../errors/httpError.js';

export interface AiServiceOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export class AiAnalysisService {
  private readonly apiKey?: string;
  readonly model: string;
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly isConfigured: boolean;
  private readonly fetchFn: typeof fetch;

  constructor(options: AiServiceOptions = {}) {
    const rawKey =
      options.apiKey !== undefined ? options.apiKey : (env.OPEN_AI_API_KEY ?? env.OPENAI_API_KEY);

    const cleanKey =
      typeof rawKey === 'string' && rawKey.trim().length > 0 ? rawKey.trim() : undefined;

    this.apiKey = cleanKey;
    this.isConfigured = Boolean(cleanKey);

    const defaultModel = options.model ?? env.OPEN_AI_MODEL ?? env.OPENAI_MODEL ?? 'gpt-6.1-sol';
    this.model = defaultModel;

    // Default base URL: OpenRouter if key has sk-or-v1- prefix, otherwise OpenAI
    const defaultBaseUrl = cleanKey?.startsWith('sk-or-v1-')
      ? 'https://openrouter.ai/api/v1'
      : 'https://api.openai.com/v1';

    this.baseUrl = options.baseUrl ?? env.OPEN_AI_BASE_URL ?? env.OPENAI_BASE_URL ?? defaultBaseUrl;

    this.timeoutMs = options.timeoutMs ?? 30000;
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
  }

  /**
   * Generates a structured 7-section triage analysis of a public GitHub issue.
   */
  async analyzeIssue(issue: GithubIssue, repository: GithubRepository): Promise<IssueAnalysis> {
    if (!this.isConfigured || !this.apiKey) {
      throw new BadGatewayError(
        'AI service is not configured. Please configure OPEN_AI_API_KEY in apps/api/.env.'
      );
    }

    const systemPrompt = `You are PRPilot AI, an expert software engineering agent specializing in triaging public GitHub issues for open-source repositories.
Analyze the provided GitHub issue and repository context. You must generate a strict JSON response containing the exact fields specified below.

REQUIRED JSON FIELDS:
1. "problemSummary" (string): Concise, accurate summary of the reported bug, unexpected behavior, or requested feature.
2. "expectedBehaviour" (string): Explicit contrast of what should happen vs what actually happens.
3. "rootCauseHypotheses" (array of strings): Candidate root-cause hypotheses explaining why the problem occurs. These must be phrased as hypotheses, not established facts.
4. "evidenceAndMissingInformation" (object):
   - "verifiedFacts" (array of strings): Statements of fact directly stated in the issue report, stack traces, version numbers, reproduction steps, or confirmed GitHub metadata.
   - "hypotheses" (array of strings): Inferences, deductions, or assumptions drawn from the facts.
   - "missingInformation" (array of strings): Information needed to definitively isolate or reproduce the problem that is absent from the report (e.g. minimal reproduction repo, logs, browser version, environment).
5. "filesOrComponentsToInvestigate" (array of objects with "name" and "reason"):
   - "name": File path, directory, or architectural component likely relevant to the issue.
   - "reason": Why this component or file should be inspected.
   - Note: Clearly frame these as candidate hypotheses based on component naming or stack traces, because repository source files have NOT been retrieved or cloned at this triage stage.
6. "proposedFixSteps" (array of strings): Step-by-step guidance for a contributor to reproduce, isolate, fix, and verify the issue in the codebase.
7. "regressionTestPlan" (array of strings): Specific automated test cases (unit, integration, or edge cases) to implement to verify the fix and prevent regressions.

CRITICAL CONSTRAINTS:
- You MUST return ONLY valid JSON matching the schema with no surrounding prose or commentary outside the JSON object.
- Clearly distinguish verified facts from hypotheses throughout all sections.
- Do NOT claim to have inspected, cloned, or parsed the repository files, because code was NOT retrieved at this triage stage.
- If the issue is marked as closed (${issue.state === 'closed'}), explicitly note that closed issues may have already been resolved, duplicate, or rejected, and caution that it may not be an active candidate for contribution.`;

    const userPrompt = `REPOSITORY: ${repository.fullName}
Primary Language: ${repository.primaryLanguage || 'Not specified'}
Repository Description: ${repository.description || 'None'}
Stars: ${repository.stars} | Open Issues: ${repository.openIssueCount}

ISSUE #${issue.number}: ${issue.title}
State: ${issue.state} ${issue.state === 'closed' ? '(CLOSED ON GITHUB)' : '(OPEN)'}
Author: ${issue.authorLogin || 'Unknown'}
Created: ${issue.createdAt} | Updated: ${issue.updatedAt}
Labels: ${issue.labels.map((l) => l.name).join(', ') || 'None'}

ISSUE DESCRIPTION:
${issue.body || 'No description provided by the issue author.'}`;

    let response: Response;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      response = await this.fetchFn(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://prpilot.dev',
          'X-Title': 'PRPilot Issue Triage',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 2500,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      const error = err as { name?: string; message?: string };
      if (error.name === 'AbortError' || (error.message && error.message.includes('aborted'))) {
        throw new GatewayTimeoutError('Upstream AI provider request timed out.');
      }
      throw new BadGatewayError('Failed to connect to upstream AI provider.');
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      await this.handleProviderHttpError(response);
    }

    let payload: { choices?: Array<{ message?: { content?: string } }> };
    try {
      payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    } catch {
      throw new BadGatewayError('Malformed JSON payload received from AI provider.');
    }

    const rawContent = payload.choices?.[0]?.message?.content;
    if (!rawContent || typeof rawContent !== 'string') {
      throw new BadGatewayError('AI provider returned an empty or missing completion message.');
    }

    // Strip markdown fences if present
    const cleanedJson = rawContent
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(cleanedJson);
    } catch {
      throw new BadGatewayError('AI provider completion could not be parsed as valid JSON.');
    }

    // Attach honest repository limitation and closed issue metadata
    const enriched = {
      ...(typeof parsedJson === 'object' && parsedJson !== null ? parsedJson : {}),
      repositoryContextAvailable: false,
      repositoryContextLimitation:
        'Repository source files were not retrieved at this triage stage; file suggestions and root causes are hypotheses based on the issue description, stack traces, and metadata.',
      isClosedIssue: issue.state === 'closed',
      closedIssueNotice:
        issue.state === 'closed'
          ? 'Notice: This issue is closed on GitHub. Closed issues may have already been resolved, deemed obsolete, or rejected by maintainers. Review previous pull requests and discussion before attempting to contribute.'
          : null,
    };

    const validated = issueAnalysisSectionSchema.safeParse(enriched);
    if (!validated.success) {
      throw new BadGatewayError(
        'AI provider analysis output failed schema validation.',
        validated.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
      );
    }

    return validated.data;
  }

  private async handleProviderHttpError(response: Response): Promise<never> {
    const status = response.status;
    let providerErrorMsg = '';

    try {
      const errJson = (await response.json()) as {
        error?: { message?: string } | string;
        message?: string;
      };
      if (typeof errJson.error === 'object' && errJson.error?.message) {
        providerErrorMsg = errJson.error.message;
      } else if (typeof errJson.error === 'string') {
        providerErrorMsg = errJson.error;
      } else if (typeof errJson.message === 'string') {
        providerErrorMsg = errJson.message;
      }
    } catch {
      // Ignore body read errors
    }

    if (status === 401) {
      throw new BadGatewayError('AI provider authentication failed. Verify your OPEN_AI_API_KEY.');
    }

    if (status === 402) {
      throw new BadGatewayError(
        `AI provider account credit limit reached${providerErrorMsg ? `: ${providerErrorMsg}` : '.'}`
      );
    }

    if (status === 429) {
      throw new RateLimitExceededError(
        `AI provider rate limit reached${providerErrorMsg ? `: ${providerErrorMsg}` : '.'} Please wait before retrying.`
      );
    }

    if (status >= 500) {
      throw new BadGatewayError(
        `Upstream AI provider encountered an internal error (HTTP ${status}).`
      );
    }

    throw new BadGatewayError(
      `AI provider returned HTTP ${status}${providerErrorMsg ? `: ${providerErrorMsg}` : '.'}`
    );
  }
}

export const aiAnalysisService = new AiAnalysisService();
