import { redirect } from "next/navigation";

export default async function EventGuideSlugRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/guides/${slug}`);
}
