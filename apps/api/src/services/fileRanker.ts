import type { GithubIssue, GithubRepository } from '@prpilot/shared';
import { env } from '../config/env.js';

export interface TreeFileItem {
  path: string;
  size?: number;
  type?: string;
}

export interface RankedFile {
  path: string;
  score: number;
  reason: string;
  sizeBytes: number;
  evidenceRole: 'direct_evidence' | 'indirect_reference';
}

export interface RankingOptions {
  maxResults?: number;
  maxFileSizeBytes?: number;
  minRelevanceScore?: number;
}

export interface ExternalRepositoryAdvisory {
  targetRepository: string;
  advisoryMessage: string;
  suggestedAction: string;
}

export const MIN_FILE_SCORE = 30;
export const MIN_GROUNDED_SCORE = 60;

export const GENERIC_UI_WORDS = new Set([
  'button',
  'btn',
  'icon',
  'link',
  'code',
  'menu',
  'header',
  'footer',
  'page',
  'view',
  'text',
  'item',
  'list',
  'nav',
  'navigation',
  'tab',
  'modal',
  'card',
  'input',
  'label',
  'wrapper',
  'container',
]);

const EXCLUDED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  'vendor',
  '.git',
  '.github',
  '.next',
  '.turbo',
  '.cache',
  'target',
  'bundle',
  'coverage',
  '.vscode',
  '.idea',
  '__pycache__',
  'fixtures',
  '__fixtures__',
  'test-fixtures',
  'fizz-instruction-set',
  'generated',
  '__generated__',
  '.generated',
  'codegen',
]);

const EXCLUDED_EXTENSIONS = new Set([
  '.min.js',
  '.min.css',
  '.map',
  '.lock',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.ico',
  '.webp',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.pdf',
  '.zip',
  '.tar',
  '.gz',
  '.mp4',
  '.wasm',
  '.exe',
  '.dll',
  '.so',
]);

const EXCLUDED_FILENAMES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'cargo.lock',
  'gemfile.lock',
  'composer.lock',
  'license',
  'license.md',
  'license.txt',
  'copying',
]);

const COMMON_STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'that',
  'this',
  'with',
  'from',
  'have',
  'when',
  'what',
  'where',
  'which',
  'there',
  'their',
  'about',
  'into',
  'error',
  'issue',
  'bug',
  'cannot',
  'does',
  'not',
  'fail',
  'fails',
  'failing',
  'expected',
  'found',
  'using',
  'should',
  'could',
  'would',
  'please',
  'after',
  'before',
  'during',
  'while',
  'code',
  'example',
  'examples',
  'sample',
  'samples',
  'file',
  'files',
  'line',
  'lines',
  'index',
  'data',
  'item',
  'items',
  'value',
  'values',
  'type',
  'types',
  'name',
  'names',
  'string',
  'strings',
  'text',
  'app',
  'page',
  'site',
  'website',
  'view',
  'views',
  'react',
  'component',
  'components',
  'function',
  'functions',
  'method',
  'methods',
  'object',
  'objects',
  'class',
  'classes',
  'module',
  'modules',
  'project',
  'repo',
  'repository',
  'run',
  'running',
  'call',
  'calls',
  'called',
  'get',
  'set',
  'new',
  'old',
  'check',
  'checks',
  ...GENERIC_UI_WORDS,
]);

const UI_LAYOUT_TOKENS = new Set([
  'hover',
  'highlight',
  'overlap',
  'overlaps',
  'overlapping',
  'preview',
  'layout',
  'position',
  'positioning',
  'css',
  'style',
  'styles',
  'z-index',
  'align',
  'alignment',
  'cursor',
  'tooltip',
  'modal',
  'dropdown',
  'overlay',
  'video',
  'interactive',
  'viewport',
  'responsive',
  'navbar',
  'sidebar',
  'dialog',
  'padding',
  'margin',
  'flex',
  'grid',
  'transition',
  'animation',
]);

const LANGUAGE_EXTENSION_MAP: Record<string, string[]> = {
  javascript: ['.js', '.jsx', '.mjs', '.cjs'],
  typescript: ['.ts', '.tsx', '.mts', '.cts'],
  python: ['.py'],
  go: ['.go'],
  rust: ['.rs'],
  java: ['.java'],
  c: ['.c', '.h'],
  'c++': ['.cpp', '.cc', '.cxx', '.hpp', '.h'],
  ruby: ['.rb'],
  php: ['.php'],
  swift: ['.swift'],
  kotlin: ['.kt', '.kts'],
};

