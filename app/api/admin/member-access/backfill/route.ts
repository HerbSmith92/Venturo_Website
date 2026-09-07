import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { backfillMemberAccessFromSources } from "@/lib/member-access";
import { isAdmin } from "@/lib/roles";

export async function POST() {
  const session = await getStaffSession();
  if (!session || !isAdmin(session.role)) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const result = await backfillMemberAccessFromSources();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 503 });
  }
  return NextResponse.json(result);
}
