import { checkTsxFile, formatIssuesForHint, type TsxIssue } from "../../shared/tsxDiagnostics";
import type { StepTrace } from "../../types";

function validateSectionExports(
  tsx: string,
  componentName: string,
): NonNullable<StepTrace["validationResult"]> {
  const checks: Array<{ name: string; passed: boolean; detail?: string }> = [];
  checks.push({
    name: "non_empty",
    passed: tsx.trim().length > 0,
    detail: tsx.trim().length === 0 ? "Generated content is empty" : undefined,
  });
  const hasNamedExport = new RegExp(`export\\s+(function|const|class)\\s+${componentName}\\b`).test(tsx);
  const hasDefaultExport = /export\s+default\s+/.test(tsx);
  checks.push({
    name: "has_export",
    passed: hasNamedExport || hasDefaultExport,
    detail:
      !hasNamedExport && !hasDefaultExport
        ? `No export found for "${componentName}".`
        : undefined,
  });
  const hasJsx = /return\s*\(?\s*</.test(tsx);
  checks.push({ name: "has_jsx", passed: hasJsx, detail: !hasJsx ? "No JSX return statement found" : undefined });
  return { passed: checks.every((c) => c.passed), checks };
}

export interface SectionValidationOutcome {
  result: NonNullable<StepTrace["validationResult"]>;
  tscIssues: TsxIssue[];
}

/**
 * - "advisory" (default): tsc issues are in trace; errors alone do not fail validation or trigger retry.
 * - "strict": tsc errors fail validation and trigger the section retry loop.
 */
function getSectionTscMode(): "advisory" | "strict" {
  return process.env.SECTION_TSC_MODE === "strict" ? "strict" : "advisory";
}

export async function validateSection(
  tsx: string,
  componentName: string,
  relativePath: string,
): Promise<SectionValidationOutcome> {
  const base = validateSectionExports(tsx, componentName);
  const checks = [...base.checks];

  let tscIssues: TsxIssue[] = [];
  if (base.passed) {
    const tsc = await checkTsxFile(relativePath);
    if (tsc.skipped === "disabled") {
      // Opt-out: keep trace shape stable.
    } else if (tsc.skipped) {
      checks.push({
        name: "tsc_ok",
        passed: true,
        detail: `tsc check skipped (${tsc.skipped}${tsc.skippedDetail ? `: ${tsc.skippedDetail}` : ""})`,
      });
    } else {
      tscIssues = tsc.issues;
      if (tsc.errorCount === 0) {
        const summary =
          tsc.warningCount > 0 ? `tsc passed with ${tsc.warningCount} warning(s)` : undefined;
        checks.push({ name: "tsc_ok", passed: true, detail: summary });
      } else if (getSectionTscMode() === "strict") {
        checks.push({
          name: "tsc_ok",
          passed: false,
          detail: `tsc found ${tsc.errorCount} error(s):\n${formatIssuesForHint(tsc.issues)}`,
        });
      } else {
        checks.push({
          name: "tsc_advisory",
          passed: true,
          detail: `tsc found ${tsc.errorCount} error(s) (advisory; not retrying):\n${formatIssuesForHint(tsc.issues)}`,
        });
      }
    }
  }

  return {
    result: { passed: checks.every((c) => c.passed), checks },
    tscIssues,
  };
}

export function buildRetryHint(
  componentName: string,
  previousIssues: TsxIssue[],
  previousValidation: NonNullable<StepTrace["validationResult"]> | null,
): string {
  const structuralFailures =
    previousValidation?.checks.filter((c) => !c.passed && c.name !== "tsc_ok") ?? [];
  const tscHint = formatIssuesForHint(previousIssues);

  const parts: string[] = [];
  if (structuralFailures.length > 0) {
    parts.push(
      `Your previous response was truncated/incomplete — the component "${componentName}" was missing its export or JSX return. Output the COMPLETE component with \`export function ${componentName}\` and a JSX return.`,
    );
  }
  if (tscHint) {
    parts.push(
      `Your previous output failed TypeScript checking. Fix these errors EXACTLY and regenerate the complete component:\n${tscHint}`,
    );
  }
  if (parts.length === 0) {
    parts.push(
      `Your previous output failed validation. Regenerate a complete, type-safe \`${componentName}\` component.`,
    );
  }
  parts.push("Keep it concise. Do not emit markdown fences, commentary, or partial code.");
  return `\n\nIMPORTANT: ${parts.join("\n\n")}`;
}

/**
 * How many *extra* full generation attempts are allowed after the first (0 = one attempt only, default 1 = two attempts).
 * Parsed from `SECTION_GENERATE_RETRIES`; invalid values fall back to 1.
 */
export function getSectionMaxRetries(): number {
  const raw = process.env.SECTION_GENERATE_RETRIES;
  if (raw === undefined || raw === "") {
    return 1;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) {
    return 1;
  }
  return Math.min(10, n);
}
