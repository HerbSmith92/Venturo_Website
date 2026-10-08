import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { searchGuideListings, searchPricedGuideListings } from "@/lib/control-room-guides";
import { parseGuideIds, parseGuideInterestIds } from "@/lib/guide-shared";

function coordinate(value: string | null) {
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function GET(request: Request) {
  const session = await getStaffSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }

  const url = new URL(request.url);
  const maxPriceRaw = url.searchParams.get("maxPrice");
  if (maxPriceRaw) {
    const maxPrice = Number(maxPriceRaw);
    if (!Number.isFinite(maxPrice) || maxPrice <= 0 || maxPrice > 100000) {
      return NextResponse.json({ error: "Enter an amount above 0." }, { status: 400 });
    }
    const lat = coordinate(url.searchParams.get("lat"));
    const lng = coordinate(url.searchParams.get("lng"));
    const result = await searchPricedGuideListings({
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
    return NextResponse.json(result);
  }

  const q = url.searchParams.get("q") ?? "";
  const interestIds = parseGuideInterestIds(url.searchParams.get("interests"));
  const listings = await searchGuideListings(q, interestIds);
  return NextResponse.json({ listings });
}
