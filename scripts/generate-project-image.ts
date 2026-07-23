import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { generateArkImageBase64 } from "../lib/ark-image-generate";

const MAX_PROMPT_CHARS = 160;

interface CliOptions {
  projectRoot: string;
  filename: string;
  prompt: string;
  dryRun: boolean;
  force: boolean;
}

function usage(): string {
  return [
    "Generate an Ark image into a project's public/images directory.",
    "",
    "Usage:",
    "  pnpm image:generate --project-root <path> --filename <name> --prompt <text> [--dry-run] [--force]",
  ].join("\n");
}

function readValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function parseArgs(args: string[]): CliOptions {
  let projectRoot = process.cwd();
  let filename = "";
  let prompt = "";
  let dryRun = false;
  let force = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--project-root") {
      projectRoot = readValue(args, index, arg);
      index += 1;
    } else if (arg === "--filename") {
      filename = readValue(args, index, arg);
      index += 1;
    } else if (arg === "--prompt") {
      prompt = readValue(args, index, arg);
      index += 1;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--force") {
      force = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  const normalizedPrompt = prompt.replace(/\s+/g, " ").trim();
  if (!normalizedPrompt) throw new Error("--prompt is required");
  if (normalizedPrompt.length > MAX_PROMPT_CHARS) {
    throw new Error(`--prompt must be ${MAX_PROMPT_CHARS} characters or fewer`);
  }

  const normalizedFilename = filename
    .replace(/\.(png|jpe?g|webp|gif|avif)$/i, "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  if (!normalizedFilename) throw new Error("--filename is required");

  const resolvedRoot = resolve(projectRoot);
  if (!isAbsolute(resolvedRoot) || !existsSync(resolvedRoot)) {
    throw new Error(`Project root does not exist: ${resolvedRoot}`);
  }

  return {
    projectRoot: resolvedRoot,
    filename: normalizedFilename,
    prompt: normalizedPrompt,
    dryRun,
    force,
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const outputDirectory = join(options.projectRoot, "public", "images");
  const outputFile = join(outputDirectory, `${options.filename}.png`);
  const publicPath = `/images/${options.filename}.png`;

  if (existsSync(outputFile) && !options.force) {
    throw new Error(`Image already exists: ${outputFile}. Use --force to replace it.`);
  }

  if (options.dryRun) {
    console.log(JSON.stringify({ ok: true, dryRun: true, path: publicPath, outputFile }));
    return;
  }

  if (!process.env.ARK_API_KEY?.trim()) {
    throw new Error("ARK_API_KEY is not set");
  }

  const base64 = await generateArkImageBase64({ prompt: options.prompt, size: "1k" });
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0) throw new Error("Ark returned an empty image");

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputFile, buffer, { flag: options.force ? "w" : "wx" });
  console.log(JSON.stringify({ ok: true, path: publicPath, outputFile, bytes: buffer.length }));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exitCode = 1;
});
