# 新用户注册飞书群通知

Status: ready-for-agent

**日期**：2026-07-22
**来源**：Intake + grilling 共识
**相关术语**：新增注册、Auth success、Analytics event、Acquisition touch

---

## Problem Statement

产品运营负责人目前无法及时感知真实的新用户注册，也无法快速判断新增用户来自 Google、邮箱还是 Linux.do。现有 Analytics event 和后台统计适合事后分析，但不能在新账号首次成功进入产品时提供即时、可扫描的运营提醒。

需要在不影响注册与登录可靠性的前提下，把符合条件的新账号以简洁飞书群卡片通知给产品运营负责人。通知只承担新增注册感知，不承担客户跟进、安全告警或完整分析职责。

## Solution

当 Google、邮箱或 Linux.do 创建新账号时，系统先登记一条待通知记录；当该账号首次 Auth success 后，系统原子领取该记录并在登录响应完成后向配置好的飞书群机器人发送一张简洁卡片。同一账号至多发送一次。

Google 与邮箱卡片展示昵称、真实邮箱、注册渠道和北京时间；Linux.do 卡片展示用户名、Linux.do ID、注册渠道和北京时间，不展示系统生成的占位邮箱。飞书登录、未知渠道、老用户登录以及重复登录不发送通知。

通知采用尽力而为、至多一次的投递语义。飞书超时、拒绝或运行时中断都不能影响用户完成注册登录；失败会被标记并写入脱敏服务端日志，但不会自动重试。

## User Stories

1. As a product operator, I want a Feishu group notification when a Google user creates an account and first signs in, so that I can notice new registrations promptly.
2. As a product operator, I want a Feishu group notification when an email user creates an account and first signs in, so that I can notice direct email registrations promptly.
3. As a product operator, I want a Feishu group notification when a Linux.do user creates an account and first signs in, so that I can understand registrations from that community.
4. As a product operator, I want Feishu-login registrations excluded, so that the notification stream only contains the agreed acquisition channels.
5. As a product operator, I want unknown and future authentication providers excluded by default, so that new integrations do not silently change notification behavior.
6. As a product operator, I want existing users' later logins excluded, so that the group does not mistake returning users for new registrations.
7. As a product operator, I want repeated callbacks and later logins for the same account to produce no duplicate card, so that registration counts are not visually inflated.
8. As a product operator, I want email registrations to notify only after the user has successfully authenticated, so that unverified or abandoned signups do not appear as active new users.
9. As a product operator, I want delayed email verification to remain eligible for notification at the eventual first successful login, so that verification latency does not lose the registration signal.
10. As a product operator, I want each notification within one minute of the first successful login under normal operating conditions, so that the signal is operationally useful.
11. As a product operator, I want a concise card with a clear "new user registration" title, so that the message is easy to scan in a busy group.
12. As a product operator, I want Google and email cards to show the user's display name and real email, so that I can recognize the account.
13. As a product operator, I want Linux.do cards to show the Linux.do username and ID instead of a synthetic email, so that the identity is meaningful.
14. As a product operator, I want timestamps rendered in Asia/Shanghai time, so that the card matches my working timezone.
15. As a registering user, I want my successful login response to complete without waiting for Feishu, so that an operations integration cannot degrade my authentication experience.
16. As a registering user, I want authentication to succeed even when the Feishu webhook is unavailable, misconfigured, or slow, so that notification failure never becomes an account-access failure.
17. As a system operator, I want notification state to contain only identifiers, channel, status, and timestamps, so that user profile data is not unnecessarily duplicated.
18. As a system operator, I want failed sends logged without email, display name, Linux.do ID, Webhook URL, or signing secret, so that logs remain useful without leaking sensitive data.
19. As a system operator, I want the feature enabled by the presence of both required Feishu credentials, so that configuration is explicit without adding a separate feature flag.
20. As a system operator, I want a command-line test sender that produces a visibly marked test card, so that I can validate signing, credentials, and rendering before waiting for a real registration.
21. As a system operator, I want the test sender to avoid user creation and notification-state writes, so that configuration checks do not pollute production registration data.
22. As a developer, I want one server-side notification orchestration interface shared by all successful-authentication entry points, so that channel behavior, deduplication, and failure isolation cannot drift.

