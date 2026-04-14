"use client";

import { useState, useRef } from "react";
import { ImageIcon, Download, Loader2, Trash2, Copy, Settings2, ChevronDown, ChevronUp } from "lucide-react";

interface GeneratedImage {
    id: number;
    prompt: string;
    params: { model: string; size: string; watermark: boolean };
    url: string;
    duration: number;
    timestamp: number;
}

const DEFAULT_MODEL = "doubao-seedream-4-0-250828";

const IMAGE_MODELS = [
    { id: "doubao-seedream-4-0-250828", label: "Seedream 4.0", supportsPng: false },
    { id: "doubao-seedream-5-0-lite-260128", label: "Seedream 5.0 Lite", supportsPng: true },
];

const PRESET_PROMPTS = [
    "A modern SaaS dashboard interface screenshot, clean design, data visualization charts, light theme, professional UI, 4K render",
    "Luxury fashion editorial portrait, soft studio lighting, neutral background, elegant pose, high-end magazine style",
    "Abstract geometric background, gradient mesh, vibrant purple and blue tones, modern tech aesthetic, seamless pattern",
    "Cozy coffee shop interior, warm lighting, wooden furniture, plants, lifestyle photography, shallow depth of field",
    "Minimalist product photography, white sneaker on white background, soft shadows, commercial advertising style",
];

