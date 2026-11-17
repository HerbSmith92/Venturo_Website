import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import {
  loadAutomaticHotCards,
  previewFilterCards,
  searchAppHomeContent,
} from "@/lib/app-home-content";
import { isAppHomeScreen } from "@/lib/app-home-types";
import { isAdmin } from "@/lib/roles";

export async function GET(request: Request) {
  const session = await getStaffSession();
  if (!session || !isAdmin(session.role)) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const url = new URL(request.url);
  const screen = url.searchParams.get("screen") ?? "";
  if (!isAppHomeScreen(screen)) {
    return NextResponse.json({ error: "Unknown screen." }, { status: 400 });
  }

  const mode = url.searchParams.get("mode") ?? "search";
  const maxItems = Number(url.searchParams.get("maxItems") ?? "12");

  if (mode === "automatic") {
    let rules: Record<string, unknown> = {};
    try {
      rules = JSON.parse(url.searchParams.get("rules") ?? "{}") as Record<string, unknown>;
    } catch {
      rules = {};
    }
    const items = await loadAutomaticHotCards(screen, rules, maxItems);
    return NextResponse.json({ items });
  }

  if (mode === "filter") {
    let rules: Record<string, unknown> = {};
    try {
      rules = JSON.parse(url.searchParams.get("rules") ?? "{}") as Record<string, unknown>;
    } catch {
      rules = {};
    }
    const items = await previewFilterCards({ screen, rules, maxItems });
    return NextResponse.json({ items });
  }

  const items = await searchAppHomeContent({
    screen,
    q: url.searchParams.get("q") ?? "",
    limit: maxItems,
  });
  return NextResponse.json({ items });
}
