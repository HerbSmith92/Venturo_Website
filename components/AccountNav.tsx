export function AccountNav({ current }: { current: "profile" | "tickets" | "events" }) {
  const links = [
    { id: "profile" as const, href: "/account", label: "Profile" },
    { id: "tickets" as const, href: "/account/tickets", label: "Tickets" },
    { id: "events" as const, href: "/account/events", label: "My Events" },
  ];

  return (
    <nav className="chips account-nav" aria-label="Account">
      {links.map((link) => (
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