export default function TestImagePage() {
    const [prompt, setPrompt] = useState("");
    const [model, setModel] = useState(DEFAULT_MODEL);
    const [size, setSize] = useState("1K");
    const [watermark, setWatermark] = useState(false);
    const [outputFormat, setOutputFormat] = useState("");
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [images, setImages] = useState<GeneratedImage[]>([]);
    const idRef = useRef(0);

    const generate = async () => {
        if (!prompt.trim() || loading) return;
        setLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/test-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: prompt.trim(),
                    model: model.trim() || undefined,
                    size,
                    watermark,
                    ...(outputFormat ? { output_format: outputFormat } : {}),
                }),
            });

            if (!res.ok) {
                const data = (await res.json().catch(() => ({}))) as { error?: string };
                throw new Error(data.error ?? `HTTP ${res.status}`);
            }

            const data = (await res.json()) as {
                url: string;
                duration: number;
                params: { model: string; size: string; watermark: boolean };
            };

            setImages((prev) => [
                {
                    id: ++idRef.current,
                    prompt: prompt.trim(),
                    params: data.params,
                    url: data.url,
                    duration: data.duration,
                    timestamp: Date.now(),
                },
                ...prev,
            ]);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    };

    const [copiedId, setCopiedId] = useState<number | null>(null);

    const copyPrompt = (text: string, id: number) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 1500);
    };

    const removeImage = (id: number) => {
        setImages((prev) => prev.filter((img) => img.id !== id));
    };

    return (
        <div className="min-h-screen bg-[#0a0a0b] text-zinc-100 scrollbar-hidden">
            {/* Header */}
            <div className="border-b border-white/[0.06] bg-[#0a0a0b]/80 backdrop-blur-xl sticky top-16 z-30">
                <div className="max-w-6xl mx-auto px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 border border-violet-500/20">
                            <ImageIcon className="h-4 w-4 text-violet-400" />
                        </div>
                        <div>
                            <h1 className="text-base font-semibold tracking-tight">图片生成测试</h1>
                            <p className="text-xs text-zinc-500">调试 Ark API 参数和 prompt，测试生图质量</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
                    {/* Left: Results */}
                    <div className="order-2 lg:order-1 space-y-4">
                        {images.length === 0 && !loading && (
                            <div className="flex flex-col items-center justify-center py-24 text-zinc-600">
                                <ImageIcon className="h-10 w-10 mb-3 opacity-30" />
                                <p className="text-sm">输入 prompt 开始测试</p>
                            </div>
                        )}

                        {loading && (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
                                <span className="ml-3 text-sm text-zinc-400">生成中...</span>
                            </div>
                        )}

                        {images.map((img) => (
                            <div
                                key={img.id}
                                className="group rounded-xl border border-white/[0.06] bg-[#111113] overflow-hidden transition-colors hover:border-white/[0.1]"
                            >
                                {/* Image */}
                                <div className="relative bg-[#0a0a0b] flex items-center justify-center p-4">
                                    <img
                                        src={img.url}
                                        alt={img.prompt}
                                        className="max-w-full max-h-[520px] rounded-lg"
                                    />
                                </div>

                                {/* Meta bar */}
                                <div className="px-4 py-3 border-t border-white/[0.06] flex items-center justify-between">
                                    <div className="flex items-center gap-3 text-[11px] text-zinc-500 font-mono">
                                        <span className="px-1.5 py-0.5 rounded bg-white/[0.04]">{img.params.model}</span>
                                        <span>{img.params.size}</span>
                                        <span>{(img.duration / 1000).toFixed(1)}s</span>
                                        {img.params.watermark && <span className="text-amber-500/70">水印</span>}
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => copyPrompt(img.prompt, img.id)}
                                            className="p-1.5 rounded-md hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-300"
                                            title="复制 prompt"
                                        >
                                            {copiedId === img.id ? <span className="text-[10px] text-emerald-400">已复制</span> : <Copy className="h-3.5 w-3.5" />}
                                        </button>
                                        <a
                                            href={img.url}
                                            download={`test-${img.id}.png`}
                                            className="p-1.5 rounded-md hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-300"
                                            title="下载"
                                        >
                                            <Download className="h-3.5 w-3.5" />
                                        </a>
                                        <button
                                            onClick={() => removeImage(img.id)}
                                            className="p-1.5 rounded-md hover:bg-red-500/10 text-zinc-500 hover:text-red-400"
                                            title="删除"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Prompt */}
                                <div className="px-4 py-2.5 border-t border-white/[0.04] text-xs text-zinc-500 leading-relaxed whitespace-pre-wrap break-all">
                                    {img.prompt}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Right: Controls */}
                    <div className="order-1 lg:order-2">
                        <div className="lg:sticky lg:top-[8.5rem] space-y-4">
                            {/* Prompt */}
                            <div className="rounded-xl border border-white/[0.06] bg-[#111113] p-4 space-y-3">
                                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Prompt</label>
                                <textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="Describe the image you want to generate..."
                                    rows={5}
                                    className="w-full bg-[#0a0a0b] border border-white/[0.06] rounded-lg p-3 text-sm text-zinc-200 placeholder:text-zinc-600 resize-y focus:outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20 transition-colors"
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate();
                                    }}
                                />

                                {/* Size selector */}
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-zinc-500 w-10">尺寸</span>
                                    <div className="flex gap-1">
                                        {["1K", "2K", "4K"].map((s) => (
                                            <button
                                                key={s}
                                                onClick={() => setSize(s)}
                                                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${size === s
                                                    ? "bg-violet-500/15 text-violet-300 border border-violet-500/30"
                                                    : "bg-white/[0.03] text-zinc-500 border border-white/[0.06] hover:text-zinc-300"
                                                    }`}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Generate button */}
                                <button
                                    onClick={generate}
                                    disabled={loading || !prompt.trim()}
                                    className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            生成中...
                                        </>
                                    ) : (
                                        "生成图片 ⌘↵"
                                    )}
                                </button>

                                {error && (
                                    <div className="text-xs text-red-400 bg-red-500/5 border border-red-500/10 rounded-lg p-2.5 break-all">
                                        {error}
                                    </div>
                                )}
                            </div>

                            {/* Advanced settings */}
                            <div className="rounded-xl border border-white/[0.06] bg-[#111113] overflow-hidden">
                                <button
                                    onClick={() => setShowAdvanced(!showAdvanced)}
                                    className="w-full px-4 py-3 flex items-center justify-between text-xs font-medium text-zinc-400 hover:text-zinc-300 transition-colors"
                                >
                                    <span className="flex items-center gap-2">
                                        <Settings2 className="h-3.5 w-3.5" />
                                        高级参数
                                    </span>
                                    {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                </button>

                                {showAdvanced && (
                                    <div className="px-4 pb-4 space-y-3 border-t border-white/[0.04] pt-3">
                                        {/* Model */}
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] text-zinc-500">模型</label>
                                            <div className="flex flex-col gap-1.5">
                                                {IMAGE_MODELS.map((m) => (
                                                    <button
                                                        key={m.id}
                                                        onClick={() => {
                                                            setModel(m.id);
                                                            if (!m.supportsPng && outputFormat === "png") setOutputFormat("");
                                                        }}
                                                        className={`w-full text-left px-2.5 py-2 rounded-md text-[11px] font-mono transition-colors ${model === m.id
                                                            ? "bg-violet-500/15 text-violet-300 border border-violet-500/30"
                                                            : "bg-white/[0.03] text-zinc-500 border border-white/[0.06] hover:text-zinc-300"
                                                            }`}
                                                    >
                                                        <span className="text-xs">{m.label}</span>
                                                        <span className="ml-1.5 text-[10px] opacity-50">{m.id}</span>
                                                        {m.supportsPng && <span className="ml-1.5 text-[9px] text-emerald-400/60">PNG</span>}
                                                    </button>
                                                ))}
                                            </div>
                                            <input
                                                type="text"
                                                value={model}
                                                onChange={(e) => setModel(e.target.value)}
                                                placeholder="或输入自定义 Model ID"
                                                className="w-full bg-[#0a0a0b] border border-white/[0.06] rounded-md px-2.5 py-1.5 text-[11px] text-zinc-300 font-mono placeholder:text-zinc-700 focus:outline-none focus:border-violet-500/40"
                                            />
                                        </div>

                                        {/* Watermark */}
                                        <div className="flex items-center justify-between">
                                            <label className="text-[11px] text-zinc-500">水印 (Watermark)</label>
                                            <button
                                                onClick={() => setWatermark(!watermark)}
                                                className={`relative w-8 h-[18px] rounded-full transition-colors ${watermark ? "bg-violet-500" : "bg-zinc-700"
                                                    }`}
                                            >
                                                <span
                                                    className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-transform ${watermark ? "translate-x-[14px]" : "translate-x-0.5"
                                                        }`}
                                                />
                                            </button>
                                        </div>

                                        {/* Output Format */}
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] text-zinc-500">输出格式 (仅 seedream-5.0-lite)</label>
                                            <div className="flex gap-1">
                                                {[
                                                    { value: "", label: "默认" },
                                                    { value: "jpeg", label: "JPEG" },
                                                    { value: "png", label: "PNG" },
                                                ].map((opt) => (
                                                    <button
                                                        key={opt.value}
                                                        onClick={() => setOutputFormat(opt.value)}
                                                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${outputFormat === opt.value
                                                            ? "bg-violet-500/15 text-violet-300 border border-violet-500/30"
                                                            : "bg-white/[0.03] text-zinc-500 border border-white/[0.06] hover:text-zinc-300"
                                                            }`}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Preset prompts */}
                            <div className="rounded-xl border border-white/[0.06] bg-[#111113] p-4 space-y-2">
                                <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">预设 Prompt</span>
                                <div className="space-y-1.5">
                                    {PRESET_PROMPTS.map((p, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setPrompt(p)}
                                            className="w-full text-left px-2.5 py-2 rounded-md text-[11px] leading-relaxed text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03] transition-colors line-clamp-2"
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
