import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult, ToolExecutor } from "../types";
import { resolvePath } from "./common";

export const editFileTool: ChatCompletionTool = {
    type: "function",
    function: {
        name: "edit_file",
        description:
            "Make a precise edit to a file by replacing an exact string match. " +
            "Use old_string to match existing content and new_string to replace it. " +
            "For creating new files, use write_file instead. " +
            "old_string must match EXACTLY one location in the file (including whitespace and indentation).",
        parameters: {
            type: "object",
            properties: {
                path: {
                    type: "string",
                    description: "Relative path from project root (e.g. components/sections/home_HeroSection.tsx)",
                },
                old_string: {
                    type: "string",
                    description: "The exact string to find in the file. Must match exactly one location.",
                },
                new_string: {
                    type: "string",
                    description: "The replacement string. Use empty string to delete the matched content.",
                },
            },
            required: ["path", "old_string", "new_string"],
        },
    },
};

export const executeEditFile: ToolExecutor = async (
    args: Record<string, unknown>
): Promise<ToolResult | string> => {
    const filePath = args.path as string;
    const oldStr = args.old_string as string;
    const newStr = args.new_string as string;

    if (!oldStr) {
        return { success: false, error: "old_string cannot be empty. Use write_file to create new files." };
    }

    const fullPath = resolvePath(filePath);

    if (!existsSync(fullPath)) {
        return { success: false, error: `File not found: ${filePath}` };
    }

    const content = readFileSync(fullPath, "utf-8");

    // Count occurrences
    const occurrences = content.split(oldStr).length - 1;

    if (occurrences === 0) {
        // Provide helpful context: show first 200 chars of file
        const preview = content.slice(0, 200).replace(/\n/g, "\\n");
        return {
            success: false,
            error: `old_string not found in ${filePath}. File starts with: "${preview}..."`,
        };
    }

    if (occurrences > 1) {
        return {
            success: false,
            error: `old_string matches ${occurrences} locations in ${filePath}. Make old_string more specific (include surrounding lines for uniqueness).`,
        };
    }

    const newContent = content.replace(oldStr, newStr);
    const dir = dirname(fullPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(fullPath, newContent, "utf-8");

    const addedLines = newStr.split("\n").length;
    const removedLines = oldStr.split("\n").length;

    return {
        success: true,
        output: `Edited ${filePath}: replaced ${removedLines} line(s) with ${addedLines} line(s)`,
        meta: { path: filePath, addedLines, removedLines },
    };
};
