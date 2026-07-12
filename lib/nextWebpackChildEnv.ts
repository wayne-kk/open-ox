/**
 * Env for child processes that run `next build --webpack` / `next dev --webpack`.
 *
 * Studio's own `next dev` sets `TURBOPACK=1`. Next 16 refuses to start when that
 * env and `--webpack` are both present ("Multiple bundler flags set").
 */
export function envForNextWebpackChild(
  overrides: Partial<NodeJS.ProcessEnv> = {}
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, ...overrides };
  delete env.TURBOPACK;
  delete env.TURBO;
  delete env.NEXT_TURBOPACK;
  return env;
}
