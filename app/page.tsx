import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { HomeMarketingPage } from "./HomeMarketingPage";

/** Logged-in users never stay on marketing `/` — workspace is `/dashboard`. */
export default async function HomePage() {
  const session = await getSessionUser();
  if (session) {
    redirect("/dashboard");
  }
  return <HomeMarketingPage />;
}
