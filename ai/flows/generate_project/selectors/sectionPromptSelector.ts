import { hasSectionPrompt } from "../shared/files";

/**
 * Select section prompt by convention: section.{type}.md
 * If section.{type}.md exists, use it; otherwise fall back to section.default.
 * No manual registration required — add a file to use it.
 */
export function selectSectionPromptId(sectionType: string): string {
  const promptId = `section.${sectionType}`;
  return hasSectionPrompt(promptId) ? promptId : "section.default";
}
