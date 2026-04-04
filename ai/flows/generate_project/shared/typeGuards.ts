/**
 * Shared type guard utilities for the generate_project flow.
 * Centralizes common runtime type checks to avoid duplication across steps.
 */

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
