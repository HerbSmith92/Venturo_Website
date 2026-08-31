import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { searchGuideListings } from "@/lib/control-room-guides";
import { parseGuideInterestIds } from "@/lib/guide-shared";

export async function GET(request: Request) {
  const session = await getStaffSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const interestIds = parseGuideInterestIds(url.searchParams.get("interests"));
  const listings = await searchGuideListings(q, interestIds);
  return NextResponse.json({ listings });
}
