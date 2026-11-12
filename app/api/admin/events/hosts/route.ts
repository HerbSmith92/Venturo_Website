import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { searchEventHosts } from "@/lib/event-host";
import { isStaff } from "@/lib/roles";

export async function GET(request: Request) {
  const session = await getStaffSession();
  if (!session || !isStaff(session.role)) {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }

  const q = new URL(request.url).searchParams.get("q") ?? "";
  const hosts = await searchEventHosts(q);
  return NextResponse.json({ hosts });
}