## Implementation Decisions

### Registration candidate and state model

- Add a server-owned notification table keyed uniquely by Auth user ID. It stores only the normalized provider, registration timestamp, status, and lifecycle timestamps.
- Supported states are `pending`, `claimed`, `sent`, and `failed`.
- A database trigger observes new Auth user rows and creates `pending` records only for the explicit provider allowlist: `google`, `email`, and `linuxdo`.
- Provider normalization accounts for the current Auth shapes: Supabase-managed Google, native email/password, and service-provisioned Linux.do accounts. Feishu identities take precedence over their synthetic email provider shape and are excluded.
- Unknown or future providers do not create candidates. Supporting a future provider requires an explicit allowlist and normalization change.
- The migration does not backfill existing Auth users. This prevents existing users from generating notifications on their next login.
- Candidate rows reference the Auth user and are removed when that user is deleted.
- Client access to notification state is denied. Database trigger execution and server-side service-role access are the only write paths.

### First-successful-login orchestration

- Introduce one server-only use case that accepts an authenticated Auth user after a successful login.
- Google OAuth callbacks, email post-login handling, email confirmation callbacks, and the Linux.do callback delegate to this same use case.
- The use case atomically changes the matching record from `pending` to `claimed`. A unique user key plus conditional state transition is the deduplication authority.
- A missing candidate is an expected no-op covering old users, excluded providers, repeated callbacks, and later logins.
- Claiming happens before the login response completes. The external Feishu request is scheduled with the supported Next.js post-response API so that webhook latency does not block navigation.
- Delivery semantics are deliberately at-most-once: once claimed, a record is never made pending again. A process interruption between claim and send may cause a missed notification but cannot cause a duplicate.
- A successful webhook response updates the state to `sent`; timeout, transport failure, invalid response, or Feishu rejection updates it to `failed` when the process remains available.
- If the post-response process terminates before final status persistence, the record may remain `claimed`. There is no stale-claim recovery in this version.
- Failure to read or mutate notification state is caught and logged; it never changes the Auth success response.

### Provider-specific presentation

- The delivery module converts an authenticated user into a provider-specific presentation model without persisting the presentation fields.
- Google and email notifications use the best available display name and real Auth email. If the display name is absent, use a stable human-readable fallback derived from available account metadata rather than rendering an empty field.
- Linux.do notifications use the stored Linux.do username and Linux.do ID. The synthetic `linuxdo.open-ox.local` email must never appear in the card.
- Card timestamps represent the original account registration time and are formatted in the `Asia/Shanghai` timezone.
- The card is concise and contains no buttons or follow-up workflow. Its title clearly identifies a new user registration, with fields for channel, user identity, and registration time.

### Feishu delivery and configuration

- Use a Feishu custom group bot Webhook. Signature verification is supported but optional.
- Read the Webhook URL and optional signing secret exclusively from server environment variables named `FEISHU_NEW_USER_WEBHOOK_URL` and `FEISHU_NEW_USER_WEBHOOK_SECRET`.
- There is no separate enable switch. Delivery is enabled when the Webhook URL is present; a missing URL produces a server-side configuration warning and otherwise behaves as a no-op.
- When a signing secret is configured, generate the Feishu request timestamp and signature server-side for each request.
- Apply a five-second HTTP timeout. Non-success HTTP responses and non-success Feishu response codes are failures.
- Do not retry failed notifications automatically.
- Logs may include Auth user ID, normalized provider, state transition, transport category, and Feishu error code. They must exclude profile fields, webhook credentials, signatures, and raw response bodies that may contain sensitive data.

### Operational test sender

