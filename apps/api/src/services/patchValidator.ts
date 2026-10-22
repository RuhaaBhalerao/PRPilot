import type { ParsedDiffFile, PatchValidationResult } from '@prpilot/shared';

export const MAX_CHANGED_FILES = 5;
export const MAX_TOTAL_CHANGED_LINES = 300;
export const MAX_REGRESSION_TEST_LINES = 350;

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header: string;
  lines: string[];
}

export interface ParsedFileDiff {
  oldPath: string;
  newPath: string;
  cleanPath: string;
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
}

/**
 * Normalizes diff file headers (e.g. "a/src/App.tsx" or "--- src/App.tsx")
 * to repository-relative paths without leading prefixes.
 */
export function normalizeDiffPath(rawPath: string): {
  normalized: string;
  isAbsolute: boolean;
  hasTraversal: boolean;
  isIllegal: boolean;
} {
  let cleaned = rawPath.trim();

  // Strip leading quotation marks or timestamps (e.g. "2024-01-01 00:00:00")
  cleaned = cleaned.replace(/\t.*$/, '').replace(/^[ab]\//, '');

  const isAbsolute =
    cleaned.startsWith('/') || cleaned.startsWith('\\') || /^[a-zA-Z]:/.test(cleaned);

  // Normalize backslashes
  const forwardSlashPath = cleaned.replace(/\\/g, '/');
  const segments = forwardSlashPath.split('/').filter(Boolean);

  const hasTraversal = segments.some((s) => s === '..');

  const normalized = segments.join('/');

  const isIllegal =
    normalized.startsWith('.git') ||
    normalized.startsWith('.github') ||
    normalized.startsWith('node_modules') ||
    normalized.includes('.env');

  return {
    normalized,
    isAbsolute,
    hasTraversal,
    isIllegal,
  };
}

/**
 * Parses raw unified diff string into structured file diffs and hunks.
 */
export function parseUnifiedDiff(rawDiff: string): {
  files: ParsedFileDiff[];
  errors: string[];
} {
  const errors: string[] = [];
  const files: ParsedFileDiff[] = [];

  if (!rawDiff || rawDiff.trim().length === 0) {
    errors.push('Unified diff content is empty.');
    return { files, errors };
  }

  // Check for binary diff signatures
  if (rawDiff.includes('GIT binary patch') || rawDiff.includes('\0')) {
    errors.push('Binary diffs are not supported.');
    return { files, errors };
  }

  const lines = rawDiff.split(/\r?\n/);
  let currentFile: ParsedFileDiff | null = null;
  let currentHunk: DiffHunk | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // File header old path: --- a/path/to/file or --- path/to/file
    if (line.startsWith('--- ')) {
      const rawOld = line.slice(4).trim();
      // Lookahead for +++ header
      const nextLine = lines[i + 1];
      if (nextLine && nextLine.startsWith('+++ ')) {
        const rawNew = nextLine.slice(4).trim();
        i++; // advance past +++

        const oldInfo = normalizeDiffPath(rawOld);
        const newInfo = normalizeDiffPath(rawNew);

        if (oldInfo.isAbsolute || newInfo.isAbsolute) {
          errors.push(`Absolute path detected in diff header: '${rawNew}'`);
        }
        if (oldInfo.hasTraversal || newInfo.hasTraversal) {
          errors.push(`Path traversal (..) detected in diff header: '${rawNew}'`);
        }
        if (oldInfo.isIllegal || newInfo.isIllegal) {
          errors.push(`Illegal target file directory in diff: '${newInfo.normalized}'`);
        }

        currentFile = {
          oldPath: oldInfo.normalized,
          newPath: newInfo.normalized,
          cleanPath: newInfo.normalized || oldInfo.normalized,
          hunks: [],
          additions: 0,
          deletions: 0,
        };
        files.push(currentFile);
        currentHunk = null;
        continue;
      }
    }

    // Hunk header: @@ -oldStart,oldLines +newStart,newLines @@ [optional section name]
    const hunkMatch = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
    if (hunkMatch) {
      if (!currentFile) {
        errors.push(
          `Malformed diff: Hunk header '${line}' appeared before file header (--- / +++).`
        );
        continue;
      }

      currentHunk = {
        oldStart: parseInt(hunkMatch[1], 10),
        oldLines: hunkMatch[2] !== undefined ? parseInt(hunkMatch[2], 10) : 1,
        newStart: parseInt(hunkMatch[3], 10),
        newLines: hunkMatch[4] !== undefined ? parseInt(hunkMatch[4], 10) : 1,
        header: line,
        lines: [],
      };
      currentFile.hunks.push(currentHunk);
      continue;
    }

    // Hunk content line
    if (currentHunk && currentFile) {
      if (line.startsWith('+')) {
        currentFile.additions++;
        currentHunk.lines.push(line);
      } else if (line.startsWith('-')) {
        currentFile.deletions++;
        currentHunk.lines.push(line);
      } else if (line.startsWith(' ') || line.startsWith('\\')) {
        currentHunk.lines.push(line);
      }
    }
  }

  if (files.length === 0 && errors.length === 0) {
    errors.push(
      'No valid file modifications found in diff. Expected standard unified diff format (--- / +++ / @@).'
    );
  }

  return { files, errors };
}

