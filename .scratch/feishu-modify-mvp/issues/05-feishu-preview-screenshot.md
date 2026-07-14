# 05 — Feishu completion homepage preview screenshot

Status: resolved

## Parent

`.scratch/feishu-modify-mvp/PRD.md`

## What to build

On successful Feishu Modify completion, capture a **homepage viewport** preview screenshot (reuse existing cover/homepage capture approach where practical) and attach it to the Feishu completion message along with the text summary and Studio deep link. If capture or upload/send fails, still send the text + deep link completion (degrade; do not fail the Modify or hide success).

No multi-page guessing, no before/after pairs, no step progress screenshots.

## Acceptance criteria

- [x] Successful Feishu Modify completion includes a homepage viewport image when capture succeeds
- [x] When capture or Feishu image send fails, user still gets text completion + Studio deep link
- [x] Screenshot failure does not roll back Modify, History, or Credits charging
- [x] No additional screenshots beyond the single homepage viewport in this MVP

## Blocked by

- `.scratch/feishu-modify-mvp/issues/04-feishu-text-modify-loop.md`

## Answer

- `captureProjectHomepageJpeg` in `projectCoverCapture` (fail-open).
- After text completion, `uploadFeishuImage` + `replyFeishuImageMessage`; errors logged only.
