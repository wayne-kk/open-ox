/**
 * Whether Feishu OAuth can complete end-to-end (authorize → token → derived password → Supabase session).
 * Keep in sync with app/api/auth/feishu/start and callback requirements.
 */
export function isFeishuOAuthConfigured(): boolean {
  const id = process.env.FEISHU_APP_ID?.trim();
  const secret = process.env.FEISHU_APP_SECRET?.trim();
  const hmac = process.env.FEISHU_OAUTH_HMAC_SECRET?.trim();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return Boolean(id && secret && hmac && serviceRole);
}
