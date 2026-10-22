import type {
  GithubIssue,
  GithubRepository,
  IssueAnalysis,
  PatchEligibility,
} from '@prpilot/shared';

export interface EligibilityCheckOptions {
  forceAllowClosed?: boolean;
}

/**
 * Evaluates whether an issue and its Phase 5 analysis meet strict criteria
 * for AI patch generation.
 *
 * Requirements enforced:
 * 1. Actionable status: must not be closed unless explicitly overridden.
 * 2. Intentionality check: must not be an intentional bug/challenge/exercise.
 * 3. Evidence sufficiency: Phase 5 must have verified direct source evidence.
 * 4. Repository ownership: implementation must not reside in an external repository.
 */
export function evaluatePatchEligibility(
  issue: GithubIssue,
  repository: GithubRepository,
  analysis: IssueAnalysis,
  options: EligibilityCheckOptions = {}
): PatchEligibility {
  const blockers: string[] = [];
  let allowOverride = false;

  const isClosed = issue.state === 'closed';

  // 1. Maintainer discussion / intentionality check
  const issueText = `${issue.title}\n${issue.body || ''}`.toLowerCase();
  const commentsText = (issue.comments || [])
    .map((c) => `${c.authorLogin || ''}: ${c.body}`)
    .join('\n')
    .toLowerCase();

  const isIntentionalOrResolved =
    issueText.includes('intentional') ||
    commentsText.includes('this is intentional') ||
    commentsText.includes('intentional challenge') ||
    commentsText.includes('by design') ||
    commentsText.includes('works as intended') ||
    analysis.problemSummary.toLowerCase().includes('intentional');

  // 2. Actionability check
  if (isClosed) {
    allowOverride = true;
    if (!options.forceAllowClosed) {
      if (isIntentionalOrResolved) {
        blockers.push(
          'Issue is closed on GitHub and maintainer discussion indicates the reported behavior is intentional by design (e.g., an educational challenge or intentional design choice). Patches should not be generated.'
        );
      } else {
        blockers.push(
          'Issue is closed on GitHub. Closed issues may represent resolved bugs, intentional exercises, or rejected reports. An explicit review override (forceAllowClosed) is required to generate a patch for a closed issue.'
        );
      }
    }
  } else if (isIntentionalOrResolved && !options.forceAllowClosed) {
    allowOverride = true;
    blockers.push(
      'Issue discussion indicates the reported behavior is intentional or by design. Generating code modifications for intentional behavior is prohibited.'
    );
  }

  // 3. Repository ownership & cross-repository mismatch check
  const externalAdvisory = analysis.repositoryEvidence?.externalRepositoryAdvisory;
  const hasExternalRepoMismatch = Boolean(externalAdvisory);

  if (hasExternalRepoMismatch) {
    blockers.push(
      `Cross-repository mismatch: The reported bug concerns a separate system or website, not the ${repository.fullName} repository. Target implementation resides in an external repository (${externalAdvisory}). Patches cannot be generated in this repository.`
    );
  }

  // 4. Evidence sufficiency & grounding check
  const evidence = analysis.repositoryEvidence;
  const evidenceStatus = evidence?.status;
  const evidenceQuality = evidence?.evidenceQuality;

  if (
    !evidence ||
    evidenceStatus === 'insufficient_evidence' ||
    evidenceStatus === 'unavailable' ||
    evidence.inspectedFileCount === 0 ||
    evidence.files.length === 0
  ) {
    blockers.push(
      'Insufficient relevant source evidence: Phase 5 repository intelligence could not locate verified implementation source files for this issue. PRPilot never generates patches from speculative assumptions or ungrounded hypotheses.'
    );
  }

  // Verify at least one directly grounded evidence file is present
  const directEvidenceFiles = (evidence?.files || []).filter(
    (f) => f.evidenceRole !== 'indirect_reference'
  );

  const directTargets = (analysis.filesOrComponentsToInvestigate || []).filter(
    (t) => t.isGroundedEvidence === true && t.evidenceRole !== 'indirect_reference'
  );

  const hasDirectEvidence = directEvidenceFiles.length > 0 || directTargets.length > 0;

  if (evidence && evidence.files.length > 0 && !hasDirectEvidence) {
    blockers.push(
      'No direct grounded evidence files available: All retrieved repository files are indirect reference patterns (e.g., general styles or unrelated components). Direct implementation files must be inspected before formulating code modifications.'
    );
  }

  const eligible = blockers.length === 0;

  return {
    eligible,
    status: eligible ? 'eligible' : 'not_eligible',
    blockers,
    allowOverride: allowOverride && !eligible,
    details: {
      isClosed,
      isIntentionalOrResolved,
      hasDirectEvidence,
      hasExternalRepoMismatch,
      evidenceQuality,
    },
  };
}
