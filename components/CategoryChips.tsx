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
            className={
              category.id === "all" || category.id === "third-party"
                ? "chip chip-light"
                : "chip"
            }
            style={{
              background: category.colour,
              color: category.id === "third-party" ? "#EBEBF3" : undefined,
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
