import { describe, it, expect } from 'vitest';
import { validatePatch } from '../src/services/patchValidator.js';

describe('Phase 6: Deterministic Patch Validator', () => {
  const sampleOriginalCode = `function calculateTotal(items) {
  let total = 0;
  for (const item of items) {
    total += item.price;
  }
  return total;
}`;

  const validDiff = `--- a/src/cart.js
+++ b/src/cart.js
@@ -1,6 +1,7 @@
 function calculateTotal(items) {
+  if (!Array.isArray(items)) return 0;
   let total = 0;
   for (const item of items) {
     total += item.price;
   }
   return total;
`;

  it('validates a clean, well-formed unified diff that matches the snapshot', () => {
    const snapshots = new Map<string, string>([['src/cart.js', sampleOriginalCode]]);

    const result = validatePatch(validDiff, snapshots);
    expect(result.isValid).toBe(true);
    expect(result.status).toBe('validated');
    expect(result.appliedCleanly).toBe(true);
    expect(result.validationErrors).toHaveLength(0);
    expect(result.totalAdditions).toBe(1);
    expect(result.totalDeletions).toBe(0);
    expect(result.parsedFiles).toHaveLength(1);
    expect(result.parsedFiles[0].newPath).toBe('src/cart.js');
  });

  it('rejects empty diffs', () => {
    const snapshots = new Map<string, string>();
    const result = validatePatch('', snapshots);
    expect(result.isValid).toBe(false);
    expect(result.status).toBe('validation_failed');
    expect(result.validationErrors[0]).toContain('Unified diff content is empty');
  });

  it('rejects binary patches', () => {
    const binaryDiff = `GIT binary patch\nliteral 1234\n...`;
    const snapshots = new Map<string, string>();
    const result = validatePatch(binaryDiff, snapshots);
    expect(result.isValid).toBe(false);
    expect(result.validationErrors.some((e) => e.includes('Binary diffs are not supported'))).toBe(
      true
    );
  });

  it('rejects malformed diffs without valid headers', () => {
    const malformedDiff = `@@ -1,3 +1,4 @@\n+just a hunk without file header`;
    const snapshots = new Map<string, string>();
    const result = validatePatch(malformedDiff, snapshots);
    expect(result.isValid).toBe(false);
    expect(result.validationErrors.some((e) => e.includes('Malformed diff: Hunk header'))).toBe(
      true
    );
  });

  it('rejects absolute paths in diff headers', () => {
    const absDiff = `--- /etc/passwd
+++ /etc/passwd
@@ -1,1 +1,1 @@
-admin
+superadmin
`;
    const snapshots = new Map<string, string>();
    const result = validatePatch(absDiff, snapshots);
    expect(result.isValid).toBe(false);
    expect(result.validationErrors.some((e) => e.includes('Absolute path detected'))).toBe(true);
  });

  it('rejects path traversal (..) in diff headers', () => {
    const traversalDiff = `--- a/src/../../evil.js
+++ b/src/../../evil.js
@@ -1,1 +1,1 @@
-console.log('hi')
+console.log('pwned')
`;
    const snapshots = new Map<string, string>();
    const result = validatePatch(traversalDiff, snapshots);
    expect(result.isValid).toBe(false);
    expect(result.validationErrors.some((e) => e.includes('Path traversal (..) detected'))).toBe(
      true
    );
  });

  it('rejects illegal file targets such as .git or node_modules or .env', () => {
    const illegalDiff = `--- a/.env
+++ b/.env
@@ -1,1 +1,1 @@
-FOO=bar
+FOO=baz
`;
    const snapshots = new Map<string, string>();
    const result = validatePatch(illegalDiff, snapshots);
    expect(result.isValid).toBe(false);
    expect(result.validationErrors.some((e) => e.includes('Illegal target file directory'))).toBe(
      true
    );
  });

  it('rejects patches when target file does not exist in repository snapshot', () => {
    const missingFileDiff = `--- a/src/unknown.js
+++ b/src/unknown.js
@@ -1,2 +1,3 @@
 function test() {
+  return 1;
 }
`;
    const snapshots = new Map<string, string>([['src/cart.js', sampleOriginalCode]]);
    const result = validatePatch(missingFileDiff, snapshots);
    expect(result.isValid).toBe(false);
    expect(
      result.validationErrors.some((e) =>
        e.includes('does not exist in the inspected repository snapshot')
      )
    ).toBe(true);
  });

  it('detects when hunk context lines do not match original snapshot content', () => {
    const mismatchedDiff = `--- a/src/cart.js
+++ b/src/cart.js
@@ -1,3 +1,4 @@
 function calculateDifference(items) {
+  // mismatch here
   let diff = 0;
`;
    const snapshots = new Map<string, string>([['src/cart.js', sampleOriginalCode]]);
    const result = validatePatch(mismatchedDiff, snapshots);
    expect(result.isValid).toBe(false);
    expect(result.appliedCleanly).toBe(false);
    expect(result.validationErrors.some((e) => e.includes('line mismatch'))).toBe(true);
  });

  it('rejects excessively large patches with too many changed files (> 5)', () => {
    let multiFileDiff = '';
    const snapshots = new Map<string, string>();

    for (let i = 1; i <= 6; i++) {
      const path = `src/file${i}.js`;
      snapshots.set(path, 'const a = 1;');
      multiFileDiff += `--- a/${path}\n+++ b/${path}\n@@ -1,1 +1,2 @@\n const a = 1;\n+const b = 2;\n`;
    }

    const result = validatePatch(multiFileDiff, snapshots);
    expect(result.isValid).toBe(false);
    expect(result.validationErrors.some((e) => e.includes('changes too many files'))).toBe(true);
  });

  it('rejects excessively large patches exceeding line limits (> 300 lines)', () => {
    const massiveAdditions = Array(350).fill('+const x = 1;').join('\n');
    const massiveDiff = `--- a/src/cart.js
+++ b/src/cart.js
@@ -1,1 +1,351 @@
 function calculateTotal(items) {
${massiveAdditions}
`;
    const snapshots = new Map<string, string>([['src/cart.js', sampleOriginalCode]]);
    const result = validatePatch(massiveDiff, snapshots);
    expect(result.isValid).toBe(false);
    expect(result.validationErrors.some((e) => e.includes('excessively large'))).toBe(true);
  });
});
