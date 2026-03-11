/**
 * Flow Registry - 预定义工作流
 */

import type { FlowStep } from "../types";
import articleWriterFlow from "./article_writer";

export const flows: Record<string, FlowStep[]> = {
  article_writer: articleWriterFlow,
};

export { articleWriterFlow } from "./article_writer";
