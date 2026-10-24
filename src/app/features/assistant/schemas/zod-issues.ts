import { z } from 'zod';

/**
 * Readable validation reasons for the UI and the event inspector. A failed
 * union only says "Invalid input", so for unions we report the branch that
 * matched the payload's shape best (fewest top-level key mismatches).
 */
export function formatIssues(error: z.ZodError, limit = 6): string[] {
  return flatten(error.issues)
    .slice(0, limit)
    .map((issue) => `${issue.path.join('.') || 'payload'}: ${issue.message}`);
}

/** Union sub-issues already carry absolute paths, so paths are never prefixed. */
function flatten(issues: readonly z.ZodIssue[]): { path: (string | number)[]; message: string }[] {
  const out: { path: (string | number)[]; message: string }[] = [];
  for (const issue of issues) {
    if (issue.code === z.ZodIssueCode.invalid_union && issue.unionErrors.length) {
      const at = issue.path.join('.');
      const best = [...issue.unionErrors].sort((a, b) => mismatch(a.issues, at) - mismatch(b.issues, at))[0];
      out.push(...flatten(best.issues));
    } else {
      out.push({ path: issue.path, message: issue.message });
    }
  }
  return out;
}

/** Branches that reject the payload's own keys at the union's position are the least likely match. */
function mismatch(issues: readonly z.ZodIssue[], at: string): number {
  return issues.reduce((score, i) => score + (i.code === z.ZodIssueCode.unrecognized_keys && i.path.join('.') === at ? 100 : 1), 0);
}
