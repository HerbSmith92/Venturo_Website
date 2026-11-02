import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { linkedAuthorIdForUser } from "@/lib/control-room-authors";
import { isStaff } from "@/lib/roles";
import { searchEventGuideEvents, searchEventGuideFill } from "@/lib/control-room-event-guides";

function coordinate(value: string | null) {
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function labels(value: string | null) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 16);
}

function ranks(value: string | null) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((rank) => Number.isInteger(rank) && rank >= 1 && rank <= 5)
    .slice(0, 5);
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
      maxPrice = Math.round(amount * 100);
    }
    const lat = coordinate(url.searchParams.get("lat"));
    const lng = coordinate(url.searchParams.get("lng"));
    const result = await searchEventGuideFill({
      maxPriceCents: maxPrice,
      lat: lat != null && lng != null ? lat : null,
      lng: lat != null && lng != null ? lng : null,
      audience: {
        interestLabels: labels(url.searchParams.get("interests")),
        personaLabels: labels(url.searchParams.get("personas")),
        energyRanks: ranks(url.searchParams.get("energy")),
      },
    });
    if (result.error) {
      return NextResponse.json({ error: result.error, events: [], total: 0 }, { status: 500 });
    }
    return NextResponse.json(result);
  }

  const q = url.searchParams.get("q") ?? "";
  const events = await searchEventGuideEvents(q);
  return NextResponse.json({ events });
}
