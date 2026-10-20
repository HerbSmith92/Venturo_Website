import { NextResponse } from "next/server";

/** PayFast was rejected. New checkouts use Paystack. */
export async function GET() {
  return NextResponse.json({
    retired: true,
    provider: "paystack",
    statusUrl: "/api/paystack/status",
  });
}