/**
 * Simulates in-memory application of a parsed diff against authentic file snapshots.
 * Validates that context lines and deletion lines match the original file.
 * NEVER writes to disk or modifies the working tree.
 */
export function simulateDryRunPatch(
  parsedFiles: ParsedFileDiff[],
  fileSnapshots: Map<string, string>
): { appliedCleanly: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const file of parsedFiles) {
    const targetPath = file.cleanPath;
    const targetKey = targetPath.toLowerCase();

    // Find snapshot matching this file
    let snapshotContent: string | undefined;
    for (const [snapKey, content] of fileSnapshots.entries()) {
      if (
        snapKey === targetKey ||
        snapKey.endsWith(`/${targetKey}`) ||
        targetKey.endsWith(`/${snapKey}`)
      ) {
        snapshotContent = content;
        break;
      }
    }

    if (snapshotContent === undefined) {
      errors.push(
        `Target file '${targetPath}' does not exist in the inspected repository snapshot.`
      );
      continue;
    }

    const origLines = snapshotContent.split(/\r?\n/);

    for (let h = 0; h < file.hunks.length; h++) {
      const hunk = file.hunks[h];
      const targetStartLine = Math.max(0, hunk.oldStart - 1);

      // Seek context line match with up to +/- 5 lines tolerance
      let matchOffset = 0;
      let foundMatch = false;

      const firstContextLine = hunk.lines.find((l) => l.startsWith(' ') || l.startsWith('-'));
      const expectedText = firstContextLine ? firstContextLine.slice(1).trim() : '';

      for (let offset = 0; offset <= 5; offset++) {
        for (const sign of [0, 1, -1]) {
          const checkIdx = targetStartLine + offset * sign;
          if (
            checkIdx >= 0 &&
            checkIdx < origLines.length &&
            (expectedText === '' || origLines[checkIdx].trim() === expectedText)
          ) {
            matchOffset = checkIdx - targetStartLine;
            foundMatch = true;
            break;
          }
        }
        if (foundMatch) break;
      }

      const effectiveStart = Math.max(0, targetStartLine + matchOffset);
      let currentOrigIdx = effectiveStart;

      for (const hunkLine of hunk.lines) {
        if (hunkLine.startsWith(' ') || hunkLine.startsWith('-')) {
          const expectedContent = hunkLine.slice(1).trim();
          if (currentOrigIdx < origLines.length) {
            const actualContent = origLines[currentOrigIdx].trim();
            if (expectedContent !== '' && actualContent !== expectedContent) {
              errors.push(
                `Hunk ${h + 1} line mismatch in '${targetPath}': expected '${expectedContent}', but found '${actualContent}' at original line ${currentOrigIdx + 1}.`
              );
            }
          }
          currentOrigIdx++;
        }
      }
    }
  }

  return {
    appliedCleanly: errors.length === 0,
    errors,
  };
}

/**
 * Validates a generated unified diff deterministically.
 */
export function validatePatch(
  rawDiff: string,
  fileSnapshots: Map<string, string>
): PatchValidationResult {
  const validationErrors: string[] = [];
  const validationWarnings: string[] = [];

  const { files, errors: parseErrors } = parseUnifiedDiff(rawDiff);
  validationErrors.push(...parseErrors);

  // Check changed file count
  if (files.length > MAX_CHANGED_FILES) {
    validationErrors.push(
      `Patch changes too many files (${files.length} files). PRPilot requires minimal patches affecting at most ${MAX_CHANGED_FILES} files.`
    );
  }

  let totalAdditions = 0;
  let totalDeletions = 0;
  const parsedFiles: ParsedDiffFile[] = [];

  for (const f of files) {
    totalAdditions += f.additions;
    totalDeletions += f.deletions;
    parsedFiles.push({
      oldPath: f.oldPath,
      newPath: f.newPath,
      additions: f.additions,
      deletions: f.deletions,
      hunksCount: f.hunks.length,
    });
  }

  // Check total lines changed
  const totalLinesChanged = totalAdditions + totalDeletions;
  if (totalLinesChanged > MAX_TOTAL_CHANGED_LINES) {
    validationErrors.push(
      `Patch is excessively large (${totalLinesChanged} lines changed). Minimal bugfix patches should not exceed ${MAX_TOTAL_CHANGED_LINES} lines.`
    );
  }

  // In-memory dry-run application
  let appliedCleanly = false;
  if (validationErrors.length === 0 && files.length > 0) {
    const dryRunResult = simulateDryRunPatch(files, fileSnapshots);
    appliedCleanly = dryRunResult.appliedCleanly;
    if (!dryRunResult.appliedCleanly) {
      validationErrors.push(...dryRunResult.errors);
    }
  }

  const isValid = validationErrors.length === 0 && files.length > 0 && appliedCleanly;

  return {
    isValid,
    status: isValid ? 'validated' : 'validation_failed',
    appliedCleanly,
    validationErrors,
    validationWarnings,
    parsedFiles,
    totalAdditions,
    totalDeletions,
  };
}
