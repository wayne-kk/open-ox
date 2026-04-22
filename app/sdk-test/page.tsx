"use client";

import { useState, useCallback } from "react";

interface StepEvent {
    step: string;
    status: "ok" | "error" | "active";
    detail?: string;
    duration?: number;
}

interface TestResult {
    importTest: { passed: boolean; detail: string };
    typesTest: { passed: boolean; detail: string };
    configTest: { passed: boolean; detail: string };
    adapterTest: { passed: boolean; detail: string };
    serverTest: { passed: boolean; detail: string };
}

export default function SDKTestPage() {
    const [result, setResult] = useState<TestResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [generatePrompt, setGeneratePrompt] = useState("A simple landing page for a coffee shop");
    const [generateSteps, setGenerateSteps] = useState<StepEvent[]>([]);
    const [generateResult, setGenerateResult] = useState<string>("");
    const [generating, setGenerating] = useState(false);

    const runTests = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/sdk-test");
            const data = await res.json();
            setResult(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    const runGenerate = useCallback(async () => {
        setGenerating(true);
        setGenerateSteps([]);
        setGenerateResult("");

        try {
            const res = await fetch("/api/sdk-test/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: generatePrompt }),
            });

            const reader = res.body?.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (reader) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n\n");
                buffer = lines.pop() ?? "";

                for (const line of lines) {
                    if (!line.startsWith("data: ")) continue;
                    try {
                        const event = JSON.parse(line.slice(6));
                        if (event.type === "step") {
                            setGenerateSteps((prev) => [...prev, event]);
                        } else if (event.type === "done") {
                            setGenerateResult(JSON.stringify(event.result, null, 2));
                        } else if (event.type === "error") {
                            setGenerateResult(`Error: ${event.message}`);
                        }
                    } catch { }
                }
            }
        } catch (err) {
            setGenerateResult(`Fetch error: ${err}`);
        } finally {
            setGenerating(false);
        }
    }, [generatePrompt]);

    return (
        <div style={{ maxWidth: 900, margin: "40px auto", fontFamily: "monospace", padding: "0 20px", color: "#e0e0e0" }}>
            <h1 style={{ fontSize: 24, marginBottom: 8, color: "#fff" }}>@open-ox/sdk Test Page</h1>
            <p style={{ color: "#999", marginBottom: 24 }}>验证 SDK 包安装、导入、配置是否正常</p>

            {/* Unit Tests */}
            <section style={{ marginBottom: 40 }}>
                <h2 style={{ fontSize: 18, marginBottom: 12, color: "#fff" }}>1. SDK 模块测试</h2>
                <button
                    onClick={runTests}
                    disabled={loading}
                    style={{
                        padding: "8px 20px",
                        background: loading ? "#ccc" : "#0070f3",
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        cursor: loading ? "default" : "pointer",
                        fontSize: 14,
                    }}
                >
                    {loading ? "Testing..." : "Run Tests"}
                </button>

                {result && (
                    <div style={{ marginTop: 16 }}>
                        {Object.entries(result).map(([key, val]) => (
                            <div
                                key={key}
                                style={{
                                    padding: "8px 12px",
                                    marginBottom: 4,
                                    background: val.passed ? "#1a3a1a" : "#3a1a1a",
                                    borderRadius: 4,
                                    fontSize: 13,
                                    color: val.passed ? "#6ee76e" : "#e76e6e",
                                }}
                            >
                                {val.passed ? "✅" : "❌"} <strong>{key}</strong>: {val.detail}
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Generate Test */}
            <section>
                <h2 style={{ fontSize: 18, marginBottom: 12, color: "#fff" }}>2. 生成流程测试（需要 API Key）</h2>
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <input
                        value={generatePrompt}
                        onChange={(e) => setGeneratePrompt(e.target.value)}
                        placeholder="输入项目描述..."
                        style={{
                            flex: 1,
                            padding: "8px 12px",
                            border: "1px solid #444",
                            borderRadius: 6,
                            fontSize: 14,
                            background: "#1a1a1a",
                            color: "#e0e0e0",
                        }}
                    />
                    <button
                        onClick={runGenerate}
                        disabled={generating}
                        style={{
                            padding: "8px 20px",
                            background: generating ? "#ccc" : "#10b981",
                            color: "#fff",
                            border: "none",
                            borderRadius: 6,
                            cursor: generating ? "default" : "pointer",
                            fontSize: 14,
                            whiteSpace: "nowrap",
                        }}
                    >
                        {generating ? "Generating..." : "Generate"}
                    </button>
                </div>

                {generateSteps.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                        <h3 style={{ fontSize: 14, marginBottom: 8, color: "#999" }}>Steps:</h3>
                        {generateSteps.map((step, i) => (
                            <div key={i} style={{ fontSize: 12, padding: "4px 0", color: "#ccc" }}>
                                {step.status === "ok" ? "✅" : step.status === "error" ? "❌" : "⏳"}{" "}
                                {step.step}
                                {step.duration ? ` (${(step.duration / 1000).toFixed(1)}s)` : ""}
                                {step.detail ? ` — ${step.detail.slice(0, 100)}` : ""}
                            </div>
                        ))}
                    </div>
                )}

                {generateResult && (
                    <pre
                        style={{
                            background: "#111",
                            padding: 16,
                            borderRadius: 8,
                            fontSize: 11,
                            overflow: "auto",
                            maxHeight: 400,
                            color: "#c0c0c0",
                            border: "1px solid #333",
                        }}
                    >
                        {generateResult}
                    </pre>
                )}
            </section>
        </div>
    );
}
