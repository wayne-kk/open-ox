/**
 * Whether Feishu OAuth can complete end-to-end (authorize → token → derived password → Supabase session).
 * Keep in sync with app/api/auth/feishu/start and callback requirements.
 */
export { isFeishuOAuthConfigured } from "@/lib/env";
