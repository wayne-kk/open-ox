import Link from "next/link";

const NAV = [
    { label: "首页", href: "/" },
    { label: "创建", href: "/build-studio" },
    { label: "项目", href: "/projects" },
];

export function Footer() {
    return (
        <footer className="border-t border-white/6 bg-background/80 backdrop-blur-sm">
            <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
                <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
                    {/* Brand */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] font-semibold tracking-[0.2em] text-foreground">
                                OPEN-OX
                            </span>
                            <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
                                Studio
                            </span>
                        </div>
                        <p className="max-w-xs text-[13px] leading-relaxed text-muted-foreground/60">
                            AI 驱动的建站平台。描述你的想法，自动生成完整网站。
                        </p>
                    </div>

                    {/* Nav */}
                    <nav className="flex gap-6">
                        {NAV.map(({ label, href }) => (
                            <Link
                                key={href}
                                href={href}
                                className="font-mono text-[11px] tracking-wide text-muted-foreground/50 transition-colors hover:text-foreground"
                            >
                                {label}
                            </Link>
                        ))}
                    </nav>
                </div>

                {/* Bottom bar */}
                <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-white/5 pt-6 sm:flex-row">
                    <p className="font-mono text-[10px] tracking-wide text-muted-foreground/30">
                        © {new Date().getFullYear()} Open-OX. All rights reserved.
                    </p>
                    <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500/60 animate-pulse" />
                        <span className="font-mono text-[10px] tracking-wide text-muted-foreground/30">
                            系统运行中
                        </span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
