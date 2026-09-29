import { PrintPosterButton } from "@/components/admin/PrintPosterButton";
import { getAppStoreLinks } from "@/lib/brand";
import { loadListing } from "@/lib/control-room";
import { getPublicSiteUrl } from "@/lib/site-url";
import { notFound } from "next/navigation";
import QRCode from "qrcode";

async function qrSrc(value: string, width: number) {
  return QRCode.toDataURL(value, {
    errorCorrectionLevel: "M",
    margin: 1,
    width,
    color: { dark: "#2A2D35", light: "#EBEBF3" },
  });
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
  const claimUrl = `${siteUrl}/directory/${listing.slug}?offer=member`;
  const stores = getAppStoreLinks();
  const [claimQr, appStoreQr, playStoreQr] = await Promise.all([
    qrSrc(claimUrl, 360),
    qrSrc(stores.appStore, 180),
    qrSrc(stores.playStore, 180),
  ]);
  const place = [listing.branch_name, listing.suburb, listing.city].filter(Boolean).join(" · ");

  return (
    <div className="poster-page">
      <div className="poster-toolbar">
        <a className="btn btn-secondary" href={`/admin/listings/${listing.id}`}>
          Back To Listing
        </a>
        <PrintPosterButton />
      </div>

      <article className="poster-sheet">
        <svg className="poster-pattern" viewBox="0 0 210 297" aria-hidden="true">
          <g fill="none" strokeWidth="0.35" strokeDasharray="1.1 1.5">
            <circle cx="105" cy="72" r="42" stroke="#DC729E" />
            <circle cx="105" cy="72" r="68" stroke="#7CC3E9" />
            <circle cx="46" cy="148" r="56" stroke="#FF9E6B" />
            <circle cx="168" cy="156" r="64" stroke="#F3BF4A" />
            <circle cx="105" cy="214" r="62" stroke="#5E589E" />
            <circle cx="118" cy="248" r="48" stroke="#45A67F" />
          </g>
        </svg>
        <img
          className="poster-logo"
          src="/brand/logos/venturo-stacked-simple-light.svg"
          alt="Venturo"
        />
        <p className="poster-kicker">Certified Partner</p>
        <h1>{listing.name}</h1>
        <p className="poster-place">{place || "Libertas Rd, Bryanston, Sandton, 2191"}</p>

        <div className="poster-learn">
          <h2>Learn More</h2>
          <p>Scan the QR codes</p>
          <p>Scan this code in the Venturo app. Member prices are for Venturo members.</p>
        </div>

        <div className="poster-codes">
          <figure>
            <img src={claimQr} alt={`QR code for ${listing.name}`} />
            <figcaption>Directory</figcaption>
          </figure>
          <span className="poster-divider" aria-hidden="true" />
          <figure>
            <img src={appStoreQr} alt="QR code for the App Store" />
            <figcaption>App Store</figcaption>
          </figure>
          <span className="poster-divider" aria-hidden="true" />
          <figure>
            <img src={playStoreQr} alt="QR code for Google Play" />
            <figcaption>Google Play</figcaption>
          </figure>
        </div>
      </article>
    </div>
  );
}
