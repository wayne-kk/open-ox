import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { JsonlContextEventStore } from "./jsonlEventStore";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("JsonlContextEventStore", () => {
  it("appends concurrently without losing sequence order and reloads from disk", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "agent-context-"));
    roots.push(root);
    const store = new JsonlContextEventStore(root);
    await Promise.all([
      store.append("intent:demo", [{ kind: "user_message", content: "one" }]),
      store.append("intent:demo", [{ kind: "user_message", content: "two" }]),
    ]);
    const reloaded = await new JsonlContextEventStore(root).read("intent:demo");
    expect(reloaded.map((event) => event.sequence)).toEqual([1, 2]);
    expect(reloaded.map((event) => event.kind)).toEqual(["user_message", "user_message"]);
  });

  it("externalizes large payloads to content-addressed blobs and hydrates them on read", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "agent-context-"));
    roots.push(root);
    const source = "x".repeat(40_000);
    const store = new JsonlContextEventStore(root);
    await store.append("intent:blob", [{ kind: "assistant_tool_calls", content: null, calls: [{
      id: "write-1", name: "write_file", argumentsJson: JSON.stringify({ path: "app/page.tsx", content: source }),
    }] }]);
    const jsonl = await fs.readFile(path.join(root, "intent%3Ablob.jsonl"), "utf8");
    expect(jsonl).not.toContain(source);
    expect(jsonl).toContain("$agentContextBlob");
    expect(JSON.stringify(await store.read("intent:blob"))).toContain(source);
    expect((await fs.readdir(path.join(root, "blobs"))).length).toBeGreaterThan(0);
  });
});
