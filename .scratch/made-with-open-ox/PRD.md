Status: ready-for-agent

# Made with Open OX 品牌入口与单项目白标买断

## Problem Statement

Open OX 用户发布的项目正在获得外部访问，但访客无法识别这些项目由 Open OX 创建。项目流量因此没有回流到 Open OX，平台错失品牌曝光、新用户获取和由作品驱动的持续裂变。与此同时，希望以自己品牌对外展示的项目所有者，需要一个价格清楚、一次购买、永久生效的单项目白标选项，而不是订阅或含糊的付费门槛。

## Solution

Open OX 在项目的每个公开静态页面右下角默认加入克制的 `Made with Open OX` 品牌入口。访客点击后进入 Open OX 创建落地页，并通过第一方归因参数进入“看到作品 → 发现 Open OX → 创建并发布自己的项目”的增长闭环。访客可在当前浏览中将入口收起；刷新或再次访问后恢复。

项目所有者可以使用现有充值余额，以每项目 80 Credits（按当前 0.25 美元/Credit 的基准价格等值 20 美元）一次性购买永久白标权益。权益绑定项目，而不是域名或某次构建；重新发布、重新 Deploy 或更换域名不重复收费。购买入口同时出现在发布/Deploy 流程和项目设置中。购买成功后，Open OX 更新该项目的公开静态产物；已有 Vercel 生产站点通过一次明确触发的重新 Deploy 应用白标状态。

首要业务目标是新增 Open OX 项目发布者数量，白标销售收入是辅助目标。

## User Stories

