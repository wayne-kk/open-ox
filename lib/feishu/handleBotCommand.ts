import type { SupabaseClient } from "@supabase/supabase-js";
import { listProjectsSummary } from "@/lib/projectManager";
import {
  getFeishuActiveProject,
  setFeishuActiveProject,
} from "./activeProject";
import { feishuHelpText, parseFeishuBotMessage } from "./botCommands";
import { suppressContinuation } from "./continuationSuppress";

export type FeishuBotReply = {
  text: string;
  /** When true, caller should not start Modify (issue 04). */
  skipModify: boolean;
};

function studioHint(): string {
  return "在 Studio 打开项目，点顶栏「飞书改」可一键绑定并打开机器人。";
}

async function listOwnedProjects(db: SupabaseClient, userId: string) {
  return listProjectsSummary(db, {
    filterOwnerUserId: userId,
    limit: 50,
  });
}

function formatProjectList(
  projects: Array<{ id: string; name: string }>,
  activeId: string | null
): string {
  if (projects.length === 0) {
    return "你还没有项目。先在网站生成一个站，再回来换绑。";
  }
  const lines = projects.map((p, i) => {
    const mark = p.id === activeId ? " ← 当前" : "";
    return `${i + 1}. ${p.name}${mark}\n   id: \`${p.id}\``;
  });
  return [
    "可换绑的项目：",
    ...lines,
    "",
    "发送 `/use 1` 或 `/use 项目名` 切换。",
  ].join("\n");
}

async function resolveUseQuery(
  db: SupabaseClient,
  userId: string,
  query: string
): Promise<FeishuBotReply> {
  const projects = await listOwnedProjects(db, userId);
  const q = query.trim();

  if (!q) {
    const active = await getFeishuActiveProject(db, userId);
    return {
      text: formatProjectList(projects, active.projectId),
      skipModify: true,
    };
  }

  // `/use 1` → index
  if (/^\d+$/.test(q)) {
    const idx = Number.parseInt(q, 10) - 1;
    const byIndex = projects[idx];
    if (!byIndex) {
      return {
        text: `没有序号 ${q}。先发 /projects 查看列表。`,
        skipModify: true,
      };
    }
    const result = await setFeishuActiveProject(db, userId, byIndex.id);
    if (!result.ok) {
      return { text: `无法切换：${result.message}`, skipModify: true };
    }
    return {
      text: `已换绑为「${result.projectName ?? byIndex.id}」。直接说要改什么吧。`,
      skipModify: true,
    };
  }

  const byId = projects.find((p) => p.id === q);
  const lowered = q.toLowerCase();
  const byName = projects.filter((p) => p.name.toLowerCase() === lowered);
  const byPartial = projects.filter((p) => p.name.toLowerCase().includes(lowered));

  const hit = byId ?? (byName.length === 1 ? byName[0] : undefined);
  const partialHit = !hit && byPartial.length === 1 ? byPartial[0] : undefined;
  const target = hit ?? partialHit;

  if (!target) {
    if (byName.length > 1 || byPartial.length > 1) {
      const list = (byName.length > 1 ? byName : byPartial)
        .slice(0, 8)
        .map((p, i) => `${i + 1}. ${p.name} (\`${p.id}\`)`)
        .join("\n");
      return {
        text: `匹配到多个项目：\n${list}\n\n请用 /use <完整 id> 或更精确的名字。`,
        skipModify: true,
      };
    }
    return {
      text: `未找到「${q}」。发 /projects 查看可换绑列表。`,
      skipModify: true,
    };
  }

  const result = await setFeishuActiveProject(db, userId, target.id);
  if (!result.ok) {
    return { text: `无法切换：${result.message}`, skipModify: true };
  }
  return {
    text: `已换绑为「${result.projectName ?? target.id}」。直接说要改什么吧。`,
    skipModify: true,
  };
}

/**
 * Handle Feishu DM text for the command surface.
 * Plain modify_text returns skipModify:false so Modify can run.
 */
export async function handleFeishuBotText(params: {
  db: SupabaseClient;
  userId: string;
  text: string;
  /** When false, plain text says modify is not enabled yet. */
  modifyEnabled?: boolean;
}): Promise<FeishuBotReply> {
  const { db, userId, text } = params;
  const modifyEnabled = params.modifyEnabled === true;
  const cmd = parseFeishuBotMessage(text);

  switch (cmd.kind) {
    case "help":
      return { text: feishuHelpText(), skipModify: true };
    case "status": {
      const active = await getFeishuActiveProject(db, userId);
      if (!active.projectId) {
        return {
          text: `当前未绑定项目。\n发 /projects 换绑，或${studioHint()}`,
          skipModify: true,
        };
      }
      return {
        text: `当前项目：${active.projectName ?? "(unnamed)"}\n\`${active.projectId}\`\n\n换绑：/projects`,
        skipModify: true,
      };
    }
    case "projects": {
      const active = await getFeishuActiveProject(db, userId);
      const projects = await listOwnedProjects(db, userId);
      return {
        text: formatProjectList(projects, active.projectId),
        skipModify: true,
      };
    }
    case "clear":
      suppressContinuation(userId);
      return {
        text: "已忽略当前等待中的追问；下一条文本将作为新的 Modify 指令。",
        skipModify: true,
      };
    case "use":
      return resolveUseQuery(db, userId, cmd.query);
    case "unknown_slash":
      return {
        text: `未知命令。\n\n${feishuHelpText()}`,
        skipModify: true,
      };
    case "modify_text": {
      if (!cmd.text.trim()) {
        return { text: "请发送修改说明，或输入 /help。", skipModify: true };
      }
      if (!modifyEnabled) {
        return {
          text: "Modify 未启用。可用 /help /projects /use /status。",
          skipModify: true,
        };
      }
      return { text: cmd.text, skipModify: false };
    }
  }
}
