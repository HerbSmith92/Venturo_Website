const LINKS = [
  { id: "profile", href: "/account", label: "Profile" },
  { id: "saved", href: "/account/saved", label: "Saved" },
  { id: "tickets", href: "/account/tickets", label: "Tickets" },
  { id: "communities", href: "/account/communities", label: "Communities" },
  { id: "reviews", href: "/account/reviews", label: "Reviews" },
  { id: "events", href: "/account/events", label: "My Events" },
  { id: "membership", href: "/account/membership", label: "Membership" },
  { id: "privacy", href: "/account/privacy", label: "Privacy" },
] as const;

export type AccountSection = (typeof LINKS)[number]["id"];

export function AccountNav({ current }: { current: AccountSection }) {
  return (
    <nav className="chips account-nav" aria-label="My Venturo">
      {LINKS.map((link) => (
        <a
          key={link.id}
          href={link.href}
          className={current === link.id ? "chip active" : "chip"}
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}