1. As an anonymous visitor, I want to see that a public project was made with Open OX, so that I can discover the tool used to create it.
2. As an anonymous visitor, I want the brand entry to take me to a creation-oriented Open OX landing page, so that I can start making a project instead of searching the product site.
3. As an anonymous visitor, I want the referral link to preserve the source of my visit, so that Open OX can understand which published projects create new builders.
4. As an anonymous visitor, I want the brand entry to remain compact and visually restrained, so that it does not distract from the project I came to use.
5. As an anonymous visitor, I want the brand entry to avoid mobile safe areas and common bottom navigation regions, so that it does not block the site’s primary controls.
6. As an anonymous visitor, I want to collapse the brand entry for my current browsing visit, so that I can continue using a site when the corner space is important.
7. As an anonymous visitor, I want a collapsed entry to remain available as a small Open OX mark, so that I can reopen or follow it later.
8. As an anonymous visitor, I expect the full brand entry to return after a refresh or a later visit, so that its dismissal is temporary rather than a hidden permanent preference.
9. As a keyboard user, I want the brand entry and collapse control to be focusable and clearly labelled, so that I can use them without a pointer.
10. As a screen-reader user, I want the entry’s purpose and external navigation behavior announced, so that the control is understandable without visual context.
11. As a project owner, I want every public page of my project to follow the same branding rule, so that deep links cannot produce inconsistent branding.
12. As a project owner, I want Studio previews and editing surfaces to remain free of the public brand entry, so that it does not interfere with authoring.
13. As a project owner, I want private, owner-only, administrative, and password-protection surfaces excluded, so that the public acquisition treatment is not shown out of context.
14. As a project owner, I want to see the `Made with Open OX` state before Publish Preview or Deploy, so that I understand what visitors will see.
15. As a project owner, I want to see a clearly priced “Remove Open OX branding — 80 Credits / $20 equivalent” option, so that the trade-off is explicit.
16. As a project owner, I want to buy white-label removal while publishing or deploying, so that I can choose the public presentation before launch.
17. As a project owner, I want to buy white-label removal later from project settings, so that missing the option at first launch is reversible.
18. As a project owner with enough balance, I want one confirmation to debit exactly 80 Credits and grant the project entitlement, so that the purchase is predictable.
19. As a project owner with insufficient balance, I want no partial debit and a clear route to top up, so that I do not lose Credits without receiving the entitlement.
20. As a project owner, I want repeated submissions or network retries to produce at most one charge, so that a purchase cannot be duplicated accidentally.
21. As a project owner, I want a receipt-like ledger entry tied to the project, so that I can understand why my balance changed.
22. As a project owner, I want the entitlement to remain after Publish Preview is turned off and on, so that I do not repurchase it.
23. As a project owner, I want the entitlement to remain through repeated Vercel Deploys and domain changes, so that it behaves as a project purchase.
24. As a project owner, I want soft deletion and restoration of the same project to preserve its entitlement, so that recovery does not erase a paid right.
25. As a project owner, I want a Remix to be treated as a new project without inherited white-label rights, so that purchases do not multiply through copies.
26. As a project owner, I want purchase success to update Publish Preview without another charge, so that the Community version loses the brand promptly.
27. As a project owner with an existing Vercel deployment, I want the purchase confirmation to explain and trigger the required redeploy, so that I know when the live site will change.
28. As a project owner, I want a failed rebuild or redeploy to preserve my purchased entitlement and provide a retry, so that delivery failure does not invalidate payment.
29. As a project owner, I want subsequent public builds to derive branding from the server-owned entitlement, so that a stale browser toggle cannot determine paid state.
30. As a project owner, I want the badge to avoid common right-corner widgets where possible, so that generated sites remain usable without manual layout work.
31. As an Open OX growth owner, I want badge impressions and clicks counted by source project, so that I can measure exposure and click-through rate.
32. As an Open OX growth owner, I want first-touch acquisition to recognize badge referrals, so that registrations and first successful project publications can be attributed consistently with existing analytics.
33. As an Open OX growth owner, I want to measure new project publishers per 1,000 public-project visits, so that the feature is judged by growth rather than vanity clicks.
34. As an Open OX growth owner, I want to measure white-label purchase conversion and revenue separately, so that auxiliary monetization does not obscure the acquisition goal.
35. As an Open OX growth owner, I want collapse rate and branding-related complaints monitored, so that aggressive exposure does not silently damage visitor experience.
36. As a privacy-conscious visitor, I want impression and click measurement to avoid unnecessary personal data, so that project attribution does not become cross-site visitor tracking.
37. As an Open OX operator, I want purchases to be auditable by user, project, amount, entitlement, and idempotency key, so that support and reconciliation are possible.
38. As an Open OX operator, I want an administratively approved refund to revoke the matching entitlement and restore branding on the next successful public artifact update, so that money and rights remain consistent.
39. As an Open OX operator, I want unauthorized callers to be unable to inspect or mutate another owner’s white-label purchase, so that project ownership remains the security boundary.
40. As an Open OX operator, I want existing published projects to receive branding the next time their managed preview or Vercel artifact is built, so that rollout does not require mutating third-party deployments behind owners’ backs.

## Implementation Decisions

