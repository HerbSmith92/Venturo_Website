import type { ReactNode } from "react";

export function GenderAudienceRow({
  title,
  viewAllHref,
  children,
}: {
  title: string;
  viewAllHref: string;
  children: ReactNode;
}) {
  return (
    <div className="discover-row gender-audience-row">
      <div className="section-head">
        <h2>{title}</h2>
        <a href={viewAllHref}>View all</a>
      </div>
      <div className="taste-rail">{children}</div>
    </div>
  );
}
