import type { GuideSort } from "@/lib/guide-engagement";

const OPTIONS: { id: GuideSort; label: string; href: string }[] = [
  { id: "newest", label: "Newest", href: "/guides" },
  { id: "popular", label: "Most Popular", href: "/guides?sort=popular" },
  { id: "viewed", label: "Most Viewed", href: "/guides?sort=viewed" },
];

export function GuideSortNav({ sort }: { sort: GuideSort }) {
  return (
    <nav className="chips guide-sort" aria-label="Sort guides">
      {OPTIONS.map((option) => (
        <a
          key={option.id}
          href={option.href}
          className={sort === option.id ? "chip on" : "chip"}
          aria-current={sort === option.id ? "page" : undefined}
        >
          {option.label}
        </a>
      ))}
    </nav>
  );
}
