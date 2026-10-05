export type ListingContactLink = {
  key: string;
  label: string;
  href: string;
  external?: boolean;
};

type SocialLink = { platform: string; handle: string | null; url: string | null };

function clean(value: string | null | undefined) {
  const text = (value ?? "").trim();
  return text || null;
}

function httpUrl(value: string | null) {
  if (!value) return null;
  return /^https?:\/\//i.test(value) ? value : null;
}

function socialHref(link: SocialLink) {
  const direct = httpUrl(clean(link.handle)) ?? httpUrl(clean(link.url));
  if (direct && !/https?:\/\/.+https?:\/\//i.test(direct)) return direct;
  const handle = clean(link.handle)?.replace(/^@/, "");
  if (!handle || /^https?:\/\//i.test(handle)) return httpUrl(clean(link.handle));
  if (link.platform === "instagram") return `https://instagram.com/${handle}`;
  if (link.platform === "facebook") return `https://facebook.com/${handle}`;
  if (link.platform === "tiktok") return `https://www.tiktok.com/@${handle}`;
  return null;
}

export function listingContactLinks(listing: {
  websiteUrl: string | null;
  bookingUrl: string | null;
  email: string | null;
  phone: string | null;
  social: SocialLink[];
}): ListingContactLink[] {
  const links: ListingContactLink[] = [];
  const website = httpUrl(clean(listing.websiteUrl));
  const booking = httpUrl(clean(listing.bookingUrl));
  if (website) links.push({ key: "website", label: "Website", href: website, external: true });
  if (booking && booking !== website) {
    links.push({ key: "booking", label: "Book", href: booking, external: true });
  }
  const email = clean(listing.email);
  if (email) links.push({ key: "email", label: "Email", href: `mailto:${email}` });

  const socialOrder = ["instagram", "facebook", "tiktok"];
  for (const platform of socialOrder) {
    const row = listing.social.find((item) => item.platform.toLowerCase() === platform);
    if (!row) continue;
    const href = socialHref(row);
    if (!href) continue;
    const label = platform === "tiktok" ? "TikTok" : platform[0].toUpperCase() + platform.slice(1);
    links.push({ key: platform, label, href, external: true });
  }

  const phone = clean(listing.phone);
  if (phone) links.push({ key: "phone", label: "Phone", href: `tel:${phone.replace(/\s/g, "")}` });
  return links;
}

function Icon({ name }: { name: string }) {
  if (name === "website") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M4 12h16M12 4c2.5 2.8 3.8 5.4 3.8 8S14.5 17.2 12 20c-2.5-2.8-3.8-5.4-3.8-8S9.5 6.8 12 4Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      </svg>
    );
  }
  if (name === "booking") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 3.5v3M16 3.5v3M4 9h16" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (name === "email") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="6" width="16" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M5 7l7 6 7-6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (name === "instagram") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M8 8h2l1-1.5h2L14 8h2a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <circle cx="12" cy="13" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (name === "facebook") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M13.5 20v-7h2.4l.4-2.6h-2.8V8.8c0-.8.2-1.3 1.4-1.3H16.5V5.1c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v1.5H8v2.6h2.4V20h3.1Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  if (name === "tiktok") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M14 6c.6 2.2 2 3.6 4.2 4v2.2c-1.4 0-2.7-.4-3.8-1.2v5.2a4.8 4.8 0 1 1-4.8-4.8c.3 0 .6 0 .8.1v2.3a2.5 2.5 0 1 0 1.6 2.3V6H14Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M8 5.5c0-.8.7-1.5 1.5-1.5h1.2c.6 0 1.1.4 1.3 1l.6 1.7c.2.5 0 1.1-.4 1.4L11 9.4a11 11 0 0 0 3.6 3.6l1.3-1.2c.3-.4.9-.6 1.4-.4l1.7.6c.6.2 1 .7 1 1.3v1.2c0 .8-.7 1.5-1.5 1.5C12.3 16 8 11.7 8 5.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function ListingContact({
  links,
  heading = "Contact & Book",
}: {
  links: ListingContactLink[];
  heading?: string;
}) {
  if (links.length === 0) return null;
  return (
    <div className="listing-contact">
      <p className="eyebrow">Contact</p>
      <h2>{heading}</h2>
      <div className="listing-contact-row">
        {links.map((link) => (
          <a
            key={link.key}
            href={link.href}
            aria-label={link.label}
            title={link.label}
            {...(link.external ? { target: "_blank", rel: "noreferrer" } : {})}
          >
            <Icon name={link.key} />
          </a>
        ))}
      </div>
    </div>
  );
}
