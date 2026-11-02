import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CollectionGuide } from "@/components/CollectionGuide";
import { SpotlightArticle } from "@/components/SpotlightArticle";
import { getCurrentUser } from "@/lib/auth";
import { getEventById } from "@/lib/events";
import { getPublicEventGuideBySlug } from "@/lib/event-guides";
import { getPublicGuideBySlug, listGuideEventIds, liveGuides, liveGuidesByAuthor } from "@/lib/guides";
import { getPublicListingById } from "@/lib/listings";
import { isSaved } from "@/lib/saves";
import { coverPhoto, type SpotlightVisitInfo } from "@/lib/spotlight";

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
  const guide = listingGuide ?? eventGuide!;
  const guideId = guide.id;
  const title = guide.title;
  const intro = guide.intro;
  const body = listingGuide?.body ?? eventGuide?.body ?? null;
  const author = listingGuide?.author ?? eventGuide?.author ?? null;
  const nextPath = `/guides/${guide.slug}`;

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
    <CollectionGuide
      title={title}
      intro={intro}
      body={body}
      about={listingGuide ? "activities" : "events"}
      publishedAt={listingGuide?.publishedAt ?? null}
      author={author}
      listingItems={listingGuide?.items}
      eventItems={eventGuide?.items}
      moreGuides={moreGuides}
      linkedEvents={linkedEvents.filter((event): event is NonNullable<typeof event> => Boolean(event))}
      paid={paid}
      save={listingGuide ? { targetId: guideId, saved, next: nextPath } : undefined}
    />
  );
}
