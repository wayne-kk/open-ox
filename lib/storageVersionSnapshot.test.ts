import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import { afterEach, describe, expect, it } from "vitest";
import { buildProjectZipBuffer } from "./storage";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("project version snapshot archive", () => {
  it("round-trips text and binary source files", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "open-ox-snapshot-test-"));
    roots.push(root);
    await fs.mkdir(path.join(root, "app"), { recursive: true });
    await fs.mkdir(path.join(root, "public"), { recursive: true });
    await fs.writeFile(path.join(root, "app", "page.tsx"), "export default function Page() {}\n");
    await fs.writeFile(path.join(root, "public", "image.bin"), Buffer.from([0, 1, 2, 255]));

    const archive = await buildProjectZipBuffer(root, ["public/image.bin", "app/page.tsx"]);
    const zip = new AdmZip(archive);

    expect(zip.readAsText("app/page.tsx")).toContain("function Page");
    expect([...zip.readFile("public/image.bin")!]).toEqual([0, 1, 2, 255]);
  });
});
