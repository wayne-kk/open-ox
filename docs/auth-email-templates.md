# Open-OX Auth Email Templates

Supabase Auth email templates live in the hosted Supabase Dashboard:

`Authentication -> Email Templates`

Paste the HTML files from `supabase/email-templates/` into the matching Supabase template.

## Required URLs

Set these before testing email links:

- Site URL: `https://wayne.xin`
- Redirect URLs:
  - `https://wayne.xin/auth/callback`
  - `http://localhost:3000/auth/callback`

The app also has proxy fallbacks for root-level `?code=...` and `otp_expired`, but the Dashboard should still point users directly at `/auth/callback`.

## Templates

| Supabase template | Subject | File |
| --- | --- | --- |
| Confirm sign up | `确认你的 Open-OX 邮箱` | `supabase/email-templates/confirm-signup.html` |
| Reset password | `重置你的 Open-OX 密码` | `supabase/email-templates/reset-password.html` |
| Magic link or OTP | `登录 Open-OX` | `supabase/email-templates/magic-link.html` |
| Invite user | `加入 Open-OX` | `supabase/email-templates/invite-user.html` |

## Variables Used

These templates intentionally use `{{ .ConfirmationURL }}` for the primary button. Supabase generates this one-time URL and redirects back through the configured redirect URL after verification.

Useful Supabase variables:

- `{{ .ConfirmationURL }}`: one-time confirmation/recovery/login URL.
- `{{ .SiteURL }}`: configured application Site URL.
- `{{ .RedirectTo }}`: redirect URL passed from the app when calling Supabase Auth.
- `{{ .Email }}`: recipient email address.
- `{{ .Data }}`: `auth.users.user_metadata` for personalization.

Reference: https://supabase.com/docs/guides/auth/auth-email-templates

## Testing Checklist

1. Update Site URL and Redirect URLs in Supabase.
2. Paste the `Confirm sign up` template and subject.
3. Register a new email address in Open-OX.
4. Confirm the link points to Supabase Auth and includes `redirect_to=https://wayne.xin/auth/callback...`.
5. Click it once and confirm the browser ends on `/dashboard`.
6. Try an old email link and confirm it lands on `/auth?error=otp_expired`.
