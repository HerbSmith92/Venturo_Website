import { notFound } from "next/navigation";
import { GuideRecommendationBlock } from "@/components/GuideRecommendation";
import { SaveForm } from "@/components/SaveForm";
import { getCurrentUser } from "@/lib/auth";
import { getEventById } from "@/lib/events";
import { getPublicGuideBySlug, listGuideEventIds } from "@/lib/guides";
import { isSaved } from "@/lib/saves";

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
  const [saved, eventIds] = await Promise.all([
    user ? isSaved(user.id, "guide", guide.id) : Promise.resolve(false),
    listGuideEventIds(guide.id),
  ]);
  const linkedEvents = (await Promise.all(eventIds.map((id) => getEventById(id)))).filter(
    (event) => event && event.status === "approved",
  );

  return (
    <main>
      <section className="shell section">
        <p className="eyebrow">
          <a href="/guides">Guides</a>
        </p>
        <h1>{guide.title}</h1>
        {guide.intro ? <p className="lede">{guide.intro}</p> : null}
        <SaveForm kind="guide" targetId={guide.id} saved={saved} next={`/guides/${guide.slug}`} />
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
        {linkedEvents.length > 0 ? (
          <div style={{ marginTop: 28 }}>
            <h2>Linked Events</h2>
            <ul>
              {linkedEvents.map((event) =>
                event ? (
                  <li key={event.id}>
                    <a href={`/events/${event.slug}`}>{event.title}</a>
                  </li>
                ) : null,
              )}
            </ul>
          </div>
        ) : null}
      </section>
    </main>
  );
}
