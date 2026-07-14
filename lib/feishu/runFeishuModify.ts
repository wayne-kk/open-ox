import type { SupabaseClient } from "@supabase/supabase-js";
import { schedulePostModifyPreviewPipeline } from "@/lib/postGenerationPreviewPipeline";
import { captureProjectHomepageJpeg } from "@/lib/projectCoverCapture";
import { getProject } from "@/lib/projectManager";
import { runHeadlessModifyTurn } from "@/lib/modify/runHeadlessModifyTurn";
import { getFeishuActiveProject } from "./activeProject";
import {
  clearContinuationSuppress,
  shouldSuppressContinuation,
} from "./continuationSuppress";
import {
  replyFeishuImageMessage,
  replyFeishuTextMessage,
  uploadFeishuImage,
} from "./openApi";

const AWAITING_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Feishu text Modify loop: ack → headless Modify → completion + Studio deep link.
 * Best-effort homepage screenshot (issue 05); never fails the Modify on capture errors.
 */
export async function runFeishuModifyFromDm(params: {
  db: SupabaseClient;
  userId: string;
  instruction: string;
  messageId: string;
  studioOrigin: string;
}): Promise<void> {
  const { db, userId, instruction, messageId, studioOrigin } = params;

  const active = await getFeishuActiveProject(db, userId);
  if (!active.projectId) {
    await replyFeishuTextMessage({
      messageId,
      text: "当前未设置飞书项目。请在 Studio 打开项目，点击顶栏「飞书」设为当前项目。",
    });
    return;
  }

  const projectLabel = active.projectName ?? active.projectId;
  await replyFeishuTextMessage({
    messageId,
    text: `已收到，正在改《${projectLabel}》…`,
  });

  let forceFreshInstruction = shouldSuppressContinuation(userId);
  if (forceFreshInstruction) {
    clearContinuationSuppress(userId);
  }

  const project = await getProject(db, active.projectId);
  const last = project?.modificationHistory?.at(-1);
  if (last?.modifiedAt) {
    const age = Date.now() - new Date(last.modifiedAt).getTime();
    if (age > AWAITING_TIMEOUT_MS) {
      forceFreshInstruction = true;
    }
  }

  const result = await runHeadlessModifyTurn(db, {
    userId,
    projectId: active.projectId,
    instruction,
    forceFreshInstruction,
  });

  if (!result.ok) {
    if (result.code === "MODIFY_IN_FLIGHT") {
      await replyFeishuTextMessage({
        messageId,
        text: `《${projectLabel}》正在修改中，请稍后再试。\n${studioOrigin}/studio/${active.projectId}`,
      });
      return;
    }
    if (result.code === "INSUFFICIENT_CREDITS") {
      await replyFeishuTextMessage({
        messageId,
        text: `积分不足（余额 ${result.balance ?? 0}，Modify 至少需要 ${result.required ?? 0.5}）。\n去充值：${studioOrigin}/pricing`,
      });
      return;
    }
    await replyFeishuTextMessage({
      messageId,
      text: `修改失败：${result.message}\n${studioOrigin}/studio/${active.projectId}`,
    });
    return;
  }

  if (result.touchedFiles.length > 0) {
    schedulePostModifyPreviewPipeline(db, active.projectId, { buildPassed: true });
  }

  const summary =
    result.assistantText.length > 1200
      ? `${result.assistantText.slice(0, 1200)}…`
      : result.assistantText;
  const deepLink = `${studioOrigin}/studio/${active.projectId}`;
  const awaitHint = result.awaitingReply
    ? "\n\n（我在等你补充；30 分钟内下一条会当作续写。/clear 可取消）"
    : "";

  await replyFeishuTextMessage({
    messageId,
    text: `《${projectLabel}》已处理。\n\n${summary}${awaitHint}\n\n打开 Studio：${deepLink}`,
  });

  try {
    const jpeg = await captureProjectHomepageJpeg(db, active.projectId);
    if (jpeg) {
      const imageKey = await uploadFeishuImage(jpeg);
      await replyFeishuImageMessage({ messageId, imageKey });
    }
  } catch (err) {
    console.warn(
      "[feishu] preview screenshot reply skipped:",
      err instanceof Error ? err.message : err
    );
  }
}
