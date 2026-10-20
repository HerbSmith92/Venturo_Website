import { portalEventSectionHref } from "@/lib/portal";
import { redirect } from "next/navigation";

export default async function PortalEventMenuPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(portalEventSectionHref(id, "dashboard"));
}
