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
        <img
          className="poster-logo"
          src="/brand/logos/venturo-stacked-simple-dark.svg"
          alt="Venturo"
        />
        <p className="poster-kicker">Certified Partner</p>
        <h1>{listing.name}</h1>
        {place ? <p className="poster-place">{place}</p> : null}

        <img className="poster-claim-qr" src={claimQr} alt={`QR code for ${listing.name}`} />
        <h2>Scan To Claim Your Member Price</h2>
        <p className="poster-copy">
          Scan this code in the Venturo app. Member prices are for Venturo members.
        </p>

        <div className="poster-stores">
          <figure>
            <img src={appStoreQr} alt="QR code for the App Store" />
            <figcaption>App Store</figcaption>
          </figure>
          <figure>
            <img src={playStoreQr} alt="QR code for Google Play" />
            <figcaption>Google Play</figcaption>
          </figure>
        </div>

        <p className="poster-address">Libertas Rd, Bryanston, Sandton, 2191</p>
      </article>
    </div>
  );
}
