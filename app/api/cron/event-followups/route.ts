import { sendDueEventFollowups } from "@/lib/event-followups";
import { NextResponse } from "next/server";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  }
  const result = await sendDueEventFollowups();
  if ("error" in result && result.error) {
    return NextResponse.json(result, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(request: Request) {
  return GET(request);
}
