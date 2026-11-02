import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { linkedAuthorIdForUser } from "@/lib/control-room-authors";
import { EXPORT_IMAGE_MAX_BYTES, isAllowedExportImageUrl } from "@/lib/export-image";
import { isStaff } from "@/lib/roles";

export async function GET(request: Request) {
  const session = await getStaffSession();
  const writer = session ? Boolean(await linkedAuthorIdForUser(session.id)) : false;
  if (!isStaff(session?.role) && !writer) {
    return new NextResponse("Staff only.", { status: 403 });
  }

  const url = new URL(request.url).searchParams.get("url") ?? "";
  if (!isAllowedExportImageUrl(url)) {
    return new NextResponse("Image not allowed.", { status: 400 });
  }

  const upstream = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    headers: { Accept: "image/*" },
  });
  if (!upstream.ok) {
    return new NextResponse("Image unavailable.", { status: 502 });
  }
  if (upstream.redirected && !isAllowedExportImageUrl(upstream.url)) {
    return new NextResponse("Image not allowed.", { status: 400 });
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("image/")) {
    return new NextResponse("Not an image.", { status: 400 });
  }

  const buffer = Buffer.from(await upstream.arrayBuffer());
  if (buffer.length > EXPORT_IMAGE_MAX_BYTES) {
    return new NextResponse("Image too large.", { status: 413 });
  }

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
