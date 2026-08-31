import { notFound } from "next/navigation";
import { GuideRecommendationBlock } from "@/components/GuideRecommendation";
import { getCurrentUser } from "@/lib/auth";
import { getPublicGuideBySlug } from "@/lib/guides";

export default async function GuideDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = await getPublicGuideBySlug(slug);
  if (!guide) notFound();

  const user = await getCurrentUser();
  const paid = user?.plan === "paid";

  return (
    <main>
      <section className="shell section">
        <p className="eyebrow">
          <a href="/guides">Guides</a>
        </p>
        <h1>{guide.title}</h1>
        {guide.intro ? <p className="lede">{guide.intro}</p> : null}
      </section>
      <section className="shell section" style={{ paddingTop: 0 }}>
        <div className="guide-recs">
          {guide.items.map((item, index) => (
            <GuideRecommendationBlock
              key={item.listingId}
              item={item}
              index={index + 1}
              paid={paid}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
