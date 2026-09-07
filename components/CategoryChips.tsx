import Link from "next/link";
import { CATEGORIES } from "@/lib/listings";

export function CategoryChips({
  active = "all",
  hrefBase = "/directory",
}: {
  active?: string;
  hrefBase?: string;
}) {
  return (
    <div className="chips" role="list">
      {CATEGORIES.map((category) => {
        const href =
          category.id === "all"
            ? hrefBase
            : `${hrefBase}?category=${category.id}`;
        const isActive = active === category.id;
        return (
          <Link
            key={category.id}
            href={href}
            className="chip chip-light"
            style={{
              background: category.colour,
              color: category.id === "third-party" ? "#EBEBF3" : "#2A2D35",
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
