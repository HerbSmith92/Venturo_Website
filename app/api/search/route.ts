import { NextResponse } from "next/server";
import { runPublicSearch, type SearchQuery } from "@/lib/search";

export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const setting = searchParams.getAll("setting");
    const query: SearchQuery = {
      q: first(searchParams.get("q") ?? undefined),
      place: first(searchParams.get("place") ?? undefined),
      lat: first(searchParams.get("lat") ?? undefined),
      lng: first(searchParams.get("lng") ?? undefined),
      tab: first(searchParams.get("tab") ?? undefined),
      setting: setting.length > 1 ? setting : setting[0] ?? searchParams.get("setting") ?? undefined,
      levelMin: first(searchParams.get("levelMin") ?? undefined),
      levelMax: first(searchParams.get("levelMax") ?? undefined),
      page: first(searchParams.get("page") ?? undefined),
      audience: first(searchParams.get("audience") ?? undefined),
    };
    const payload = await runPublicSearch(query);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
