import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import type { DirectoryQuery } from "@/lib/listings";
import type { ActivityPlatform } from "@/lib/member-activity";
import { directoryResultCount, recordDirectorySearch } from "@/lib/search-misses";
import { bearerToken, identityFromBearer } from "@/lib/supabase/bearer";

const BOT_UA =
  /bot|crawler|spider|crawling|preview|slurp|facebookexternalhit|whatsapp|telegram|discord|embedly/i;

function platformFrom(value: unknown): ActivityPlatform {
  if (value === "ios" || value === "android" || value === "web") return value;
  return "unknown";
}

/** Apps report a directory search. The result count is checked here before it is kept. */
export async function POST(request: Request) {
  const ua = request.headers.get("user-agent") ?? "";
  if (!ua || BOT_UA.test(ua)) return new NextResponse(null, { status: 204 });

  const token = bearerToken(request);
  const actor = token ? await identityFromBearer(token) : await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Log in to continue." }, { status: 401 });

  let body: {
    q?: string;
    place?: string;
    category?: string;
    price?: string;
    lat?: string;
    lng?: string;
    platform?: string;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Send the search." }, { status: 400 });
  }

  const query: DirectoryQuery = {
    q: body.q,
    place: body.place,
    category: body.category,
    price: body.price,
    lat: body.lat,
    lng: body.lng,
  };
  const count = await directoryResultCount(query);
  if (count === null) return NextResponse.json({ error: "Send the search." }, { status: 400 });

  await recordDirectorySearch({
    userId: actor.id,
    visitorKey: null,
    platform: platformFrom(body.platform),
    query,
    resultCount: count,
  });
  return new NextResponse(null, { status: 204 });
}
