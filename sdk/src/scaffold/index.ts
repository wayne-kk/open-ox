/**
 * Project Scaffold - 内嵌的项目模板
 *
 * 当 SDK 独立使用时，用这套模板初始化新项目目录。
 * 不依赖 sites/template/，不依赖 Supabase。
 */

import { join } from "path";
import { mkdirSync, writeFileSync, existsSync } from "fs";

/**
 * 在指定目录初始化一个干净的 Next.js 项目骨架。
 * 包含所有生成流程需要的基础文件。
 */
export function scaffoldProject(projectDir: string): void {
    if (!existsSync(projectDir)) {
        mkdirSync(projectDir, { recursive: true });
    }

    // 写入所有模板文件
    for (const [relativePath, content] of Object.entries(TEMPLATE_FILES)) {
        const fullPath = join(projectDir, relativePath);
        mkdirSync(join(fullPath, ".."), { recursive: true });
        writeFileSync(fullPath, content, "utf-8");
    }
}

// ─── Template Files ──────────────────────────────────────────────────────────

const TEMPLATE_FILES: Record<string, string> = {
    "package.json": JSON.stringify({
        name: "generated-project",
        version: "0.1.0",
        private: true,
        scripts: {
            dev: "next dev",
            build: "next build",
            start: "next start",
            lint: "eslint",
        },
        dependencies: {
            "@base-ui/react": "^1.3.0",
            "class-variance-authority": "^0.7.1",
            "clsx": "^2.1.1",
            "cmdk": "^1.1.1",
            "date-fns": "^4.1.0",
            "embla-carousel-react": "^8.6.0",
            "framer-motion": "^12.37.0",
            "gsap": "^3.14.2",
            "input-otp": "^1.4.2",
            "lucide-react": "^0.577.0",
            "next": "16.1.6",
            "next-themes": "^0.4.6",
            "radix-ui": "^1.4.3",
            "react": "19.2.3",
            "react-day-picker": "^9.14.0",
            "react-dom": "19.2.3",
            "react-resizable-panels": "^4.7.2",
            "recharts": "2.15.4",
            "shadcn": "^4.0.5",
            "sonner": "^2.0.7",
            "tailwind-merge": "^3.5.0",
            "tailwindcss-animate": "^1.0.7",
            "tw-animate-css": "^1.4.0",
            "vaul": "^1.1.2",
        },
        devDependencies: {
            "@tailwindcss/postcss": "^4",
            "@types/node": "^20",
            "@types/react": "^19",
            "@types/react-dom": "^19",
            "eslint": "^9",
            "eslint-config-next": "16.1.6",
            "tailwindcss": "^4",
            "typescript": "^5",
        },
    }, null, 2),

    "tsconfig.json": JSON.stringify({
        compilerOptions: {
            target: "ES2017",
            lib: ["dom", "dom.iterable", "esnext"],
            allowJs: true,
            skipLibCheck: true,
            strict: true,
            noEmit: true,
            esModuleInterop: true,
            module: "esnext",
            moduleResolution: "bundler",
            resolveJsonModule: true,
            isolatedModules: true,
            jsx: "react-jsx",
            incremental: true,
            plugins: [{ name: "next" }],
            baseUrl: ".",
            paths: { "@/*": ["./*"] },
        },
        include: [
            "next-env.d.ts", "app/**/*.ts", "app/**/*.tsx",
            "components/**/*.ts", "components/**/*.tsx", "lib/**/*.ts",
            ".next/types/**/*.ts",
        ],
        exclude: ["node_modules"],
    }, null, 2),

    "next.config.ts": `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.unsplash.com" },
    ],
  },
};

export default nextConfig;
`,

    "tailwind.config.ts": `import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {},
  plugins: [],
};

export default config;
`,

    "postcss.config.mjs": `const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
`,

    "eslint.config.mjs": `import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [...compat.extends("next/core-web-vitals")];

export default eslintConfig;
`,

    "components.json": JSON.stringify({
        "$schema": "https://ui.shadcn.com/schema.json",
        style: "radix-nova",
        rsc: true,
        tsx: true,
        tailwind: { config: "", css: "app/globals.css", baseColor: "neutral", cssVariables: true, prefix: "" },
        iconLibrary: "lucide",
        aliases: { components: "@/components", utils: "@/lib/utils", ui: "@/components/ui", lib: "@/lib", hooks: "@/hooks" },
    }, null, 2),

    "lib/utils.ts": `import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`,

    "app/globals.css": `@import "tailwindcss";

@theme {
  --color-background: #ffffff;
  --color-foreground: #111111;
  --color-primary: #2563eb;
  --color-primary-foreground: #ffffff;
  --color-secondary: #64748b;
  --color-secondary-foreground: #ffffff;
  --color-accent: #f59e0b;
  --color-accent-foreground: #ffffff;
  --color-muted: #f1f5f9;
  --color-muted-foreground: #64748b;
  --color-destructive: #ef4444;
  --color-destructive-foreground: #ffffff;
  --color-card: #ffffff;
  --color-card-foreground: #111111;
  --color-popover: #ffffff;
  --color-popover-foreground: #111111;
  --color-border: #e2e8f0;
  --color-input: #e2e8f0;
  --color-ring: #2563eb;
  --font-display: "Inter", sans-serif;
  --font-header: "Inter", sans-serif;
  --font-body: "Inter", sans-serif;
  --font-label: "Inter", sans-serif;
  --shadow-soft: 0 4px 12px rgba(0, 0, 0, 0.05);
  --radius-sm: 4px;
  --radius-base: 8px;
  --radius-lg: 16px;
}

@layer base {
  :root {
    --background: #ffffff;
    --foreground: #111111;
    --card: #ffffff;
    --card-foreground: #111111;
    --popover: #ffffff;
    --popover-foreground: #111111;
    --primary: #2563eb;
    --primary-foreground: #ffffff;
    --secondary: #64748b;
    --secondary-foreground: #ffffff;
    --muted: #f1f5f9;
    --muted-foreground: #64748b;
    --accent: #f59e0b;
    --accent-foreground: #ffffff;
    --destructive: #ef4444;
    --destructive-foreground: #ffffff;
    --border: #e2e8f0;
    --input: #e2e8f0;
    --ring: #2563eb;
    --radius: 8px;
  }

  html, body {
    background-color: theme(--color-background);
    color: theme(--color-foreground);
    font-family: theme(--font-body);
    -webkit-font-smoothing: antialiased;
  }

  * {
    border-color: theme(--color-border);
  }
}
`,

    "app/layout.tsx": `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Generated Project",
  description: "Generated by Open OX SDK",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,

    "app/page.tsx": `export default function Home() {
  return <main><h1>Hello</h1></main>;
}
`,

    "public/.gitkeep": "",
    "public/images/.gitkeep": "",
    "components/sections/.gitkeep": "",
    "components/ui/.gitkeep": "",
    "design-system.md": "",
};
