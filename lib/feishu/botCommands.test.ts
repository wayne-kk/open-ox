import { describe, expect, it } from "vitest";
import { feishuHelpText, parseFeishuBotMessage } from "./botCommands";

describe("parseFeishuBotMessage", () => {
  it("routes slash commands", () => {
    expect(parseFeishuBotMessage("/help")).toEqual({ kind: "help" });
    expect(parseFeishuBotMessage("  /status  ")).toEqual({ kind: "status" });
    expect(parseFeishuBotMessage("/clear")).toEqual({ kind: "clear" });
    expect(parseFeishuBotMessage("/use Acme")).toEqual({ kind: "use", query: "Acme" });
    expect(parseFeishuBotMessage("/use")).toEqual({ kind: "use", query: "" });
    expect(parseFeishuBotMessage("/projects")).toEqual({ kind: "projects" });
    expect(parseFeishuBotMessage("/换绑")).toEqual({ kind: "projects" });
  });

  it("treats unknown slash as unknown_slash", () => {
    expect(parseFeishuBotMessage("/model flash")).toEqual({
      kind: "unknown_slash",
      raw: "/model flash",
    });
  });

  it("treats plain text as modify_text", () => {
    expect(parseFeishuBotMessage("Hero 太吵，收一收")).toEqual({
      kind: "modify_text",
      text: "Hero 太吵，收一收",
    });
  });

  it("help text mentions core commands", () => {
    const t = feishuHelpText();
    expect(t).toContain("/help");
    expect(t).toContain("/projects");
    expect(t).toContain("/use");
    expect(t).toContain("/clear");
  });
});
