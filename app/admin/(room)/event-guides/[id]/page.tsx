import { redirect } from "next/navigation";

export default async function EventGuideEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; done?: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/guides/${id}`);
}