/**
 * Checks if a path is excluded from source intelligence (generated, compiler fixtures, build output, binary, or lockfile).
 * Also excludes DevTools files when the issue does not explicitly describe DevTools.
 */
export function isExcludedFile(path: string, hasDevToolsContext = false): boolean {
  const normalized = path.replace(/\\/g, '/').toLowerCase();

  // If the issue is not about DevTools, strictly exclude all DevTools files
  if (
    !hasDevToolsContext &&
    (normalized.includes('react-devtools') ||
      normalized.includes('/devtools/') ||
      normalized.startsWith('packages/react-devtools'))
  ) {
    return true;
  }

  const segments = normalized.split('/');

  // Check excluded directory segments
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (EXCLUDED_DIRS.has(seg)) {
      return true;
    }
    // Penalize/exclude compiler fixtures, test fixtures, or inline instruction sets
    if (seg.includes('fixtures') || seg.includes('fizz-instruction-set')) {
      return true;
    }
  }

  const fileName = segments[segments.length - 1];
  if (EXCLUDED_FILENAMES.has(fileName)) {
    return true;
  }

  for (const ext of EXCLUDED_EXTENSIONS) {
    if (fileName.endsWith(ext)) {
      return true;
    }
  }

  // Detect generated file naming patterns
  if (
    fileName.includes('inlinecodestrings') ||
    fileName.includes('inline-code-strings') ||
    fileName.includes('.generated.') ||
    fileName.endsWith('-generated.js') ||
    fileName.endsWith('_generated.js') ||
    fileName.endsWith('-generated.ts') ||
    fileName.endsWith('_generated.ts') ||
    fileName.endsWith('.bundle.js') ||
    fileName.endsWith('.chunk.js')
  ) {
    return true;
  }

  return false;
}

/**
 * Inspects raw file content to detect generated file headers and markers.
 */
export function isGeneratedFileContent(content: string): boolean {
  const header = content.slice(0, 1000).toLowerCase();
  return (
    header.includes('this is a generated file') ||
    header.includes('@generated') ||
    header.includes('do not edit') ||
    header.includes('generated code') ||
    header.includes('automatically generated') ||
    header.includes('run `yarn generate') ||
    header.includes('run `npm run generate')
  );
}

/**
 * Detects whether an issue reported against a library repository actually belongs to
 * an external repository (such as documentation website reactjs/react.dev vs facebook/react).
 */
export function detectExternalRepositoryTarget(
  issue: GithubIssue,
  repository: GithubRepository
): ExternalRepositoryAdvisory | null {
  const repoOwner = (repository.ownerLogin || '').toLowerCase();
  const repoName = (repository.name || '').toLowerCase();
  const fullName = (repository.fullName || `${repoOwner}/${repoName}`).toLowerCase();
  const titleAndBody = `${issue.title}\n${issue.body || ''}`.toLowerCase();
  const labels = issue.labels.map((l) => l.name.toLowerCase()).join(' ');

  const isReactCoreRepo =
    fullName === 'facebook/react' ||
    fullName === 'react/react' ||
    ((repoOwner === 'facebook' || repoOwner === 'react') && repoName === 'react');

  // 1. Detection for React Documentation (react.dev / reactjs.org) vs facebook/react core library
  if (isReactCoreRepo) {
    const hasReactDevUrl =
      titleAndBody.includes('react.dev') ||
      titleAndBody.includes('reactjs.org') ||
      titleAndBody.includes('beta.reactjs.org');

    const mentionsDocsSite =
      titleAndBody.includes('documentation site') ||
      titleAndBody.includes('documentation website') ||
      titleAndBody.includes('docs site') ||
      titleAndBody.includes('official documentation') ||
      titleAndBody.includes('react documentation') ||
      titleAndBody.includes('docs homepage') ||
      titleAndBody.includes('state-a-components-memory') ||
      titleAndBody.includes('interactive code example') ||
      titleAndBody.includes('interactive example') ||
      labels.includes('documentation');

    const mentionsWebsiteUi =
      titleAndBody.includes('hover') ||
      titleAndBody.includes('preview') ||
      titleAndBody.includes('homepage') ||
      titleAndBody.includes('video example') ||
      titleAndBody.includes('syntax highlight');

    if (hasReactDevUrl || mentionsDocsSite || mentionsWebsiteUi) {
      return {
        targetRepository: 'reactjs/react.dev',
        advisoryMessage:
          'The reported issue describes behavior on the react.dev documentation website (navigation, interactive challenges, code examples, or documentation styling). The documentation website is maintained in a dedicated external repository (reactjs/react.dev), not in the core react/react library repository. The affected website UI components, challenges, and navigation are not present in react/react.',
        suggestedAction:
          'Inspect or triage this issue against the documentation website repository at https://github.com/reactjs/react.dev.',
      };
    }
  }

  // 2. Generic detection: explicit GitHub repository links in issue text pointing to a different repo
  const githubRepoRegex = /https:\/\/github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)(?:\/|$)/g;
  let match: RegExpExecArray | null;
  while ((match = githubRepoRegex.exec(titleAndBody)) !== null) {
    const foundOwner = match[1].toLowerCase();
    const foundRepo = match[2].toLowerCase();
    if (
      (foundOwner !== repoOwner || foundRepo !== repoName) &&
      !['pull', 'issues', 'commit', 'releases'].includes(foundRepo)
    ) {
      const target = `${match[1]}/${match[2]}`;
      if (
        titleAndBody.includes('moved to') ||
        titleAndBody.includes('transferred to') ||
        titleAndBody.includes('website repository') ||
        titleAndBody.includes('docs repository') ||
        titleAndBody.includes('maintained in') ||
        titleAndBody.includes('separate repo')
      ) {
        return {
          targetRepository: target,
          advisoryMessage: `The issue describes implementation in an external repository (${target}) rather than the current repository (${repository.fullName}).`,
          suggestedAction: `Inspect the issue against https://github.com/${target}.`,
        };
      }
    }
  }

  return null;
}

