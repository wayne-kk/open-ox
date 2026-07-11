import Link from "next/link";
import { Github, Twitter, Mail } from "lucide-react";
import { BrandMark } from "@/app/components/BrandMark";

const PRODUCT_LINKS = [
  { href: "/dashboard", label: "工作台" },
  { href: "/community", label: "社区" },
  { href: "/docs", label: "文档" },
  { href: "/changelog", label: "更新日志" },
];

const RESOURCE_LINKS = [
  { href: "/docs/architecture", label: "架构" },
  { href: "/docs/api", label: "API" },
  { href: "https://github.com/open-ox/open-ox", label: "GitHub", external: true },
  { href: "https://github.com/open-ox/open-ox/issues", label: "反馈", external: true },
];

const SOCIAL_LINKS = [
  { href: "https://github.com/open-ox", icon: Github, label: "GitHub" },
  { href: "https://twitter.com/open_ox", icon: Twitter, label: "Twitter" },
  { href: "mailto:hi@open-ox.com", icon: Mail, label: "Email" },
];

export function Footer() {
  return (
    <footer className="border-t border-white/6 bg-background">
      <div className="container mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 py-16 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Link href="/" className="group inline-flex items-center gap-2.5">
              <BrandMark size={26} />
              <span className="font-heading text-[14px] font-semibold tracking-[-0.02em] text-foreground">
                OPEN-OX
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              AI 驱动的网站构建引擎。描述你的想法，2分钟内获得一个可部署的站点。
            </p>
            <div className="mt-5 flex items-center gap-3">
              {SOCIAL_LINKS.map(({ href, icon: Icon, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/8 bg-white/3 text-muted-foreground transition-all hover:border-white/20 hover:bg-white/6 hover:text-foreground"
                  aria-label={label}
                >
                  <Icon className="h-3.5 w-3.5" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-[12px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
              产品
            </h3>
            <ul className="space-y-2.5">
              {PRODUCT_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-[12px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
              资源
            </h3>
            <ul className="space-y-2.5">
              {RESOURCE_LINKS.map(({ href, label, ...rest }) => {
                const external = "external" in rest;
                return (
                  <li key={href}>
                    {external ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {label}
                      </a>
                    ) : (
                      <Link
                        href={href}
                        className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/6 py-6 sm:flex-row">
          <p className="text-[12px] text-muted-foreground">
            © {new Date().getFullYear()} Open-OX Studio. Built with AI.
          </p>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-signal" />
            <span className="text-[11px] text-muted-foreground">All systems operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