- Provide a command-line-only test sender that reuses the production signature and card-delivery implementation.
- The test card is visibly labeled as a test and uses synthetic profile values.
- The test sender reads the same server environment variables but does not create an Auth user, claim a notification, or write notification state.
- Do not expose a public or admin HTTP endpoint solely for test delivery.

### Rollout

- Apply the database migration before deploying application code that invokes the orchestrator.
- Application code must treat a missing table or incompatible migration as a notification failure rather than an authentication failure. Absent bot configuration disables notification before a candidate is claimed.
- No existing Auth users are backfilled into notification state.

## Testing Decisions

- The primary test seam is the highest-level server-only use case: an Auth success enters with an authenticated user and observable outcomes are candidate state transitions, scheduling behavior, webhook requests, and final status. Login entry points remain thin adapters to this use case.
- Test behavior rather than private helper structure. Tests should assert whether a message is scheduled, what externally visible card is sent, and which durable state results; they should not lock internal function decomposition.
- Verify Google, email, and Linux.do candidates are claimed and rendered with their agreed provider-specific fields.
- Verify Feishu, unknown providers, users without candidates, already-claimed users, and later logins schedule no delivery.
- Verify delayed email confirmation can claim a still-pending candidate regardless of elapsed registration time.
- Verify competing claims for one user produce one winning delivery opportunity. The database unique key and conditional transition are the production concurrency authority.
- Verify a successful Feishu response yields `sent`, while timeout, transport failure, HTTP failure, and Feishu application-level rejection yield `failed` when status persistence remains possible.
- Verify all state and delivery failures are isolated from the successful authentication response.
- Verify signature generation against deterministic timestamp and secret fixtures.
- Verify card snapshots or structural assertions for Google, email, and Linux.do, including Asia/Shanghai formatting and the absence of synthetic Linux.do email.
- Verify missing or partial Feishu configuration produces no network call and no thrown authentication error.
- Verify logs are passed only redacted diagnostic fields; do not snapshot secrets or profile data.
- Use mocked HTTP for automated tests. No automated test may call the real Feishu Webhook.
- Reuse the repository's existing Vitest conventions for server modules and its existing mocked-`fetch` pattern for outbound HTTP clients.
- Run focused notification/auth tests and TypeScript checks during implementation. The feature touches several Auth success routes and shared database state, so run the full suite once before final delivery under the repository verification policy.
- Run the command-line test sender manually only when valid Feishu credentials are available; report this separately from automated verification.

## Out of Scope

1. Notifications for Feishu-login registrations.
2. Notifications for every login or returning-user activity.
3. Notifications for failed registrations, failed logins, password resets, or verification-email requests.
4. Automatic retries, queues, scheduled recovery, or replay of failed and stuck notifications.
5. At-least-once delivery guarantees or reconciliation against Auth user counts.
6. Backfilling or notifying existing users.
7. Customer follow-up workflows, CRM integration, assignments, comments, or card actions.
8. Security alerts, suspicious-login detection, or compliance monitoring.
9. Acquisition touch, UTM, referrer, project activity, Credits, or other analytics fields in the card.
10. A notification history UI, settings UI, admin resend control, or public test endpoint.
11. Private-message delivery to an individual Feishu account.
12. Multiple destination groups, per-provider routing, or configurable card templates.
13. Masking the agreed real email inside the designated operations group.

## Further Notes

- This notification is an operational projection of a new registration followed by Auth success. It does not replace the existing Analytics event stream or admin analytics definitions.
- The design intentionally prefers no duplicate over guaranteed delivery. A missed message is acceptable; duplicate notification is not.
- The designated Feishu group must be managed as an internal operations surface because Google and email cards contain real email addresses.
- The one-minute target is an expected normal-operation latency, not a retry-backed delivery service-level agreement.
- The command-line test sender is the production configuration acceptance check for Webhook reachability, signature correctness, and card rendering.

## Comments

- 2026-07-22: Intake and grilling complete; product scope, delivery semantics, test seam, and operational constraints confirmed.