/**
 * Extracts explicit file paths and code tokens from issue title and body.
 */
export function extractIssueKeywords(issue: GithubIssue): {
  explicitPaths: Set<string>;
  explicitFiles: Set<string>;
  titleKeywords: Set<string>;
  bodyKeywords: Set<string>;
  hasTestContext: boolean;
  hasUiContext: boolean;
  hasDevToolsContext: boolean;
  uiKeywords: Set<string>;
} {
  const combinedText = `${issue.title}\n${issue.body || ''}`;
  const lowerText = combinedText.toLowerCase();

  const explicitPaths = new Set<string>();
  const explicitFiles = new Set<string>();

  // Regex to detect explicit paths like "src/utils/foo.ts" or "packages/core/index.js"
  const pathRegex = /(?:[a-zA-Z0-9_.-]+\/)+[a-zA-Z0-9_.-]+\.[a-zA-Z0-9]+/g;
  let match: RegExpExecArray | null;
  while ((match = pathRegex.exec(combinedText)) !== null) {
    const rawPath = match[0].replace(/^[("'`[]+|[)"'`\],:;]+$/g, '').trim();
    if (rawPath.length > 2 && !rawPath.includes('http')) {
      explicitPaths.add(rawPath.toLowerCase());
      const parts = rawPath.split('/');
      explicitFiles.add(parts[parts.length - 1].toLowerCase());
    }
  }

  // Regex to detect standalone file names with extensions like "App.tsx", "FiberWorkLoop.js"
  const fileRegex =
    /\b[a-zA-Z0-9_-]+\.(?:ts|tsx|js|jsx|py|go|rs|java|c|cpp|h|css|scss|html|md|json)\b/gi;
  while ((match = fileRegex.exec(combinedText)) !== null) {
    const file = match[0].toLowerCase();
    explicitFiles.add(file);
  }

  // Detect DevTools context
  const hasDevToolsContext =
    lowerText.includes('devtools') ||
    lowerText.includes('developer tools') ||
    lowerText.includes('profiler') ||
    lowerText.includes('react devtools') ||
    lowerText.includes('components tab') ||
    lowerText.includes('chrome extension');

  // Tokenize title keywords
  const titleKeywords = new Set<string>();
  const expandedTitle = `${issue.title} ${issue.title.replace(/([a-z0-9])([A-Z])/g, '$1 $2')}`;
  const rawTitleTokens = expandedTitle
    .toLowerCase()
    .replace(/[^a-zA-Z0-9_.-]/g, ' ')
    .split(/\s+/);
  for (const token of rawTitleTokens) {
    if (token.length >= 3 && !COMMON_STOP_WORDS.has(token) && !GENERIC_UI_WORDS.has(token)) {
      titleKeywords.add(token);
    }
  }

  // Tokenize body keywords
  const bodyKeywords = new Set<string>();
  if (issue.body) {
    const expandedBody = `${issue.body} ${issue.body.replace(/([a-z0-9])([A-Z])/g, '$1 $2')}`;
    const rawBodyTokens = expandedBody
      .toLowerCase()
      .replace(/[^a-zA-Z0-9_.-]/g, ' ')
      .split(/\s+/);
    for (const token of rawBodyTokens) {
      if (
        token.length >= 3 &&
        !COMMON_STOP_WORDS.has(token) &&
        !GENERIC_UI_WORDS.has(token) &&
        !titleKeywords.has(token)
      ) {
        bodyKeywords.add(token);
      }
    }
  }

  // Detect UI & styling context
  const uiKeywords = new Set<string>();
  for (const token of [...titleKeywords, ...bodyKeywords]) {
    if (UI_LAYOUT_TOKENS.has(token)) {
      uiKeywords.add(token);
    }
  }
  for (const token of UI_LAYOUT_TOKENS) {
    if (lowerText.includes(token)) {
      uiKeywords.add(token);
    }
  }

  const hasUiContext = uiKeywords.size > 0;

  const hasTestContext =
    lowerText.includes('test') ||
    lowerText.includes('spec') ||
    lowerText.includes('reproduction') ||
    lowerText.includes('jest') ||
    lowerText.includes('vitest');

  return {
    explicitPaths,
    explicitFiles,
    titleKeywords,
    bodyKeywords,
    hasTestContext,
    hasUiContext,
    hasDevToolsContext,
    uiKeywords,
  };
}

/**
 * Deterministically ranks repository tree files based on transparent heuristics.
 * Filters out low-scoring noise and enforces the minimum relevance threshold.
 */
export function rankRepositoryFiles(
  treeFiles: TreeFileItem[],
  issue: GithubIssue,
  repository: GithubRepository,
  options: RankingOptions = {}
): RankedFile[] {
  const maxResults = options.maxResults ?? 5;
  const maxFileSizeBytes = options.maxFileSizeBytes ?? 100 * 1024; // 100 KB max individual file

  const {
    explicitPaths,
    explicitFiles,
    titleKeywords,
    bodyKeywords,
    hasTestContext,
    hasUiContext,
    hasDevToolsContext,
    uiKeywords,
  } = extractIssueKeywords(issue);

  const primaryLang = (repository.primaryLanguage || '').toLowerCase();
  const primaryExtensions = LANGUAGE_EXTENSION_MAP[primaryLang] || [];

  const candidates: RankedFile[] = [];

  for (const file of treeFiles) {
    // Only inspect blob items (files), ignore git submodules/trees
    if (file.type && file.type !== 'blob') {
      continue;
    }

    const path = file.path;
    const sizeBytes = file.size ?? 0;

    // Filter out excluded directories, binary files, lockfiles, compiler fixtures, generated files,
    // and unrelated DevTools files if the issue does not concern DevTools
    if (isExcludedFile(path, hasDevToolsContext)) {
      continue;
    }

    // Skip files exceeding individual size limit
    if (sizeBytes > maxFileSizeBytes) {
      continue;
    }

    const lowerPath = path.toLowerCase();
    const segments = lowerPath.split('/');
    const fileName = segments[segments.length - 1];
    const baseName = fileName.replace(/\.[a-zA-Z0-9]+$/, '');
    const isGenericUiFile = GENERIC_UI_WORDS.has(baseName);

    let score = 0;
    const reasons: string[] = [];

    // 1. Explicit path match from issue description or stack trace (+100)
    for (const explicitPath of explicitPaths) {
      if (lowerPath === explicitPath || lowerPath.endsWith(`/${explicitPath}`)) {
        score += 100;
        reasons.push(`Explicitly referenced path in issue: '${explicitPath}'`);
        break;
      }
    }

    // 2. Explicit filename match (+60)
    // Only award full score if not purely a generic UI file name without explicit path
    if (explicitFiles.has(fileName)) {
      if (isGenericUiFile && explicitPaths.size === 0) {
        score += 20;
        reasons.push(`Generic UI filename mentioned in issue: '${fileName}'`);
      } else {
        score += 60;
        reasons.push(`Explicit filename mentioned in issue: '${fileName}'`);
      }
    }

    // 3. Issue title keywords match in path or filename (+25 for filename, +12 for path)
    // Skip keyword boost for generic UI files to avoid false positives (e.g. Button.js matching 'button')
    if (!isGenericUiFile) {
      for (const kw of titleKeywords) {
        if (fileName.includes(kw)) {
          score += 25;
          reasons.push(`Filename matches title keyword '${kw}'`);
        } else if (lowerPath.includes(kw)) {
          score += 12;
          reasons.push(`Path matches title keyword '${kw}'`);
        }
      }

      // 4. Issue body keywords match in path or filename (+10 for filename, +4 for path)
      let bodyHits = 0;
      for (const kw of bodyKeywords) {
        if (bodyHits >= 4) break;
        if (fileName.includes(kw)) {
          score += 10;
          bodyHits++;
        } else if (lowerPath.includes(kw)) {
          score += 4;
          bodyHits++;
        }
      }
      if (bodyHits > 0) {
        reasons.push(`Matches ${bodyHits} issue context keyword(s)`);
      }
    }

    // 5. UI & Styling domain context weighting
    if (hasUiContext) {
      const isStyleFile =
        fileName.endsWith('.css') ||
        fileName.endsWith('.scss') ||
        fileName.endsWith('.sass') ||
        fileName.endsWith('.less') ||
        fileName.includes('.module.');
      const isUiComponent =
        fileName.endsWith('.tsx') ||
        fileName.endsWith('.jsx') ||
        lowerPath.includes('/components/') ||
        lowerPath.includes('/ui/') ||
        lowerPath.includes('/views/') ||
        lowerPath.includes('/pages/') ||
        lowerPath.includes('/widgets/');

      if (isStyleFile) {
        score += 40;
        reasons.push('CSS/styling file relevant to UI layout issue');
      } else if (isUiComponent) {
        score += 30;
        reasons.push('UI component file matching visual/layout issue');
      }

      // Check specific UI tokens match in path
      for (const uiKw of uiKeywords) {
        if (fileName.includes(uiKw)) {
          score += 25;
          reasons.push(`Filename matches UI layout token '${uiKw}'`);
          break;
        }
      }

      // Penalize internal compiler, server runtime, or reconciler files on UI issues
      const isServerOrCompiler =
        lowerPath.includes('/compiler/') ||
        lowerPath.includes('/server/') ||
        lowerPath.includes('/fizz/') ||
        lowerPath.includes('/reconciler/') ||
        lowerPath.includes('/runtime/') ||
        lowerPath.includes('/codegen/') ||
        lowerPath.includes('/engine/');

      if (isServerOrCompiler) {
        score -= 50;
      }
    }

    // 6. Primary repository programming language match (+10)
    const matchesPrimaryLang = primaryExtensions.some((ext) => fileName.endsWith(ext));
    if (matchesPrimaryLang) {
      score += 10;
    }

    // 7. Test file handling
    const isTestFile =
      fileName.includes('.test.') ||
      fileName.includes('.spec.') ||
      lowerPath.includes('/__tests__/') ||
      lowerPath.includes('/tests/');

    if (isTestFile) {
      if (hasTestContext) {
        score += 15;
        reasons.push('Relevant test suite file');
      } else {
        score -= 35;
      }
    }

    // Determine evidence role: direct implementation evidence vs indirect reference/pattern
    let evidenceRole: 'direct_evidence' | 'indirect_reference' = 'direct_evidence';
    const isExplicit =
      explicitPaths.has(lowerPath) ||
      explicitFiles.has(fileName) ||
      Array.from(explicitPaths).some((ep) => lowerPath.endsWith(`/${ep}`));

    if (
      (isGenericUiFile && !isExplicit) ||
      (!isExplicit && (fileName.endsWith('.css') || fileName.endsWith('.scss') || isTestFile))
    ) {
      evidenceRole = 'indirect_reference';
    }

    // Filter out candidates below individual threshold
    if (score >= MIN_FILE_SCORE) {
      candidates.push({
        path,
        score,
        reason: reasons.length > 0 ? reasons.join('; ') : 'Matches codebase pattern',
        sizeBytes,
        evidenceRole,
      });
    }
  }

  // Deterministic sorting: score DESC, then path ASC for deterministic tie-breaking
  candidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.path.localeCompare(b.path);
  });

  // Configurable minimum relevance threshold check:
  // If the top scoring candidate does not reach minThreshold, reject all candidates
  const minThreshold = options.minRelevanceScore ?? env.MIN_RELEVANCE_SCORE ?? MIN_GROUNDED_SCORE;
  if (candidates.length === 0 || candidates[0].score < minThreshold) {
    return [];
  }

  return candidates.slice(0, maxResults);
}
