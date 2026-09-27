import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { saveManualDownloads } from "@/lib/analytics-remote";
import { isStaff } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const session = await getStaffSession();
  if (!session || !isStaff(session.role)) {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }

  const body = (await request.json()) as {
    iosDownloads?: number;
    androidDownloads?: number;
  };
  const iosDownloads = Math.round(Number(body.iosDownloads));
  const androidDownloads = Math.round(Number(body.androidDownloads));
  if (!Number.isFinite(iosDownloads) || iosDownloads < 0) {
    return NextResponse.json({ error: "iOS downloads must be 0 or more." }, { status: 400 });
  }
  if (!Number.isFinite(androidDownloads) || androidDownloads < 0) {
    return NextResponse.json({ error: "Android downloads must be 0 or more." }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not connected." }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("app_download_snapshots")
    .insert({
      ios_downloads: iosDownloads,
      android_downloads: androidDownloads,
      recorded_by: session.id,
    })
    .select("ios_downloads, android_downloads, recorded_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Could not save downloads." }, { status: 400 });
  }

  await saveManualDownloads(iosDownloads, androidDownloads);

  return NextResponse.json({
    iosDownloads: data.ios_downloads,
    androidDownloads: data.android_downloads,
    recordedAt: data.recorded_at,
  });
}
