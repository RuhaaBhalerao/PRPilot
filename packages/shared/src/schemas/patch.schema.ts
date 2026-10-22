import { z } from 'zod';

// ==========================================
// Patch Generation Eligibility
// ==========================================

export const patchEligibilityDetailsSchema = z.object({
  isClosed: z.boolean(),
  isIntentionalOrResolved: z.boolean(),
  hasDirectEvidence: z.boolean(),
  hasExternalRepoMismatch: z.boolean(),
  evidenceQuality: z
    .enum(['direct_grounded', 'indirect_reference', 'insufficient', 'unavailable'])
    .optional(),
});

export type PatchEligibilityDetails = z.infer<typeof patchEligibilityDetailsSchema>;

export const patchEligibilitySchema = z.object({
  eligible: z.boolean(),
  status: z.enum(['eligible', 'not_eligible']),
  blockers: z.array(z.string()),
  allowOverride: z.boolean().default(false),
  details: patchEligibilityDetailsSchema.optional(),
});

export type PatchEligibility = z.infer<typeof patchEligibilitySchema>;

// ==========================================
// Generate Patch Request
// ==========================================

export const generatePatchRequestSchema = z
  .object({
    analysisId: z.string().uuid({ message: 'Valid analysis UUID is required' }).optional(),
    issueUrl: z.string().url({ message: 'Valid GitHub issue URL is required' }).optional(),
    forceAllowClosed: z.boolean().default(false),
  })
  .refine((data) => data.analysisId || data.issueUrl, {
    message: 'Either analysisId or issueUrl must be provided',
  });

export type GeneratePatchRequest = z.infer<typeof generatePatchRequestSchema>;

// ==========================================
// File Change Explanation
// ==========================================

export const filePatchExplanationSchema = z.object({
  path: z.string(),
  relevanceReason: z.string(),
  changeSummary: z.string(),
  addressedRegressionTest: z.string().optional(),
});

export type FilePatchExplanation = z.infer<typeof filePatchExplanationSchema>;

// ==========================================
// Regression Test Proposal
// ==========================================

export const testExecutionStatusSchema = z.enum([
  'not_run',
  'running',
  'passed',
  'failed',
  'sandbox_unavailable',
]);

export type TestExecutionStatus = z.infer<typeof testExecutionStatusSchema>;

export const regressionTestProposalSchema = z.object({
  title: z.string(),
  targetFile: z.string(),
  testFramework: z.string().default('vitest/jest'),
  testCode: z.string(),
  description: z.string(),
  executionStatus: testExecutionStatusSchema.default('not_run'),
});

export type RegressionTestProposal = z.infer<typeof regressionTestProposalSchema>;

// ==========================================
// Parsed Diff Metrics
// ==========================================

export const parsedDiffFileSchema = z.object({
  oldPath: z.string(),
  newPath: z.string(),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  hunksCount: z.number().int().nonnegative(),
});

export type ParsedDiffFile = z.infer<typeof parsedDiffFileSchema>;

// ==========================================
// Patch Validation Result
// ==========================================

export const patchValidationResultSchema = z.object({
  isValid: z.boolean(),
  status: z.enum(['validated', 'validation_failed', 'not_verified']),
  appliedCleanly: z.boolean(),
  validationErrors: z.array(z.string()),
  validationWarnings: z.array(z.string()),
  parsedFiles: z.array(parsedDiffFileSchema),
  totalAdditions: z.number().int().nonnegative(),
  totalDeletions: z.number().int().nonnegative(),
});

export type PatchValidationResult = z.infer<typeof patchValidationResultSchema>;

// ==========================================
// Phase 7: Patch Verification Request & Response
// ==========================================

export const verifyPatchRequestSchema = z
  .object({
    analysisId: z.string().uuid({ message: 'Valid analysis UUID is required' }).optional(),
    issueUrl: z.string().url({ message: 'Valid GitHub issue URL is required' }).optional(),
    unifiedDiff: z.string().optional(),
    runSandboxTests: z.boolean().default(false),
  })
  .refine((data) => data.analysisId || data.issueUrl || data.unifiedDiff, {
    message: 'Either analysisId, issueUrl, or unifiedDiff must be provided',
  });

export type VerifyPatchRequest = z.infer<typeof verifyPatchRequestSchema>;

export const patchVerificationResponseSchema = z.object({
  analysisId: z.string().uuid().optional(),
  issueUrl: z.string().url().optional(),
  structuralValidation: patchValidationResultSchema,
  testExecutionStatus: testExecutionStatusSchema,
  sandboxDetails: z.object({
    available: z.boolean(),
    status: z.enum(['not_run', 'sandbox_unavailable', 'passed', 'failed']),
    reason: z.string(),
  }),
  verifiedAt: z.string(),
});

export type PatchVerificationResponse = z.infer<typeof patchVerificationResponseSchema>;

// ==========================================
// Complete Patch Generation Response
// ==========================================

export const patchGenerationResponseSchema = z.object({
  analysisId: z.string().uuid().optional(),
  issueUrl: z.string().url(),
  repository: z.string(),
  eligibility: patchEligibilitySchema,
  status: z.enum(['generated', 'not_eligible', 'failed']),
  suspectedRootCause: z.string().nullable().optional(),
  unifiedDiff: z.string().nullable().optional(),
  fileExplanations: z.array(filePatchExplanationSchema).default([]),
  regressionTests: z.array(regressionTestProposalSchema).default([]),
  assumptionsAndUncertainties: z.array(z.string()).default([]),
  validation: patchValidationResultSchema.nullable().optional(),
  verification: patchVerificationResponseSchema.nullable().optional(),
  generatedAt: z.string(),
});

export type PatchGenerationResponse = z.infer<typeof patchGenerationResponseSchema>;
