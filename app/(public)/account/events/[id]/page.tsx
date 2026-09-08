import { getCurrentUser } from "@/lib/auth";
import { portalEventHref } from "@/lib/portal";
import { redirect } from "next/navigation";

export default async function EventStudioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/events");

  const { id } = await params;
  redirect(portalEventHref(id));
}
