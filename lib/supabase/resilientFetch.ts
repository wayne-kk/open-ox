/**
 * Retry transient network failures (e.g. undici "fetch failed" / "terminated")
 * for long-running workers polling Supabase.
 */
export function createResilientFetch(maxAttempts = 3): typeof fetch {
  return async (input, init) => {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fetch(input, init);
      } catch (err) {
        lastError = err;
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
        }
      }
    }
    throw lastError;
  };
}
