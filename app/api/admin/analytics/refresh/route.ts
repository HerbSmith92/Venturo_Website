import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { refreshRemoteAnalytics } from "@/lib/analytics-remote";
import { isStaff } from "@/lib/roles";

export async function POST() {
  const session = await getStaffSession();
  if (!session || !isStaff(session.role)) {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }

  try {
    const remote = await refreshRemoteAnalytics(true);
    return NextResponse.json({ ok: true, remote });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not refresh analytics." },
      { status: 400 },
    );
  }
}
