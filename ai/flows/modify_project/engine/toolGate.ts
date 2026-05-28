import { executeSystemTool } from "@/ai/tools";
import { assertModifyPathAllowed, type ModifyProfile } from "../profile/modifyProfile";
import { runScopedTypecheck } from "./verification";

const READ_ONLY_BLOCKED = new Set([
  "edit_file",
  "write_file",
  "revert_file",
  "run_scoped_tsc",
  "run_build",
  "generate_image",
  "install_package",
  "apply_workspace_edits",
]);

export type ProfiledToolExecutor = (
  name: string,
  args: Record<string, unknown>
) => Promise<{ success: boolean; output?: string; error?: string } | string>;

export function createProfiledToolExecutor(
  profile: ModifyProfile,
  touchedFiles: Set<string>
): ProfiledToolExecutor {
  return async (name: string, args: Record<string, unknown>) => {
    if (!profile.allowEdits && READ_ONLY_BLOCKED.has(name)) {
      return {
        success: false,
        error:
          "This modify session is read-only (Q&A). Use read_file / search_code / list_dir only. Ask the user to request edits in a follow-up message.",
      };
    }

    if (name === "write_file" && !profile.allowWriteFile) {
      return {
        success: false,
        error:
          "write_file is disabled for this modify profile. Use edit_file with exact old_string/new_string for surgical edits.",
      };
    }

    if (name === "run_build") {
      return {
        success: false,
        error:
          "run_build is not available during the edit loop. Fix type errors via edit_file; scoped typecheck runs at the end.",
      };
    }

    if (name === "run_scoped_tsc") {
      const files = [...touchedFiles];
      const result = await runScopedTypecheck(files);
      return result.passed
        ? { success: true, output: result.output }
        : { success: false, error: result.output };
    }

    if ((name === "edit_file" || name === "write_file") && typeof args.path === "string") {
      const blocked = assertModifyPathAllowed(profile, args.path);
      if (blocked) {
        return { success: false, error: blocked };
      }
    }

    const result = await executeSystemTool(name, args);

    if ((name === "edit_file" || name === "write_file") && typeof args.path === "string") {
      const ok = typeof result === "object" ? result.success : true;
      if (ok) {
        touchedFiles.add(args.path.replace(/\\/g, "/"));
      }
    }

    return result;
  };
}
