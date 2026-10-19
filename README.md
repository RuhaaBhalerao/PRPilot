# PRPilot — Phase 1: Project Foundation

PRPilot is an AI open-source contribution agent designed to help developers investigate public GitHub issues, formulate minimal code fixes, synthesize regression test suites, and verify changes in a sandboxed execution environment.

This repository represents **Phase 1: Project Foundation**. In this phase, we establish the monorepo architecture, shared API contracts, Express backend, responsive developer dashboard, and validation pipelines.

---

## Architecture Overview

PRPilot is structured as a **pnpm workspaces monorepo**:

```text
prpilot/
├── apps/
│   ├── api/                 # Express backend (TypeScript, Zod, Supertest)
│   │   ├── src/
│   │   │   ├── config/      # Validated environment configuration (env.ts)
│   │   │   ├── controllers/ # Route handlers (health.controller.ts)
│   │   │   ├── middleware/  # Centralized logger, 404, and error handling
│   │   │   ├── routes/      # Canonical /api/v1/health & /api/health routes
│   │   │   ├── app.ts       # Express app setup (isolated for testing)
│   │   │   └── server.ts    # Safe server boot & graceful shutdown
│   │   └── tests/           # Supertest API integration tests
│   └── web/                 # React frontend (Vite, TypeScript, Tailwind CSS)
│       ├── src/
│       │   ├── components/  # AppLayout, responsive sidebar & status pill
│       │   ├── hooks/       # useApiHealth (TanStack Query)
│       │   ├── lib/         # API client & clsx/tailwind utilities
│       │   └── pages/       # Dashboard, History (Phase 2), Settings (Phase 2)
│       └── vite.config.ts
├── packages/
│   └── shared/              # Shared TypeScript contracts and Zod schemas
│       ├── src/
│       │   ├── schemas/     # healthResponseSchema, analyzeIssueRequestSchema
│       │   └── types/       # Shared TypeScript types
│       └── tests/           # Vitest schema validation tests
├── .env.example             # Documented environment variables template
├── eslint.config.mjs        # Unified ESLint 9 configuration
├── pnpm-workspace.yaml      # Monorepo package glob definitions
├── tsconfig.base.json       # Base strict TypeScript configuration
└── vitest.config.ts         # Unified Vitest test runner configuration
```

---

## Engineering Decisions & Mentorship Notes

### 1. Why a Monorepo with Shared Types?

In full-stack TypeScript, frontend and backend often duplicate models (e.g. what an API endpoint returns or how a URL is validated).
By creating `packages/shared`, both `apps/web` and `apps/api` import the exact same Zod schemas (`healthResponseSchema`, `analyzeIssueRequestSchema`) and TypeScript types (`HealthResponse`, `AnalyzeIssueRequest`).

- **Single Source of Truth**: Updating an API contract automatically typechecks across both client and server.
- **Client + Server Validation**: The same Zod schema validates user input in the browser before sending a request and validates request payloads on the server.

### 2. Separation of `app.ts` vs `server.ts`

In Express applications, beginners often combine `express()` and `app.listen()` in a single file.
In production codebases, we separate them:

- `app.ts` defines routes, middleware, and handlers without binding to a network port. This allows **Supertest** to execute integration tests in-memory at high speed without port collision issues.
- `server.ts` imports `app`, reads validated environment variables, binds the TCP port, and registers graceful process shutdown handlers (`SIGTERM`, `SIGINT`).

### 3. Centralized Error Handling and Predictable 404s

- Express's default HTML 404 page is problematic for REST APIs. PRPilot registers a final `notFoundHandler` returning a standard JSON payload:
  `{ "error": "Not Found", "message": "Cannot GET /path" }`.
- Centralized `errorHandler` catches Zod errors (returning `400 Bad Request` with structured field errors) and unexpected exceptions, masking stack traces in production to prevent information disclosure.

### 4. Real-Time Status via TanStack Query

The frontend uses TanStack Query (`useApiHealth`) with periodic background polling. It displays real-time backend connectivity in the sidebar with live pulsing indicators and manual re-check capabilities.

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

Compile the shared TypeScript package so both `apps/api` and `apps/web` can resolve it:

```powershell
pnpm --filter @prpilot/shared build
```

### 3. Environment Variables

Templates are provided in `.env.example`:

- Root `.env.example` documents all backend and frontend configurations.
- `apps/api/.env` is configured with default local ports:
  ```env
  PORT=3001
  WEB_ORIGIN=http://localhost:5173
  NODE_ENV=development
  ```
- `apps/web/.env` is configured with:
  ```env
  VITE_API_BASE_URL=http://localhost:3001
  ```

---

## Running the Application

### Option A: Run Both Frontend & Backend Concurrently

From the root directory:

```powershell
pnpm dev
```

This launches:

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

## Available Workspace Scripts

From the repository root:

| Command             | Description                                                         |
| :------------------ | :------------------------------------------------------------------ |
| `pnpm dev`          | Starts both backend API and frontend Vite server concurrently       |
| `pnpm dev:api`      | Starts only the Express API in watch mode (`tsx watch`)             |
| `pnpm dev:web`      | Starts only the Vite frontend dev server                            |
| `pnpm build`        | Builds shared package, API, and frontend production bundles         |
| `pnpm test`         | Runs all Vitest test suites (shared schemas, API endpoints, 404s)   |
| `pnpm typecheck`    | Executes TypeScript typechecking across all workspaces without emit |
| `pnpm lint`         | Runs ESLint 9 checks across the codebase                            |
| `pnpm format`       | Formats all files with Prettier                                     |
| `pnpm format:check` | Verifies code formatting with Prettier                              |

---

## Roadmap

- [x] **Phase 1: Project Foundation**
  - Monorepo structure with pnpm workspaces
  - Shared contracts and Zod validation package
  - Express API with health endpoints, JSON 404, and error handling
  - React/Vite dashboard with responsive sidebar, navigation, and API health status
  - Comprehensive unit and integration test coverage
- [ ] **Phase 2: Repository Ingestion & GitHub Integration**
  - GitHub Octokit integration & issue parsing
  - Repository cloning & AST-based codebase indexing
- [ ] **Phase 3: AI Patch & Regression Test Generation**
  - Google Gemini 1.5 Pro code triage
  - Minimal diff formulation & test assertion generation
- [ ] **Phase 4: Sandboxed Verification & PR Automation**
  - Docker container test execution
  - Automated pull request drafting and verification badges
