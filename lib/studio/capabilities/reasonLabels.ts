import type { StudioCapabilityReasonCode } from "./evaluateStudioCapabilities";

/** UI-facing Chinese labels for capability deny reasons (not part of the pure gate). */
export const STUDIO_CAPABILITY_REASON_LABELS: Record<
  StudioCapabilityReasonCode,
  string
> = {
  studio_loading: "项目加载中，请稍候",
  project_missing: "项目尚未准备就绪",
  awaiting_input: "请先完成需求确认后再操作",
  generation_in_progress: "项目仍在生成中",
  generation_failed: "生成失败，修复后才能继续",
  verification_failed: "构建验证未通过",
  verification_missing: "项目尚未通过构建验证",
  static_preview_missing: "静态预览尚未就绪，无法发布到社区",
  no_operable_artifact: "暂无可操作的项目产物",
};

export function studioCapabilityReasonLabel(
  reason: StudioCapabilityReasonCode
): string {
  return STUDIO_CAPABILITY_REASON_LABELS[reason];
}
