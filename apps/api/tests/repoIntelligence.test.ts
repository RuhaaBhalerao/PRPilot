import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GithubService } from '../src/services/github.service.js';
import { AiAnalysisService } from '../src/services/ai.service.js';
import type { GithubIssue, GithubRepository, RepositoryEvidence } from '@prpilot/shared';

describe('Repository Intelligence & Evidence-Grounded Analysis (Phase 5)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockIssue: GithubIssue = {
    number: 28000,
    title: 'Bug: race condition in FiberScheduler work loop',
    body: 'Stack trace points to packages/react-reconciler/src/ReactFiberWorkLoop.js line 452. Scheduler drops lanes under concurrent mode.',
    state: 'open',
    htmlUrl: 'https://github.com/facebook/react/issues/28000',
    authorLogin: 'testuser',
    labels: [{ name: 'React Core' }],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    closedAt: null,
    isPullRequest: false,
  };

  const mockRepo: GithubRepository = {
    ownerLogin: 'facebook',
    name: 'react',
    fullName: 'facebook/react',
    description: 'React core library',
    htmlUrl: 'https://github.com/facebook/react',
    defaultBranch: 'main',
    primaryLanguage: 'JavaScript',
    stars: 220000,
    openIssueCount: 800,
    isArchived: false,
  };

  describe('GithubService.getRepoTree', () => {
    it('retrieves recursive Git tree and returns blob items', async () => {
      const mockOctokit = {
        rest: {
          git: {
            getTree: vi.fn().mockResolvedValue({
              data: {
                sha: 'tree123',
                truncated: false,
                tree: [
                  { path: 'src/index.js', type: 'blob', size: 1024 },
                  { path: 'src/components', type: 'tree' },
                  { path: 'packages/core/app.ts', type: 'blob', size: 2048 },
                ],
              },
            }),
          },
        },
      } as unknown;

      const service = new GithubService({ octokit: mockOctokit as never });
      const result = await service.getRepoTree('facebook', 'react', 'main');

      expect(result.truncated).toBe(false);
      expect(result.tree).toHaveLength(2);
      expect(result.tree[0]).toEqual({ path: 'src/index.js', size: 1024, type: 'blob' });
      expect(result.tree[1]).toEqual({ path: 'packages/core/app.ts', size: 2048, type: 'blob' });
    });

    it('handles truncated trees gracefully and marks truncated: true', async () => {
      const mockOctokit = {
        rest: {
          git: {
            getTree: vi.fn().mockResolvedValue({
              data: {
                sha: 'tree-large',
                truncated: true,
                tree: [{ path: 'src/app.js', type: 'blob', size: 500 }],
              },
            }),
          },
        },
      } as unknown;

      const service = new GithubService({ octokit: mockOctokit as never });
      const result = await service.getRepoTree('facebook', 'react', 'main');

      expect(result.truncated).toBe(true);
      expect(result.tree).toHaveLength(1);
    });

    it('handles empty repositories (HTTP 409) without throwing', async () => {
      const mockOctokit = {
        rest: {
          git: {
            getTree: vi.fn().mockRejectedValue({
              status: 409,
              message: 'Git Repository is empty.',
            }),
          },
        },
      } as unknown;

      const service = new GithubService({ octokit: mockOctokit as never });
      const result = await service.getRepoTree('facebook', 'empty-repo', 'main');

      expect(result.tree).toEqual([]);
      expect(result.truncated).toBe(false);
    });
  });

  describe('GithubService.fetchFileContent', () => {
    it('fetches and decodes base64 file content', async () => {
      const codeSnippet = 'export function scheduleCallback() { return true; }';
      const encoded = Buffer.from(codeSnippet).toString('base64');

      const mockOctokit = {
        rest: {
          repos: {
            getContent: vi.fn().mockResolvedValue({
              data: {
                type: 'file',
                size: codeSnippet.length,
                content: encoded,
                encoding: 'base64',
                html_url:
                  'https://github.com/facebook/react/blob/main/packages/scheduler/Scheduler.js',
              },
            }),
          },
        },
      } as unknown;

      const service = new GithubService({ octokit: mockOctokit as never });
      const result = await service.fetchFileContent(
        'facebook',
        'react',
        'packages/scheduler/Scheduler.js',
        'main'
      );

      expect(result).not.toBeNull();
      expect(result?.content).toBe(codeSnippet);
      expect(result?.size).toBe(codeSnippet.length);
      expect(result?.htmlUrl).toContain('github.com');
    });

    it('rejects binary files containing null bytes', async () => {
      const binaryData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0a]).toString('base64');

      const mockOctokit = {
        rest: {
          repos: {
            getContent: vi.fn().mockResolvedValue({
              data: {
                type: 'file',
                size: 6,
                content: binaryData,
                encoding: 'base64',
                html_url: 'https://github.com/facebook/react/blob/main/logo.png',
              },
            }),
          },
        },
      } as unknown;

      const service = new GithubService({ octokit: mockOctokit as never });
      const result = await service.fetchFileContent('facebook', 'react', 'logo.png', 'main');

      expect(result).toBeNull();
    });

    it('returns null on 404 or network failure without throwing', async () => {
      const mockOctokit = {
        rest: {
          repos: {
            getContent: vi.fn().mockRejectedValue({
              status: 404,
              message: 'Not Found',
            }),
          },
        },
      } as unknown;

      const service = new GithubService({ octokit: mockOctokit as never });
      const result = await service.fetchFileContent('facebook', 'react', 'missing.js', 'main');

      expect(result).toBeNull();
    });
  });

  describe('GithubService.gatherRepositoryEvidence', () => {
    it('gathers completed evidence with ranked files and line-numbered excerpts', async () => {
      const fileCode =
        'import { schedule } from "./scheduler";\nfunction workLoop() {\n  return 42;\n}';
      const encoded = Buffer.from(fileCode).toString('base64');

      const mockOctokit = {
        rest: {
          git: {
            getTree: vi.fn().mockResolvedValue({
              data: {
                truncated: false,
                tree: [
                  {
                    path: 'packages/react-reconciler/src/ReactFiberWorkLoop.js',
                    type: 'blob',
                    size: 2500,
                  },
                  {
                    path: 'packages/scheduler/src/Scheduler.js',
                    type: 'blob',
                    size: 1800,
                  },
                  {
                    path: 'node_modules/react/index.js',
                    type: 'blob',
                    size: 500,
                  },
                ],
              },
            }),
          },
          repos: {
            getContent: vi.fn().mockImplementation(({ path }) =>
              Promise.resolve({
                data: {
                  type: 'file',
                  size: fileCode.length,
                  content: encoded,
                  encoding: 'base64',
                  html_url: `https://github.com/facebook/react/blob/main/${path}`,
                },
              })
            ),
          },
        },
      } as unknown;

      const service = new GithubService({ octokit: mockOctokit as never });
      const evidence = await service.gatherRepositoryEvidence(
        'facebook',
        'react',
        mockIssue,
        mockRepo
      );

      expect(evidence.status).toBe('completed');
      expect(evidence.inspectedFileCount).toBeGreaterThanOrEqual(1);
      expect(evidence.treeTruncated).toBe(false);
      expect(evidence.limitation).toBeNull();

      const topFile = evidence.files[0];
      expect(topFile.path).toBe('packages/react-reconciler/src/ReactFiberWorkLoop.js');
      expect(topFile.relevanceScore).toBeGreaterThan(100);
      expect(topFile.excerpt).toContain('1: import { schedule }');
      expect(topFile.htmlUrl).toContain('ReactFiberWorkLoop.js');
    });

    it('reports partial status when tree is truncated', async () => {
      const fileCode = 'console.log("hello");';
      const encoded = Buffer.from(fileCode).toString('base64');

      const mockOctokit = {
        rest: {
          git: {
            getTree: vi.fn().mockResolvedValue({
              data: {
                truncated: true,
                tree: [
                  {
                    path: 'packages/react-reconciler/src/ReactFiberWorkLoop.js',
                    type: 'blob',
                    size: 1000,
                  },
                ],
              },
            }),
          },
          repos: {
            getContent: vi.fn().mockResolvedValue({
              data: {
                type: 'file',
                size: fileCode.length,
                content: encoded,
                encoding: 'base64',
                html_url:
                  'https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberWorkLoop.js',
              },
            }),
          },
        },
      } as unknown;

      const service = new GithubService({ octokit: mockOctokit as never });
      const evidence = await service.gatherRepositoryEvidence(
        'facebook',
        'react',
        mockIssue,
        mockRepo
      );

      expect(evidence.status).toBe('partial');
      expect(evidence.treeTruncated).toBe(true);
      expect(evidence.limitation).toContain('truncated');
    });

    it('gracefully degrades to unavailable when GitHub tree hits rate limit', async () => {
      const mockOctokit = {
        rest: {
          git: {
            getTree: vi.fn().mockRejectedValue({
              status: 403,
              message: 'API rate limit exceeded',
            }),
          },
        },
      } as unknown;

      const service = new GithubService({ octokit: mockOctokit as never });
      const evidence = await service.gatherRepositoryEvidence(
        'facebook',
        'react',
        mockIssue,
        mockRepo
      );

      expect(evidence.status).toBe('unavailable');
      expect(evidence.inspectedFileCount).toBe(0);
      expect(evidence.limitation).toContain('rate limit');
    });

    it('identifies when an issue belongs in an external repository and returns insufficient_evidence with advisory', async () => {
      const docIssue: GithubIssue = {
        ...mockIssue,
        number: 37933,
        title: 'Bug: Hover highlight in interactive code example overlaps the preview content',
        body: 'On the react.dev documentation homepage, hover highlighting on the interactive video example overlaps preview layout.',
      };

      const mockOctokit = {
        rest: {
          git: {
            getTree: vi.fn(),
          },
        },
      } as unknown;

      const service = new GithubService({ octokit: mockOctokit as never });
      const evidence = await service.gatherRepositoryEvidence(
        'facebook',
        'react',
        docIssue,
        mockRepo
      );

      expect(evidence.status).toBe('insufficient_evidence');
      expect(evidence.inspectedFileCount).toBe(0);
      expect(evidence.externalRepositoryAdvisory).toBeDefined();
      expect(evidence.externalRepositoryAdvisory).toContain('reactjs/react.dev');
      expect(evidence.limitation).toContain('reactjs/react.dev');
      expect(evidence.files).toHaveLength(0);

      // Verify no unnecessary GitHub API calls were made to the core library tree
      expect(mockOctokit.rest.git.getTree).not.toHaveBeenCalled();
    });

    it('returns insufficient_evidence when candidate files score below the minimum relevance threshold', async () => {
      const mockOctokit = {
        rest: {
          git: {
            getTree: vi.fn().mockResolvedValue({
              data: {
                truncated: false,
                tree: [
                  {
                    path: 'packages/unrelated-core/src/InternalEngine.js',
                    size: 1000,
                    type: 'blob',
                  },
                  { path: 'scripts/jest/config.js', size: 800, type: 'blob' },
                ],
              },
            }),
          },
        },
      } as unknown;

      const vagueIssue: GithubIssue = {
        ...mockIssue,
        title: 'Unexpected glitch happens',
        body: 'Something seems off.',
      };

      const service = new GithubService({ octokit: mockOctokit as never });
      const evidence = await service.gatherRepositoryEvidence(
        'facebook',
        'react',
        vagueIssue,
        mockRepo
      );

      expect(evidence.status).toBe('insufficient_evidence');
      expect(evidence.inspectedFileCount).toBe(0);
      expect(evidence.limitation).toContain('relevance threshold');
      expect(evidence.files).toHaveLength(0);
    });

    it('discards generated files and returns insufficient_evidence when all fetched files are generated', async () => {
      const generatedCode = `// This is a generated file. The source files are in react-dom-bindings/src/server/fizz-instruction-set.
export const markShellTime = 'requestAnimationFrame(function(){});';`;
      const encoded = Buffer.from(generatedCode).toString('base64');

      const mockOctokit = {
        rest: {
          git: {
            getTree: vi.fn().mockResolvedValue({
              data: {
                truncated: false,
                tree: [
                  {
                    path: 'packages/react-reconciler/src/ReactFiberWorkLoop.js',
                    size: 1500,
                    type: 'blob',
                  },
                ],
              },
            }),
          },
          repos: {
            getContent: vi.fn().mockResolvedValue({
              data: {
                type: 'file',
                size: generatedCode.length,
                content: encoded,
                encoding: 'base64',
                html_url:
                  'https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberWorkLoop.js',
              },
            }),
          },
        },
      } as unknown;

      const service = new GithubService({ octokit: mockOctokit as never });
      const evidence = await service.gatherRepositoryEvidence(
        'facebook',
        'react',
        mockIssue,
        mockRepo
      );

      // Since the file returned generated code header, it was discarded
      expect(evidence.status).toBe('insufficient_evidence');
      expect(evidence.inspectedFileCount).toBe(0);
      expect(evidence.limitation).toContain('generated');
      expect(evidence.files).toHaveLength(0);
    });
  });

  describe('AiAnalysisService Evidence Grounding and Untrusted Input Security', () => {
    it('embeds retrieved source files and excerpts into user prompt and prevents hallucinated grounded claims', async () => {
      const mockEvidence: RepositoryEvidence = {
        status: 'completed',
        inspectedFileCount: 1,
        limitation: null,
        treeTruncated: false,
        files: [
          {
            path: 'packages/react-reconciler/src/ReactFiberWorkLoop.js',
            sizeBytes: 2500,
            relevanceScore: 160,
            relevanceReason: 'Explicitly referenced path in issue',
            htmlUrl:
              'https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberWorkLoop.js',
            excerpt:
              '1: export function workLoopConcurrent() {\n2:   while (workInProgress !== null) {}\n3: }',
          },
        ],
      };

      let capturedBody: Record<string, unknown> | null = null;
      const mockFetch = vi.fn().mockImplementation(async (_url, options) => {
        capturedBody = JSON.parse(options.body as string);
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    problemSummary: 'Race condition in concurrent work loop causing dropped lanes.',
                    expectedBehaviour:
                      'All lanes should be scheduled and executed without starvation.',
                    rootCauseHypotheses: ['Lanes are overwritten during concurrent yield.'],
                    evidenceAndMissingInformation: {
                      verifiedFacts: [
                        'Observed in packages/react-reconciler/src/ReactFiberWorkLoop.js: workLoopConcurrent while loop.',
                      ],
                      hypotheses: ['Yielding between lane increments creates race condition.'],
                      missingInformation: ['Specific React scheduler priority level used.'],
                    },
                    filesOrComponentsToInvestigate: [
                      {
                        name: 'packages/react-reconciler/src/ReactFiberWorkLoop.js',
                        reason: 'Contains the concurrent work loop.',
                        isGroundedEvidence: true,
                      },
                      {
                        name: 'packages/scheduler/src/FakeFileThatWasNeverInspected.js',
                        reason: 'Might handle scheduler queues.',
                        isGroundedEvidence: true, // HALLUCINATED claim by AI
                      },
                    ],
                    proposedFixSteps: ['Protect lane bitmask transition with atomic check.'],
                    regressionTestPlan: ['Add concurrent lane stress test.'],
                  }),
                },
              },
            ],
          }),
        };
      });

      const aiService = new AiAnalysisService({
        apiKey: 'test-token',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const analysis = await aiService.analyzeIssue(mockIssue, mockRepo, mockEvidence);

      // Verify prompt grounding
      expect(capturedBody).not.toBeNull();
      const messages = (capturedBody as { messages: Array<{ role: string; content: string }> })
        .messages;
      const userMessage = messages.find((m) => m.role === 'user')?.content || '';
      const systemMessage = messages.find((m) => m.role === 'system')?.content || '';

      expect(userMessage).toContain('packages/react-reconciler/src/ReactFiberWorkLoop.js');
      expect(userMessage).toContain('1: export function workLoopConcurrent()');
      expect(systemMessage).toContain('UNTRUSTED external data');

      // Verify analysis output
      expect(analysis.repositoryContextAvailable).toBe(true);
      expect(analysis.repositoryEvidence?.status).toBe('completed');
      expect(analysis.repositoryEvidence?.files).toHaveLength(1);

      // Verify deterministic safety net: genuine inspected file gets isGroundedEvidence = true and htmlUrl
      const genuineFile = analysis.filesOrComponentsToInvestigate.find(
        (f) => f.name === 'packages/react-reconciler/src/ReactFiberWorkLoop.js'
      );
      expect(genuineFile?.isGroundedEvidence).toBe(true);
      expect(genuineFile?.htmlUrl).toContain('ReactFiberWorkLoop.js');

      // Verify hallucinated file claim was automatically corrected to isGroundedEvidence = false
      const uninspectedFile = analysis.filesOrComponentsToInvestigate.find((f) =>
        f.name.includes('FakeFileThatWasNeverInspected')
      );
      expect(uninspectedFile?.isGroundedEvidence).toBe(false);
      expect(uninspectedFile?.htmlUrl).toBeUndefined();
    });

    it('degrades to metadata-only analysis when evidence is empty or unavailable', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  problemSummary: 'Issue summary',
                  expectedBehaviour: 'Expected behaviour',
                  rootCauseHypotheses: ['Hypothesis A'],
                  evidenceAndMissingInformation: {
                    verifiedFacts: ['Fact A'],
                    hypotheses: ['Hypothesis B'],
                    missingInformation: ['Missing info C'],
                  },
                  filesOrComponentsToInvestigate: [
                    { name: 'src/unknown.js', reason: 'Unverified target' },
                  ],
                  proposedFixSteps: ['Step 1'],
                  regressionTestPlan: ['Test 1'],
                }),
              },
            },
          ],
        }),
      });

      const aiService = new AiAnalysisService({
        apiKey: 'test-token',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const analysis = await aiService.analyzeIssue(mockIssue, mockRepo, {
        status: 'unavailable',
        inspectedFileCount: 0,
        limitation: 'Repository tree could not be retrieved.',
        treeTruncated: false,
        files: [],
      });

      expect(analysis.repositoryContextAvailable).toBe(false);
      expect(analysis.repositoryEvidence?.status).toBe('unavailable');
      expect(analysis.repositoryEvidence?.files).toHaveLength(0);
      expect(analysis.repositoryContextLimitation).toContain(
        'Repository tree could not be retrieved'
      );
    });

    it('instructs AI not to substantiate hypotheses when evidence is insufficient_evidence', async () => {
      let capturedBody: Record<string, unknown> | null = null;
      const mockFetch = vi.fn().mockImplementation(async (_url, options) => {
        capturedBody = JSON.parse(options.body as string);
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    problemSummary:
                      'Documentation homepage hover highlight overlap; not substantiated in this repository.',
                    expectedBehaviour: 'Highlight should not overlap interactive preview.',
                    rootCauseHypotheses: [
                      'CSS z-index collision on react.dev (unsubstantiated by core repo).',
                    ],
                    evidenceAndMissingInformation: {
                      verifiedFacts: ['Issue describes react.dev documentation website behavior.'],
                      hypotheses: [
                        'CSS position collision in external reactjs/react.dev repository.',
                      ],
                      missingInformation: [
                        'react.dev source code is located in a separate repository.',
                      ],
                    },
                    filesOrComponentsToInvestigate: [
                      {
                        name: 'reactjs/react.dev',
                        reason: 'Likely repository containing the website documentation UI.',
                        isGroundedEvidence: false,
                      },
                    ],
                    proposedFixSteps: ['Open issue or inspect styles in reactjs/react.dev.'],
                    regressionTestPlan: ['Add visual regression test in react.dev.'],
                  }),
                },
              },
            ],
          }),
        };
      });

      const aiService = new AiAnalysisService({
        apiKey: 'test-token',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const insufficientEvidence: RepositoryEvidence = {
        status: 'insufficient_evidence',
        inspectedFileCount: 0,
        limitation:
          'Implementation likely resides in external repository (reactjs/react.dev). The current repository contains core library code.',
        treeTruncated: false,
        externalRepositoryAdvisory:
          'The reported issue describes behavior on the react.dev documentation website. The documentation website is maintained in a dedicated external repository (reactjs/react.dev).',
        files: [],
      };

      const analysis = await aiService.analyzeIssue(mockIssue, mockRepo, insufficientEvidence);

      expect(analysis.repositoryContextAvailable).toBe(false);
      expect(analysis.repositoryEvidence?.status).toBe('insufficient_evidence');
      expect(analysis.repositoryEvidence?.externalRepositoryAdvisory).toContain(
        'reactjs/react.dev'
      );

      const messages = (capturedBody as { messages: Array<{ role: string; content: string }> })
        .messages;
      const userMessage = messages.find((m) => m.role === 'user')?.content || '';
      const systemMessage = messages.find((m) => m.role === 'system')?.content || '';

      // Directives must be present in prompts
      expect(userMessage).toContain('Status: insufficient_evidence');
      expect(userMessage).toContain('does NOT substantiate');
      expect(userMessage).toContain('External Repository Advisory:');
      expect(systemMessage).toContain('MUST EXPLICITLY STATE');
    });

    it('regression test facebook/react#27986: includes maintainer closing comments in prompt and flags closed status', async () => {
      const issue27986: GithubIssue = {
        number: 27986,
        title: 'Bug: Found an error on React Documentation Site',
        body: 'React version: Official Documentation site (`https://react.dev/learn/state-a-components-memory`)\n\n## Steps To Reproduce\n1. Go to https://react.dev/learn/state-a-components-memory\n2. Click Next button repeatedly.\n\n## The current behavior\nnext button not disabled or handle the error',
        state: 'closed',
        htmlUrl: 'https://github.com/facebook/react/issues/27986',
        authorLogin: 'docuser',
        labels: [{ name: 'Status: Unconfirmed' }],
        comments: [
          {
            id: 19001,
            authorLogin: 'rickhanlonii',
            body: "This is intentional, because there's a challenge at the bottom to fix the crash. https://react.dev/learn/state-a-components-memory#challenges",
            createdAt: '2024-01-18T20:21:14Z',
          },
        ],
        createdAt: '2024-01-18T10:00:00Z',
        updatedAt: '2024-01-18T20:21:14Z',
        closedAt: '2024-01-18T20:21:14Z',
        isPullRequest: false,
      };

      let capturedBody: Record<string, unknown> | null = null;
      const mockFetch = vi.fn().mockImplementation(async (_url, options) => {
        capturedBody = JSON.parse(options.body as string);
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    problemSummary:
                      'Reported crash in documentation interactive component is intentional by design.',
                    expectedBehaviour: 'Crash allows learners to solve the memory challenge.',
                    rootCauseHypotheses: ['Intentional challenge exercise.'],
                    evidenceAndMissingInformation: {
                      verifiedFacts: [
                        'Maintainer confirmed this is intentional for learning challenges.',
                      ],
                      hypotheses: [],
                      missingInformation: [],
                    },
                    filesOrComponentsToInvestigate: [],
                    proposedFixSteps: [
                      'Do not change core React or react.dev code; behavior is intentional.',
                    ],
                    regressionTestPlan: ['No changes required.'],
                  }),
                },
              },
            ],
          }),
        };
      });

      const aiService = new AiAnalysisService({
        apiKey: 'test-token',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const analysis = await aiService.analyzeIssue(issue27986, mockRepo);

      expect(analysis.isClosedIssue).toBe(true);
      expect(analysis.closedIssueNotice).not.toBeNull();

      const messages = (capturedBody as { messages: Array<{ role: string; content: string }> })
        .messages;
      const userMessage = messages.find((m) => m.role === 'user')?.content || '';

      expect(userMessage).toContain('ISSUE DISCUSSION & MAINTAINER COMMENTS');
      expect(userMessage).toContain('rickhanlonii');
      expect(userMessage).toContain(
        "This is intentional, because there's a challenge at the bottom to fix the crash"
      );
    });

    it('preserves indirect_reference role in Section 5 and marks isGroundedEvidence = false', async () => {
      const mockEvidence: RepositoryEvidence = {
        status: 'completed',
        evidenceQuality: 'indirect_reference',
        inspectedFileCount: 1,
        limitation: 'Retrieved files provide indirect reference patterns only.',
        treeTruncated: false,
        files: [
          {
            path: 'src/styles/components.css',
            sizeBytes: 1500,
            relevanceScore: 65,
            relevanceReason: 'Provides related style patterns',
            evidenceRole: 'indirect_reference',
            htmlUrl: 'https://github.com/facebook/react/blob/main/src/styles/components.css',
            excerpt: '1: .button { display: inline-block; }',
          },
        ],
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  problemSummary: 'Indirect reference test summary.',
                  expectedBehaviour: 'Expected behaviour',
                  rootCauseHypotheses: ['Hypothesis'],
                  evidenceAndMissingInformation: {
                    verifiedFacts: ['Fact'],
                    hypotheses: ['Hypothesis'],
                    missingInformation: ['Missing'],
                  },
                  filesOrComponentsToInvestigate: [
                    {
                      name: 'src/styles/components.css',
                      reason: 'Style pattern reference',
                    },
                  ],
                  proposedFixSteps: ['Step 1'],
                  regressionTestPlan: ['Test 1'],
                }),
              },
            },
          ],
        }),
      });

      const aiService = new AiAnalysisService({
        apiKey: 'test-token',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const analysis = await aiService.analyzeIssue(mockIssue, mockRepo, mockEvidence);

      // Since only indirect references exist, repositoryContextAvailable should be false
      expect(analysis.repositoryContextAvailable).toBe(false);

      const target = analysis.filesOrComponentsToInvestigate.find(
        (f) => f.name === 'src/styles/components.css'
      );
      expect(target).toBeDefined();
      expect(target?.isGroundedEvidence).toBe(false);
      expect(target?.evidenceRole).toBe('indirect_reference');
    });
  });
});
