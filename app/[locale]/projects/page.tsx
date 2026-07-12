import { redirect } from "next/navigation";

/** Legacy workspace URL — preserve query string. */
export default async function ProjectsWorkspaceRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") qs.set(key, value);
    else if (Array.isArray(value)) {
      for (const v of value) qs.append(key, v);
    }
  }
  const query = qs.toString();
  redirect(query ? `/dashboard?${query}` : "/dashboard");
}
