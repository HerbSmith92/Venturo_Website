import { PrintPosterButton } from "@/components/admin/PrintPosterButton";
import { loadListing } from "@/lib/control-room";
import { posterQrSrc } from "@/lib/poster-qr";
import { getPublicSiteUrl } from "@/lib/site-url";
import { notFound } from "next/navigation";

function nameLines(name: string) {
  const parts = name
    .split(/\s+[-–—|]\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [name];
}

export default async function ListingPosterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await loadListing(id);
  if (!listing?.slug) notFound();

  const siteUrl = getPublicSiteUrl();
  const discountUrl = `${siteUrl}/directory/${listing.slug}?offer=member`;
  const activityUrl = `${siteUrl}/directory/${listing.slug}`;
  const downloadUrl = `${siteUrl}/get-the-app`;
  const discountQr = posterQrSrc(discountUrl);
  const downloadQr = posterQrSrc(downloadUrl);
  const activityQr = posterQrSrc(activityUrl);

  return (
    <div className="poster-page">
      <div className="poster-toolbar">
        <a className="btn btn-secondary" href={`/admin/listings/${listing.id}`}>
          Back To Listing
        </a>
        <PrintPosterButton />
      </div>

      <article className="poster-sheet">
        <div className="poster-top">
          <img className="poster-trail" src="/brand/poster/partner-trail.png" alt="" />
          <img
            className="poster-logo"
            src="/brand/logos/venturo-stacked-simple-dark.svg"
            alt="Venturo"
          />
        </div>

        <p className="poster-pill">Proud Venturo Partner</p>
        <h1>
          {nameLines(listing.name).map((line) => (
            <span key={line}>{line}</span>
          ))}
        </h1>
        <p className="poster-headline">
          <span>Good Times</span>
          <span>Great Perks</span>
        </p>
        <p className="poster-subhead">Venturo Member Discounts</p>

        <img className="poster-hero-qr" src={discountQr} alt={`QR code to claim the member discount at ${listing.name}`} />
        <p className="poster-scan">Scan to unlock your discount</p>
        <p className="poster-note">Activate subscription required. Offer terms apply.</p>

        <hr className="poster-rule" />

        <div className="poster-split">
          <figure>
            <figcaption>Get the App</figcaption>
            <img src={downloadQr} alt="QR code to download the Venturo app" />
            <p>
              Scan to download
              <br />
              for your phone
            </p>
          </figure>
          <span className="poster-split-rule" aria-hidden="true" />
          <figure>
            <figcaption>Explore Nearby</figcaption>
            <img src={activityQr} alt={`QR code for ${listing.name} on the Venturo website`} />
            <p>
              Explore this activity
              <br />
              &amp; things to do nearby
            </p>
          </figure>
        </div>

        <p className="poster-foot">venturo.co.za</p>
      </article>
    </div>
  );
}
