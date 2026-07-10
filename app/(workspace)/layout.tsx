import { AuthAwareAppShell } from "@/app/components/AppShell";

/**
 * Shared product shell for `/dashboard` and `/community`.
 * Sidebar stays mounted across soft navigations between these routes.
 */
export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthAwareAppShell>{children}</AuthAwareAppShell>;
}
