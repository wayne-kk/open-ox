import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { HomeMarketingPage } from "./HomeMarketingPage";

/** Logged-in users land on `/dashboard`; marketing home for them is `/home`. */
export default async function HomePage() {
  const session = await getSessionUser();
  if (session) {
    redirect("/dashboard");
  }
  return <HomeMarketingPage />;
}
