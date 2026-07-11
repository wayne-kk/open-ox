import { HomeMarketingPage } from "../HomeMarketingPage";

export const metadata = {
  title: "Open-OX",
  description: "AI-powered website builder — describe your idea, get a live site in seconds.",
};

/**
 * Marketing homepage for signed-in users (and anyone).
 * Logged-out `/` shows the same page; logged-in `/` redirects to `/dashboard`.
 */
export default function HomeMarketingRoute() {
  return <HomeMarketingPage />;
}
