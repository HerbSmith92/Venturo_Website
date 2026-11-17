import { NextResponse } from "next/server";
import { isAppHomeScreen, loadPublishedAppHome } from "@/lib/app-home";

export const revalidate = 60;

export async function GET(request: Request) {
  const screen = new URL(request.url).searchParams.get("screen") ?? "discover";
  if (!isAppHomeScreen(screen)) {
    return NextResponse.json(
      { error: "screen must be discover, events or community." },
      { status: 400 },
    );
  }

  const home = await loadPublishedAppHome(screen);
  return NextResponse.json(
    {
      contractVersion: "2026-11-17",
      timezone: "Africa/Johannesburg",
      configured: home.banners.length > 0 || home.rows.some((row) => row.items.length > 0),
      ...home,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}
