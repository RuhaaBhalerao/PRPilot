# PRPilot — Autonomous Open-Source Contribution Engine

PRPilot is an AI open-source contribution agent designed to help developers investigate public GitHub issues, formulate minimal code fixes, synthesize regression test suites, and verify changes in a sandboxed execution environment.

This repository implements **Phase 1: Project Foundation** and **Phase 2: GitHub Issue Integration**.

---

## What Phase 2 Adds

Phase 2 delivers the first true end-to-end integration with GitHub's REST API:

1. **Strict Canonical URL Validation & Security**:
   - Accepts only canonical issue URLs: `https://github.com/{owner}/{repository}/issues/{issueNumber}`.
   - Enforces HTTPS and strictly matches the `github.com` hostname using strict URL parsing (`new URL`), rejecting lookalikes, unexpected ports, query strings, and credentials.
   - Proactively rejects pull request URLs (`/pull/`) and discussions with clear guidance.
   - Validates all input client-side and server-side using the shared Zod package.
2. **Backend GitHub Service (`@octokit/rest`)**:
   - Reusable `GithubService` fetching actual issue and repository metadata without scraping.
   - Handles pull request detection (GitHub's issues API returns pull requests with `pull_request` metadata; mapped to HTTP 422 Unprocessable Entity).
   - Gracefully handles rate limits (HTTP 429), not-found repositories/issues (HTTP 404), upstream timeouts (HTTP 504), and upstream network/server failures (HTTP 502).
   - Normalizes raw API responses into a clean application-level data contract with explicit nulls for optional fields.
3. **Interactive Frontend Dashboard**:
   - Connected to backend API `POST /api/v1/github/issues/lookup` using TanStack Query.
   - Form features inline validation, quick example loading, loading spinner, and duplicate submission prevention.
   - Rich results view:
     - **Issue Card**: state badge (open/closed), title, number, author, creation/update dates, label tags, and safely rendered description (untrusted text rendered safely without executing HTML/scripts).
     - **Repository Card**: full name, description, stars, default branch, primary language, open issue count, and archived badge.
     - **Analysis Readiness Panel**: clearly displays pipeline progress and guides the user toward Phase 3.
   - Human-readable API error messages with an inline **Retry** action for transient network failures.
4. **Comprehensive Automated Test Suite**:
   - 44 tests across 6 test suites covering schemas, controllers, error handlers, mock Octokit edge cases, and React testing-library component interactions.

---

## Architecture & Request Flow

```text
┌────────────────┐          POST /api/v1/github/issues/lookup          ┌────────────────┐
│                │ ───────────────────────────────────────────────────► │                │
│  React/Vite    │                     { issueUrl }                     │  Express API   │
│  Dashboard     │                                                      │  (apps/api)    │
│  (apps/web)    │ ◄─────────────────────────────────────────────────── │                │
└────────────────┘         200 OK: { issue, repository }                └───────┬────────┘
                                                                                │
                                              octokit.rest.issues.get()         │  @octokit/rest
                                              octokit.rest.repos.get()          ▼
                                                                        ┌────────────────┐
                                                                        │  GitHub REST   │
                                                                        │  API (v3)      │
                                                                        └────────────────┘
```

1. **User Input**: Developer enters a public GitHub issue URL.
2. **Client Validation**: Shared Zod schema performs fast preliminary validation.
3. **Backend Validation**: Express route validates payload structure and URL safety constraints.
4. **Upstream Request**: `GithubService` queries GitHub's REST API for issue and repository metadata.
5. **Detection & Normalization**: Checks for PR indicator, normalizes attributes, and strips internal properties.
6. **Presentation**: Dashboard displays normalized issue details, repository stats, and analysis readiness.

---

## API Contract: `POST /api/v1/github/issues/lookup`

### Request Body

```json
{
  "issueUrl": "https://github.com/facebook/react/issues/28000"
}
```

### Success Response (`200 OK`)

```json
{
  "issue": {
    "number": 28000,
    "title": "Fix transition race condition in fiber",
    "body": "Detailed issue description...",
    "state": "open",
    "htmlUrl": "https://github.com/facebook/react/issues/28000",
    "authorLogin": "acdlite",
    "labels": [
      {
        "id": 101,
        "name": "React Core",
        "color": "61dafb",
        "description": "Issues related to React core algorithms"
      }
    ],
    "createdAt": "2024-02-15T10:00:00Z",
    "updatedAt": "2024-02-16T12:00:00Z",
    "closedAt": null,
    "isPullRequest": false
  },
  "repository": {
    "ownerLogin": "facebook",
    "name": "react",
    "fullName": "facebook/react",
    "description": "The library for web and native user interfaces.",
    "htmlUrl": "https://github.com/facebook/react",
    "defaultBranch": "main",
    "primaryLanguage": "JavaScript",
    "stars": 225000,
    "openIssueCount": 1200,
    "isArchived": false
  }
}
```

### Error Responses

| HTTP Status | Error Type              | Description                                              |
| :---------- | :---------------------- | :------------------------------------------------------- |
| `400`       | `Validation Error`      | Invalid URL structure, malformed JSON, or non-HTTPS URL  |
| `404`       | `Not Found`             | Issue or repository not found (or repository is private) |
| `422`       | `Unprocessable Entity`  | Target URL refers to a pull request rather than an issue |
| `429`       | `Rate Limit Exceeded`   | GitHub API rate limit reached                            |
| `502`       | `Bad Gateway`           | Network failure or upstream GitHub server error          |
| `504`       | `Gateway Timeout`       | Request to GitHub API timed out (bounded 10s timeout)    |
| `500`       | `Internal Server Error` | Unexpected server failure                                |

Error responses follow a consistent schema:

```json
{
  "error": "Not Found",
  "message": "GitHub issue or repository 'owner/repo#123' not found. Verify that the repository is public and the issue exists."
}
```

---

## Monorepo Structure

```text
prpilot/
├── apps/
│   ├── api/                 # Express backend (TypeScript, Zod, Octokit, Supertest)
│   │   ├── src/
│   │   │   ├── config/      # Validated environment configuration (env.ts)
│   │   │   ├── controllers/ # Issue lookup & health controllers
│   │   │   ├── errors/      # Structured HTTP error classes (httpError.ts)
│   │   │   ├── middleware/  # Centralized logger, 404, and error handling
│   │   │   ├── routes/      # /api/v1/github and /api/v1/health routes
│   │   │   ├── services/    # Octokit-based GithubService
│   │   │   ├── app.ts       # Express app setup (isolated for testing)
│   │   │   └── server.ts    # Safe server boot & graceful shutdown
│   │   └── tests/           # Integration tests (mocked GitHub API & validation)
│   └── web/                 # React frontend (Vite, TypeScript, Tailwind CSS, TanStack Query)
│       ├── src/
│       │   ├── components/  # IssueSummaryCard, RepositorySummaryCard, AppLayout
│       │   ├── hooks/       # useGithubIssueLookup, useApiHealth
│       │   ├── lib/         # API client & utilities
│       │   └── pages/       # DashboardPage, HistoryPage, SettingsPage
│       └── tests/           # React Testing Library frontend tests
├── packages/
│   └── shared/              # Shared TypeScript contracts and Zod schemas
│       ├── src/
│       │   ├── schemas/     # issueLookupRequestSchema, issueLookupResponseSchema, health
│       │   └── types/       # Shared TypeScript types
│       └── tests/           # Vitest schema validation tests
├── .env.example             # Documented environment variables template
├── eslint.config.mjs        # Unified ESLint 9 configuration
├── pnpm-workspace.yaml      # Monorepo package glob definitions
├── tsconfig.base.json       # Base strict TypeScript configuration
└── vitest.config.ts         # Unified Vitest test runner configuration
```

---

## Prerequisites

- **Node.js**: v18.0.0 or later (Tested on Node v24.15.0)
- **pnpm**: v9.0.0 or later (Tested on pnpm v11.16.0)
- **PowerShell / Bash / Zsh**

---

## Getting Started

### 1. Install Dependencies

From the repository root:

```powershell
pnpm install
```

### 2. Build the Shared Package

Compile the shared TypeScript contracts:

```powershell
pnpm --filter @prpilot/shared build
```

### 3. Environment Configuration

Copy `.env.example` to `apps/api/.env` and `apps/web/.env`:

- **`apps/api/.env`**:
  ```env
  PORT=3001
  WEB_ORIGIN=http://localhost:5173
  NODE_ENV=development
  # Optional: increases unauthenticated rate limit from 60 req/hr to 5,000 req/hr
  # GITHUB_TOKEN=your_personal_access_token_here
  ```
- **`apps/web/.env`**:
  ```env
  VITE_API_BASE_URL=http://localhost:3001
  ```

---

## Running the Application

### Option A: Run Full Stack Concurrently

```powershell
pnpm dev
```

Launches:

- **Backend API**: `http://localhost:3001` (Health: `http://localhost:3001/api/v1/health`)
- **Frontend Web Dashboard**: `http://localhost:5173`

### Option B: Run Services Individually

**Backend API only:**

```powershell
pnpm dev:api
```

**Frontend Web only:**

```powershell
pnpm dev:web
```

---

## Testing & Quality Checks

Run all checks from the root directory:

```powershell
# Run the complete automated test suite (shared schemas, API endpoints, React frontend)
pnpm test

# Run TypeScript typechecks across all monorepo packages
pnpm typecheck

# Run ESLint 9 code analysis
pnpm lint

# Verify code style and formatting
pnpm format:check

# Format all files with Prettier
pnpm format

# Build all production bundles
pnpm build
```

---

## Current Limitations

- **Public Repositories Only**: Exclusively supports public GitHub repositories. Private repositories and enterprise GitHub instances are not supported.
- **Unauthenticated Rate Limits**: When running without an optional `GITHUB_TOKEN`, GitHub limits requests to 60 per hour per IP. Setting `GITHUB_TOKEN` in `apps/api/.env` increases this limit to 5,000 per hour.
- **Pull Requests Excluded**: PRPilot specifically analyzes GitHub issues; pull request URLs are intentionally rejected with HTTP 422.
- **Triage Stage Limitation**: At the current triage analysis stage, repository source files are not cloned. File locations and root causes are analytical hypotheses based on issue description, stack traces, and repository metadata.

---

## Roadmap

- [x] **Phase 1: Project Foundation**
  - Monorepo structure with pnpm workspaces
  - Shared contracts and Zod validation package
  - Express API with health endpoints, JSON 404, and error handling
  - React/Vite dashboard with responsive sidebar, navigation, and API health status
- [x] **Phase 2: GitHub Issue Integration**
  - Canonical issue URL parsing & security hardening
  - Backend GitHub service using `@octokit/rest`
  - Normalized issue and repository data contracts
  - Dashboard integration with real-time metadata display and error retry handling
  - Automated tests with deterministic GitHub API mocks
- [x] **Phase 3: AI-Powered Issue Triage Analysis**
  - Structured 7-section triage report with clear evidence vs hypotheses distinction
  - Provider integration with Google AI Studio (Gemini) / OpenAI-compatible endpoint
  - Candidate files, fix steps, and regression test plan generation
  - Closed issue advisory warnings and repository context limitation notices
- [x] **Phase 4: Persistent Analysis History (Neon PostgreSQL)**
  - Reusable PostgreSQL connection module with `@neondatabase/serverless`
  - Automated schema migration for `analyses` table and optimized indexes
  - Idempotent analysis persistence with accidental duplicate submission protection
  - `GET /api/v1/analyses` (paginated history) and `GET /api/v1/analyses/:id`
  - Frontend Analysis History page with status badges, reopen action, and URL-driven state
- [x] **Phase 5: Repository Intelligence & Evidence-Grounded Analysis**
  - Git recursive tree inspection and semantic file relevance ranking
  - Domain-specific heuristics with DevTools, compiler fixtures, and generated files filtering
  - Generic UI keyword false-positive prevention (`button`, `code`, `icon`, etc.)
  - Cross-repository detection and external repository advisories (e.g., `react.dev` vs `facebook/react`)
  - Configurable minimum relevance threshold enforcement with explicit insufficient-evidence reporting
  - Direct grounded evidence vs. indirect reference pattern distinction in API and UI
  - Closed issue maintainer discussion analysis and intentional challenge awareness
- [ ] **Phase 6: Patch Synthesis & Pull Request Drafting**
  - Minimal unified diff formulation & patch execution
  - Sandboxed test verification and pull request drafting
