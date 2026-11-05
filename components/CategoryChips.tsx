import Link from "next/link";
import { PUBLIC_CATEGORIES } from "@/lib/listings";

export function CategoryChips({
  active = "all",
  hrefBase = "/directory",
  params = {},
}: {
  active?: string;
  hrefBase?: string;
  params?: Record<string, string | undefined>;
}) {
  function hrefFor(id: string) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (!value || key === "category") continue;
      search.set(key, value);
    }
    if (id !== "all") search.set("category", id);
    const query = search.toString();
    return query ? `${hrefBase}?${query}` : hrefBase;
  }

  return (
    <div className="chips" role="list">
      {PUBLIC_CATEGORIES.map((category) => {
        const href = hrefFor(category.id);
        const isActive = active === category.id;
        return (
          <Link
            key={category.id}
            href={href}
            className="chip chip-light"
            style={{
              background: category.colour,
              color: category.ink,
              outline: isActive ? "2px solid #F3BF4A" : "none",
              outlineOffset: "2px",
            }}
          >
            {category.label}
          </Link>
        );
      })}
    </div>
  );
}
