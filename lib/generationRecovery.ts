/** Prefix stored in `projects.error` so Studio can offer continue vs full retry. */
export const RECOVERABLE_GENERATION_ERROR_PREFIX = "[recoverable]";

export function isRecoverableGenerationError(error: string | undefined): boolean {
  return Boolean(error?.startsWith(RECOVERABLE_GENERATION_ERROR_PREFIX));
}

export function recoverableGenerationErrorMessage(): string {
  return `${RECOVERABLE_GENERATION_ERROR_PREFIX} 生成未能完成（连接中断、页面关闭或后台任务停止）。可「继续生成」从检查点恢复，或「重新生成」从头开始（会清空当前构建进度）。`;
}

export function stripRecoverablePrefixForDisplay(error: string): string {
  if (error.startsWith(RECOVERABLE_GENERATION_ERROR_PREFIX)) {
    return error.slice(RECOVERABLE_GENERATION_ERROR_PREFIX.length).trim() || error;
  }
  return error;
}
