import { describe, expect, it } from "vitest";
import { legacyMessagesToEvents } from "./legacyMessages";

describe("legacyMessagesToEvents", () => {
  it("converts a tool exchange with its original name and arguments", () => {
    const events = legacyMessagesToEvents([
      { role: "system", content: "Build." },
      { role: "user", content: "Read." },
      {
        role: "assistant",
        content: null,
        tool_calls: [{
          id: "read-1",
          type: "function",
          function: { name: "read_file_snapshot", arguments: '{"path":"app/page.tsx"}' },
        }],
      },
      { role: "tool", tool_call_id: "read-1", content: '{"success":true,"output":"source"}' },
    ]);

    expect(events.map((event) => event.kind)).toEqual([
      "instruction",
      "user_message",
      "assistant_tool_calls",
      "tool_result",
    ]);
    expect(events[3]).toMatchObject({
      kind: "tool_result",
      callId: "read-1",
      toolName: "read_file_snapshot",
      arguments: { path: "app/page.tsx" },
      result: { success: true, output: "source" },
    });
  });
});
