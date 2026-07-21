"use client";

import { Github, Twitter, Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { BrandMark } from "@/app/components/BrandMark";
import { Link } from "@/i18n/navigation";

const SOCIAL_LINKS = [
  { href: "https://github.com/open-ox", icon: Github, label: "GitHub" },
  { href: "https://twitter.com/open_ox", icon: Twitter, label: "Twitter" },
  { href: "mailto:782884630@qq.com", icon: Mail, label: "Email" },
];

export function Footer() {
  const t = useTranslations("footer");

  const productLinks = [
    { href: "/dashboard", label: t("workspace") },
    { href: "/pricing", label: t("pricing") },
    { href: "/community", label: t("community") },
    { href: "/docs", label: t("docs") },
    { href: "/changelog", label: t("changelog") },
    { href: "/compare", label: t("compare") },
  ] as const;

  const resourceLinks = [
    { href: "/docs/architecture", label: t("architecture"), external: false },
    { href: "/docs/api", label: t("api"), external: false },
    {
      href: "https://github.com/open-ox/open-ox",
      label: t("github"),
      external: true,
    },
    {
      href: "https://github.com/open-ox/open-ox/issues",
      label: t("feedback"),
      external: true,
    },
  ] as const;

  return (
    <footer className="border-t border-border/60 bg-background">
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
              {t("tagline")}
            </p>
            <div className="mt-5 flex items-center gap-3">
              {SOCIAL_LINKS.map(({ href, icon: Icon, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted/40 text-muted-foreground transition-all hover:border-border hover:bg-muted hover:text-foreground"
                  aria-label={label}
                >
                  <Icon className="h-3.5 w-3.5" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-[12px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
              {t("product")}
            </h3>
            <ul className="space-y-2.5">
              {productLinks.map(({ href, label }) => (
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
              {t("resources")}
            </h3>
            <ul className="space-y-2.5">
              {resourceLinks.map(({ href, label, external }) => (
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
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-border/60 py-6 sm:flex-row">
          <p className="text-[12px] text-muted-foreground">
            © {new Date().getFullYear()} Open-OX Studio. {t("rights")}
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
