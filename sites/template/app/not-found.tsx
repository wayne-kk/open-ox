"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const HOME_REDIRECT_DELAY_MS = 3_000;

export default function NotFound() {
  const router = useRouter();

  useEffect(() => {
    const redirectTimer = window.setTimeout(() => {
      router.replace("/");
    }, HOME_REDIRECT_DELAY_MS);

    return () => window.clearTimeout(redirectTimer);
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16 text-foreground">
      <section className="w-full max-w-xl text-center" aria-labelledby="not-found-title">
        <p className="font-label text-sm font-semibold uppercase text-muted-foreground">404</p>
        <h1 id="not-found-title" className="mt-4 font-display text-4xl font-semibold sm:text-5xl">
          Page not found
        </h1>
        <p className="mt-4 font-body text-base leading-7 text-muted-foreground">
          The page you are looking for does not exist. Returning home in 3 seconds.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex min-h-11 items-center justify-center rounded-base bg-primary px-5 py-2.5 font-label text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Return home
        </Link>
      </section>
    </main>
  );
}