- Use the established domain terms **Workspace**, **Credits**, **Publish Preview**, and **Deploy (Vercel BYO)**. Publish Preview and Deploy remain independent product axes as required by ADR-0002 and ADR-0003.
- Extend the meaning of Credits from AI build usage to an Open OX stored-value balance that can also buy durable product entitlements. The UI must show both `80 Credits` and `$20 equivalent`; the entitlement price is fixed at 80 Credits for this version and is not dynamically recalculated from environment pricing at checkout time.
- Introduce a server-owned, project-scoped white-label entitlement record with purchase time, purchasing owner, charged Credits, ledger reference, and an immutable purchase/idempotency identity. The active entitlement is unique per project.
- Add a dedicated `spend_brand_removal` ledger kind. The debit and entitlement grant must occur in one database transaction: exact balance check, exact 80-Credit debit, ledger append, and entitlement insert either all succeed or all fail. Do not reuse the existing usage-spend behavior that clamps a requested debit to the remaining balance.
- A purchase command requires authentication and current project ownership. It accepts a client-generated idempotency key; retrying the same purchase returns the existing result. A second purchase against an already-entitled project is a successful no-op and never charges again.
- The purchase response reports entitlement state, charged amount, remaining balance, and whether a public artifact refresh or Vercel redeploy was started. Insufficient balance returns a stable error code and the current balance without any mutation.
- Free welcome Credits and paid Credits share the current fungible balance and may both contribute to the 80-Credit purchase. No separate “paid Credits only” test is introduced in this version.
- White-label rights bind to the project ID. They survive Publish Preview changes, repeated builds, Vercel redeploys, production-domain changes, and soft-delete/restore. They do not transfer to a new Remix because Remix creates an independent project ID. A future project-ownership transfer, if introduced, carries the project entitlement with the same project ID.
- Public branding is applied at the final static-artifact boundary, after the project build and before the artifact is synchronized to Publish Preview storage or uploaded in Deploy. This is the shared seam for both public channels and ensures every exported HTML page receives the same policy regardless of user-authored layout structure.
- Artifact transformation injects a versioned, first-party badge shell, minimal styles, and behavior into every public HTML document when no active entitlement exists. It injects nothing when the entitlement is active. Re-running transformation is idempotent and replaces/removes older Open OX badge versions rather than duplicating them.
- The public badge reads `Made with Open OX`, opens the Open OX creation landing route, and uses a pseudonymous public attribution token rather than exposing internal owner information. Attribution uses the existing first-party acquisition model from ADR-0007, with a badge-specific source/campaign and the public project token as content detail.
- The badge is fixed to the bottom-right, honors CSS safe-area insets, has a constrained stacking level, and uses a small mobile variant. It must not flash, pulse, open a popup, cover the full width, or use a countdown.
- Dismissal is session-scoped. Collapsing stores only a same-tab/session preference and leaves a small, accessible Open OX mark; refresh or a later visit restores the full badge. It is not a durable substitute for the owner’s paid entitlement.
- Collision handling uses a conservative offset strategy and documented CSS custom properties that generated sites may honor. The badge must avoid known Open OX-generated bottom navigation patterns. General collision detection against arbitrary third-party widgets is best-effort rather than guaranteed.
- The badge is absent from Studio, editor preview shells, owner/admin surfaces, and password-protection shells. Only public static project documents are transformed.
- Purchasing from settings immediately records the entitlement. For Publish Preview, Open OX schedules a forced artifact refresh. For an existing Vercel production binding, the confirmation explicitly includes a redeploy and enqueues the normal asynchronous Deploy flow; this remains a user-initiated Deploy consistent with ADR-0003. If refresh or Deploy fails, the entitlement remains active and the UI presents a retry without charging.
- Existing third-party Vercel artifacts are not silently rewritten. They change on the next user-initiated Deploy or on the redeploy explicitly confirmed with the purchase. Existing Publish Preview artifacts are eligible for managed refresh.
- Add analytics events for badge impression, badge collapse, badge click, white-label purchase started/succeeded/failed, and public artifact branding refresh outcome. Impression/collapse/click payloads contain the public project attribution token, badge version, viewport class, and public channel, but no Open OX user ID, fingerprint, or arbitrary page content.
- Count at most one badge impression per page load. Badge navigation carries first-party acquisition parameters so the existing write-once First-touch acquisition binding remains the user-level source of truth; later badge clicks do not overwrite an earlier acquisition touch.
- Admin reporting adds the funnel: public project visit → badge impression → badge click → registration → first successful project publication, grouped by source project token and channel. The primary derived metric is new project publishers per 1,000 public-project visits. White-label units/revenue, collapse rate, refresh failures, and complaint tracking are secondary metrics.
- Refunds are an operator-mediated exception in this version. A refund records a compensating credit ledger entry, marks the entitlement revoked without deleting purchase history, and schedules the same public artifact refresh. Self-service refunds are not introduced.
- Rollout is forward-applying: newly built public artifacts use the policy immediately. Existing managed Publish Preview artifacts may be refreshed in a controlled backfill; existing Vercel artifacts wait for explicit redeploy. Rollout and artifact refresh must be observable and retryable.

