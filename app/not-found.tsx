import Link from "next/link";

/** Fallback when a request is outside the `[locale]` tree. */
export default function RootNotFound() {
  return (
    <html lang="zh-CN">
      <body className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center bg-background px-6 text-center text-foreground">
        <h1 className="text-2xl font-semibold">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Page not found</p>
        <Link href="/" className="mt-6 text-sm text-primary hover:underline">
          Home
        </Link>
      </body>
    </html>
  );
}
