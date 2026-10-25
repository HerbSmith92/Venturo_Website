import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { recordMemberActivity, type ActivityPlatform } from "@/lib/member-activity";
import { isUsageKind } from "@/lib/member-usage";
import { isStaff } from "@/lib/roles";
import { bearerToken, identityFromBearer } from "@/lib/supabase/bearer";

const BOT_UA =
  /bot|crawler|spider|crawling|preview|slurp|facebookexternalhit|whatsapp|telegram|discord|embedly/i;

function platformFrom(value: unknown, fromApp: boolean): ActivityPlatform {
  if (value === "ios" || value === "android" || value === "web") return value;
  return fromApp ? "unknown" : "web";
}

/** Records that a signed-in person scrolled, or opened a listing, event, or community. */
export async function POST(request: Request) {
  const ua = request.headers.get("user-agent") ?? "";
  if (!ua || BOT_UA.test(ua)) return new NextResponse(null, { status: 204 });

  const token = bearerToken(request);
  const actor = token ? await identityFromBearer(token) : await getStaffSession();
  if (!actor) return NextResponse.json({ error: "Log in to continue." }, { status: 401 });
  if (isStaff(actor.role)) return new NextResponse(null, { status: 204 });

  let body: { kind?: string; platform?: string } = {};
  try {
    body = (await request.json()) as { kind?: string; platform?: string };
  } catch {
    return NextResponse.json({ error: "Send a usage kind." }, { status: 400 });
  }
  if (!isUsageKind(body.kind)) {
    return NextResponse.json({ error: "Unknown usage kind." }, { status: 400 });
  }

  await recordMemberActivity(actor.id, body.kind, platformFrom(body.platform, Boolean(token)));
  return new NextResponse(null, { status: 204 });
}
