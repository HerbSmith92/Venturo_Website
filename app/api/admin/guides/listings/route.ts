import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { linkedAuthorIdForUser } from "@/lib/control-room-authors";
import { isStaff } from "@/lib/roles";
import {
  loadSpotlightListingDetails,
  searchGuideFillListings,
  searchGuideListings,
} from "@/lib/control-room-guides";
import { parseGuideIds, parseGuideInterestIds } from "@/lib/guide-shared";

function coordinate(value: string | null) {
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function GET(request: Request) {
  const session = await getStaffSession();
  const writer = session ? Boolean(await linkedAuthorIdForUser(session.id)) : false;
  if (!isStaff(session?.role) && !writer) {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }

  const url = new URL(request.url);
  const fill = url.searchParams.get("fill") === "1";
  const maxPriceRaw = url.searchParams.get("maxPrice");
  if (fill || maxPriceRaw) {
    let maxPrice: number | null = null;
    if (maxPriceRaw) {
      const amount = Number(maxPriceRaw);
      if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
        return NextResponse.json({ error: "Enter an amount above 0." }, { status: 400 });
      }
      maxPrice = amount;
    }
    const lat = coordinate(url.searchParams.get("lat"));
    const lng = coordinate(url.searchParams.get("lng"));
    const result = await searchGuideFillListings({
      maxPrice,
      lat: lat != null && lng != null ? lat : null,
      lng: lat != null && lng != null ? lng : null,
      audience: {
        kindIds: parseGuideIds(url.searchParams.get("kinds"), 10),
        personaIds: parseGuideIds(url.searchParams.get("personas"), 8),
        scaleId: parseGuideIds(url.searchParams.get("scale"), 1)[0] ?? "",
        interestIds: parseGuideInterestIds(url.searchParams.get("interests")),
      },
    });
    if (result.error) {
      return NextResponse.json({ error: result.error, listings: [], total: 0 }, { status: 500 });
    }
    return NextResponse.json(result);
  }

  const listingId = url.searchParams.get("id") ?? "";
  if (listingId) {
    const listing = await loadSpotlightListingDetails(listingId);
    return NextResponse.json({ listing });
  }

  const q = url.searchParams.get("q") ?? "";
  const interestIds = parseGuideInterestIds(url.searchParams.get("interests"));
  const listings = await searchGuideListings(q, interestIds);
  return NextResponse.json({ listings });
}