## Testing Decisions

- Tests assert externally observable behavior and durable business invariants, not component structure, private helper calls, SQL statement order, or exact injected markup beyond the public contract.
- **Primary seam 1 — project brand entitlement purchase:** exercise the authenticated purchase command against a real database transaction boundary. Verify owner authorization, exact 80-Credit debit, entitlement creation, ledger linkage, insufficient-balance rollback, concurrent/double-submit idempotency, already-owned no-op behavior, refund revocation, and persistence across project lifecycle state changes. Existing billing account and ledger tests provide prior art, but this seam must specifically reject partial/clamped debit behavior.
- **Primary seam 2 — final public static artifact:** build or fixture a multipage static export and run the same artifact policy used by Publish Preview and Deploy. Verify every public HTML page contains one functional, accessible badge without entitlement; entitled artifacts contain no badge payload; repeated transformation creates no duplicate; hashed/static assets are untouched; and both public channels consume the same transformed result.
- Add a focused browser-level contract test for the injected badge: desktop and mobile placement, keyboard focus, accessible names, click destination and attribution parameters, session collapse behavior, refresh restoration, small collapsed mark, safe-area styling, and absence of blocking overlays.
- Add focused route/UI tests for purchase presentation: stable price copy, insufficient-balance top-up path, confirmation, successful balance refresh, already-purchased state, pending artifact refresh, failed refresh/redeploy retry, and no second charge.
- Add focused analytics tests following the existing acquisition and admin-funnel prior art: sanitize the public attribution token, emit one impression per load, preserve write-once First-touch acquisition, attribute later registration/publication, and calculate new publishers per 1,000 visits without treating missing acquisition as badge traffic.
- Add authorization tests proving non-owners cannot purchase, inspect private purchase metadata, trigger artifact refresh, revoke, or refund another project’s entitlement.
- Verification during implementation follows the repository policy: run the two focused seam suites and relevant TypeScript checks incrementally. Do not run the entire suite unless a later implementation changes shared build/deploy infrastructure broadly enough to justify the higher-risk verification.

## Out of Scope

- Custom badge text, destination, colors, typography, placement, or visual themes.
- Affiliate commissions, referral payouts, creator revenue sharing, or invite rewards.
- Account-wide, Workspace-wide, subscription-based, bundle, volume, coupon, or promotional white-label pricing.
- A permanent visitor-side dismissal or consent preference that substitutes for the owner’s entitlement.
- Badge popups, banners, flashing animation, forced waits, countdowns, or other attention traps.
- Branding on Studio, editor previews, owner/admin pages, password-protection shells, or other non-public product surfaces.
- Inheriting white-label entitlement when a project is Remixed into a new project.
- Automatically modifying an already-live third-party Vercel deployment without an explicit owner-confirmed Deploy.
- Guaranteed collision avoidance with every arbitrary widget a project author may add.
- Preventing a project owner from independently modifying assets after they leave the Open OX-managed build and deployment flow.
- Self-service refunds or a customer-facing entitlement-transfer workflow.

## Further Notes

- This PRD intentionally reopens one vocabulary boundary: current domain documentation describes Credits as AI build usage and says Publish/Deploy do not spend Credits. The approved product decision extends Credits to purchase a durable branding entitlement; Deploy itself remains free. Domain documentation should be updated alongside implementation so “Deploy costs no Credits” remains true while “white-label entitlement costs 80 Credits” is explicit.
- The current $20 equivalence assumes the established default of $0.25 per Credit. Customer-facing checkout copy must not drift if an environment-level model-cost conversion rate changes; product-entitlement pricing needs its own stable catalog constant.
- The growth hypothesis should be evaluated primarily through incremental new project publishers, not raw badge impressions. Initial targets should be set after collecting a baseline of public-project visits and current unattributed referral conversion.
- A purchased entitlement is durable even when its first artifact refresh fails. Payment state and delivery state are separate so retrying delivery can never cause a second debit.
