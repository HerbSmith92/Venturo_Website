import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventGuideRecommendationBlock } from "@/components/EventGuideRecommendation";
import { GuideAuthorCard } from "@/components/GuideAuthorCard";
import { GuideBrowse } from "@/components/GuideBrowse";
import { GuideRecommendationBlock } from "@/components/GuideRecommendation";
import { SaveForm } from "@/components/SaveForm";
import { SpotlightArticle } from "@/components/SpotlightArticle";
import { getCurrentUser } from "@/lib/auth";
import { getEventById } from "@/lib/events";
import { getPublicEventGuideBySlug } from "@/lib/event-guides";
import { getPublicGuideBySlug, listGuideEventIds, liveGuides, liveGuidesByAuthor } from "@/lib/guides";
import { getPublicListingById } from "@/lib/listings";
import { isSaved } from "@/lib/saves";
import { coverPhoto, galleryPhotos, type SpotlightVisitInfo } from "@/lib/spotlight";

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://venturo.co.za";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getPublicGuideBySlug(slug);
  if (!guide) return { title: "Guide · Venturo" };
  const cover = coverPhoto(guide.photos, guide.cover)?.url ?? guide.items[0]?.image;
  return {
    title: `${guide.title} · Venturo`,
    description: guide.intro ?? `A Venturo guide: ${guide.title}`,
    openGraph: {
      title: guide.title,
      description: guide.intro ?? undefined,
      url: `${siteUrl()}/guides/${guide.slug}`,
      images: cover ? [{ url: cover }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: guide.title,
      description: guide.intro ?? undefined,
      images: cover ? [cover] : undefined,
    },
  };
}

export default async function GuideDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listingGuide = await getPublicGuideBySlug(slug);
  const eventGuide = listingGuide ? null : await getPublicEventGuideBySlug(slug);
  if (!listingGuide && !eventGuide) notFound();

  const user = await getCurrentUser();
  const paid = user?.plan === "paid";
  const guideId = listingGuide?.id ?? eventGuide!.id;
  const title = listingGuide?.title ?? eventGuide!.title;
  const intro = listingGuide?.intro ?? eventGuide!.intro;
  const body = listingGuide?.body ?? eventGuide?.body ?? null;
  const author = listingGuide?.author ?? eventGuide?.author ?? null;
  const shape = listingGuide?.shape ?? eventGuide?.shape ?? "roundup";
  const nextPath = `/guides/${listingGuide?.slug ?? eventGuide!.slug}`;

  const [saved, eventIds, otherGuides, listing, moreByAuthor] = await Promise.all([
    user && listingGuide ? isSaved(user.id, "guide", guideId) : Promise.resolve(false),
    listingGuide ? listGuideEventIds(guideId) : Promise.resolve([] as string[]),
    liveGuides(8),
    listingGuide?.listingId ? getPublicListingById(listingGuide.listingId) : Promise.resolve(null),
    listingGuide?.author?.id ? liveGuidesByAuthor(listingGuide.author.id) : Promise.resolve([]),
  ]);
  const moreGuides = otherGuides.filter((item) => item.id !== guideId).slice(0, 5);
  const linkedEvents = (await Promise.all(eventIds.map((id) => getEventById(id)))).filter(
    (event) => event && event.status === "approved",
  );

  if (listingGuide?.shape === "spotlight") {
    const visit: SpotlightVisitInfo | null = listing
      ? {
          name: listing.name,
          slug: listing.slug,
          area: listing.area,
          fromPrice: listing.fromPrice,
          bookingUrl: listing.bookingUrl,
          websiteUrl: listing.websiteUrl,
          phone: listing.phone,
          bookingRequired: listing.bookingRequired,
          indoorOutdoor: listing.indoorOutdoor,
          hours: listing.hours,
        }
      : null;
    return (
      <main>
        <SpotlightArticle
          title={listingGuide.title}
          intro={listingGuide.intro ?? ""}
          slug={listingGuide.slug}
          cover={listingGuide.cover}
          photos={listingGuide.photos}
          story={listingGuide.story}
          listing={visit}
          author={listingGuide.author}
          publishedAt={listingGuide.publishedAt}
          updatedAt={listingGuide.updatedAt}
          saved={saved}
          saveTargetId={listingGuide.id}
          shareUrl={`${siteUrl()}/guides/${listingGuide.slug}`}
          moreByAuthor={moreByAuthor
            .filter((item) => item.id !== listingGuide.id)
            .map((item) => ({ title: item.title, href: `/guides/${item.slug}` }))}
        />
      </main>
    );
  }

  return (
    <main>
      <section className="shell section">
        <p className="eyebrow">
          <a href="/guides">Guides</a>
          {shape === "spotlight" ? " · Spotlight" : listingGuide ? " · Activities" : " · Events"}
        </p>
        <h1>{title}</h1>
        {intro ? <p className="lede">{intro}</p> : null}
        {listingGuide ? <SaveForm kind="guide" targetId={guideId} saved={saved} next={nextPath} /> : null}
        {listingGuide && galleryPhotos(listingGuide.photos).length > 0 ? (
          <div className="listing-gallery" style={{ marginTop: 20 }}>
            {galleryPhotos(listingGuide.photos).map((photo) => (
              <img key={photo.id} src={photo.url} alt={photo.alt || listingGuide.title} />
            ))}
          </div>
        ) : null}
      </section>
      {author ? (
        <section className="shell section" style={{ paddingTop: 0 }}>
          <GuideAuthorCard author={author} profileHref={author.slug ? `/authors/${author.slug}` : null} />
        </section>
      ) : null}
      {body ? (
        <section className="shell section" style={{ paddingTop: 0 }}>
          <div className="lede" style={{ whiteSpace: "pre-wrap" }}>
            {body}
          </div>
        </section>
      ) : null}
      <section className="shell section" style={{ paddingTop: 0 }}>
        <div className={moreGuides.length > 0 ? "guide-layout" : undefined}>
          <div>
            <div className="guide-recs">
              {listingGuide
                ? listingGuide.items.map((item, index) => (
                    <GuideRecommendationBlock
                      key={item.listingId}
                      item={item}
                      index={index + 1}
                      paid={paid}
                    />
                  ))
                : eventGuide!.items.map((item, index) => (
                    <EventGuideRecommendationBlock key={item.eventId} item={item} index={index + 1} />
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
          </div>
          <GuideBrowse guides={moreGuides} />
        </div>
      </section>
    </main>
  );
}
