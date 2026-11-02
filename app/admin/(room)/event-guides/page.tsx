import { redirect } from "next/navigation";

export default async function EventGuidesRedirect({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const { status, error } = await searchParams;
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (error) params.set("error", error);
  const query = params.toString();
  redirect(query ? `/admin/guides?${query}` : "/admin/guides");
}
