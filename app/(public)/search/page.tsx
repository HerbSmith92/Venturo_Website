import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchExperience } from "@/components/search/SearchExperience";
import { runPublicSearch } from "@/lib/search";

export const metadata: Metadata = {
  title: "Search · Venturo",
  description: "Find activities, events & communities near you.",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    place?: string;
    lat?: string;
    lng?: string;
    tab?: string;
    setting?: string | string[];
    levelMin?: string;
    levelMax?: string;
    page?: string;
    audience?: string;
  }>;
}) {
  const params = await searchParams;
  let initial;
  let failed = false;
  try {
    initial = await runPublicSearch(params);
  } catch {
    failed = true;
    initial = await runPublicSearch({});
  }

  return (
    <main>
      {failed ? (
        <div className="shell">
          <p className="error">Search hit a snag. Showing an open browse instead — try again in a moment.</p>
        </div>
      ) : null}
      <Suspense fallback={<div className="shell"><p className="muted">Loading search…</p></div>}>
        <SearchExperience initial={initial} />
      </Suspense>
    </main>
  );
}
