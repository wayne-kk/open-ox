/**
 * Default `app/page.tsx` written by init / local preview when the real home
 * route is not ready yet. Must never be published as a successful static preview.
 */
export const PREPARING_SITE_HOME_PAGE_MARKER = "Preparing your site…";

export const DEFAULT_HOME_PAGE_TSX = `export default function HomePage() {
  return (
    <main className="flex min-h-[50vh] items-center justify-center p-8 text-center text-muted-foreground">
      <p>${PREPARING_SITE_HOME_PAGE_MARKER}</p>
    </main>
  );
}
`;

export function isPreparingSiteHomePageStub(content: string): boolean {
  return content.includes(PREPARING_SITE_HOME_PAGE_MARKER);
}
