import Link from "next/link";
import { Github, Twitter } from "lucide-react";

export function Footer() {
    return (
      <footer className="border-t border-white/6 bg-background">
          <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
              <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
                  {/* Brand */}
                  <Link href="/" className="flex items-center gap-2.5 group">
                      <div className="flex h-6 w-6 items-center justify-center rounded border border-primary/40 bg-primary/10">
                          <span className="font-mono text-[9px] font-bold text-primary">OX</span>
                      </div>
                      <span className="font-mono text-[12px] font-bold tracking-[0.18em] text-muted-foreground group-hover:text-foreground transition-colors">
                          OPEN-OX
                      </span>
                  </Link>

                  {/* Copyright */}
                  <p className="font-mono text-[11px] text-muted-foreground/50 order-last sm:order-none">
                      © {new Date().getFullYear()} Open-OX Studio
                  </p>

                  {/* Right: status + social */}
                  <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                          <span className="font-mono text-[11px] text-muted-foreground/60">All systems up</span>
                      </div>
                      <div className="flex items-center gap-2">
                          <a
                              href="https://github.com"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground/50 hover:text-foreground transition-colors"
                              aria-label="GitHub"
                          >
                              <Github className="h-4 w-4" />
                          </a>
                          <a
                              href="https://twitter.com"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground/50 hover:text-foreground transition-colors"
                              aria-label="Twitter"
                          >
                              <Twitter className="h-4 w-4" />
                          </a>
                      </div>
                  </div>
              </div>
          </div>
      </footer>
  );
}
