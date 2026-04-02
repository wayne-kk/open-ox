/**
 * AI API - POST /api/ai
 *
 * 返回 text/event-stream (SSE)，每个 step 完成立即推送：
 *   data: {"type":"step", ...BuildStep}\n\n
 *   data: {"type":"done", "result": ProcessResult}\n\n
 *   data: {"type":"error", "message": string}\n\n
 */

import { runGenerateProject } from "@/ai/flows";
import { createProject, getProject, initProjectDir, updateProjectStatus, renameProject } from "@/lib/projectManager";
import { uploadGeneratedFiles } from "@/lib/storage";
import { setRuntimeModelId, type ModelId } from "@/lib/config/models";
import type { BuildStep } from "@/ai/flows";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Accept both "userPrompt" (new) and "input" (legacy) field names
    const userPrompt: unknown = body.userPrompt ?? body.input;
    const modelOverride: string | undefined = body.model;
    const retryProjectId: string | undefined = body.retryProjectId;

    // For retry: load existing project's prompt and model
    let effectivePrompt = userPrompt as string | undefined;
    let effectiveModel = modelOverride;
    if (retryProjectId) {
      const existing = await getProject(retryProjectId);
      if (!existing) {
        return NextResponse.json({ error: "Project not found for retry" }, { status: 404 });
      }
      effectivePrompt = existing.userPrompt;
      // Use the model from the request, or fall back to the project's saved model
      if (!effectiveModel && existing.modelId) {
        effectiveModel = existing.modelId;
      }
    }

    // Set runtime model
    if (effectiveModel) {
      setRuntimeModelId(effectiveModel as ModelId);
    }

    if (!effectivePrompt || typeof effectivePrompt !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'userPrompt' field" },
        { status: 400 }
      );
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: Record<string, unknown>) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)
          );
        };

        // Step 1: Create or reuse project
        let projectId: string;
        if (retryProjectId) {
          projectId = retryProjectId;
          await updateProjectStatus(projectId, "generating", { error: undefined });
        } else {
          const project = await createProject(effectivePrompt, effectiveModel);
          projectId = project.id;
        }

        try {
          // Step 2: Scaffold project directory from template (skip for retry — dir already exists)
          if (!retryProjectId) {
            await initProjectDir(projectId);
          }

          // Step 3: Run generation, writing files into sites/{projectId}/
          const result = await runGenerateProject(effectivePrompt, (step: BuildStep) => send({ type: "step", ...step }), { projectId });

          if (result.success) {
            // Step 4: Upload generated files to Supabase Storage (non-blocking)
            uploadGeneratedFiles(projectId, result.generatedFiles ?? []).catch((err) =>
              console.error("[AI API] Storage upload failed:", err)
            );

            // Step 5: Mark project as ready
            await updateProjectStatus(projectId, "ready", {
              completedAt: new Date().toISOString(),
              verificationStatus: result.verificationStatus,
              blueprint: result.blueprint,
              buildSteps: result.steps,
              generatedFiles: result.generatedFiles,
              logDirectory: result.logDirectory,
            });

            // Step 6: Update project name from blueprint's projectTitle
            const projectTitle = (result.blueprint as { brief?: { projectTitle?: string } })?.brief?.projectTitle;
            if (projectTitle && projectTitle.trim()) {
              await renameProject(projectId, projectTitle.trim());
            }
          } else {
            // Generation completed but reported failure
            await updateProjectStatus(projectId, "failed", {
              error: result.error ?? "Generation failed",
            });
          }

          // Build response content matching the legacy processInput shape
          const fileSummary = `生成了 ${result.generatedFiles.length} 个文件：\n${result.generatedFiles.join("\n")}`;
          const logSummary = result.logDirectory ? `\n\n日志目录：${result.logDirectory}` : "";
          const installedSummary =
            result.installedDependencies.length > 0
              ? `\n\n自动安装依赖：${result.installedDependencies.map((item) => item.packageName).join(", ")}`
              : "";
          const installFailureSummary =
            result.dependencyInstallFailures.length > 0
              ? `\n\n依赖安装失败：${result.dependencyInstallFailures
                .map((item) => `${item.packageName} (${item.error})`)
                .join("; ")}`
              : "";

          const content = result.success
            ? result.verificationStatus === "passed"
              ? `项目构建完成并通过校验。\n${fileSummary}${installedSummary}${installFailureSummary}${logSummary}`
              : `项目文件已写入正式目录，但当前未通过校验，相关生成文件已标记。\n${fileSummary}${installedSummary}${installFailureSummary}${logSummary}`
            : `项目生成失败：${result.error}`;

          send({
            type: "done",
            result: {
              content,
              projectId,
              generatedFiles: result.generatedFiles,
              blueprint: result.blueprint,
              verificationStatus: result.verificationStatus,
              unvalidatedFiles: result.unvalidatedFiles,
              installedDependencies: result.installedDependencies,
              dependencyInstallFailures: result.dependencyInstallFailures,
              buildSteps: result.steps,
              logDirectory: result.logDirectory,
              buildTotalDuration: result.totalDuration,
            },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Internal error";
          // initProjectDir already sets status to "failed" on its own errors,
          // but we also handle runGenerateProject errors here.
          try {
            await updateProjectStatus(projectId, "failed", { error: message });
          } catch {
            // best-effort — don't mask the original error
          }
          send({ type: "error", message });
        } finally {
          setRuntimeModelId(null);
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("[AI API]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
