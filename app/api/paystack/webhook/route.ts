import { NextResponse } from "next/server";
import { handlePaystackEvent } from "@/lib/paystack-fulfill";
import { getPaystackConfig, verifyPaystackSignature } from "@/lib/paystack";

export async function POST(request: Request) {
  const config = getPaystackConfig();
  if (!config) {
    return new NextResponse("Paystack not configured", { status: 503 });
  }

  const raw = await request.text();
  const signature = request.headers.get("x-paystack-signature");
  if (!verifyPaystackSignature(raw, signature, config.secretKey)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let event: { event?: string; data?: unknown };
  try {
    event = JSON.parse(raw) as { event?: string; data?: unknown };
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  if (!event.event) return new NextResponse("OK", { status: 200 });

  try {
    await handlePaystackEvent(event.event, event.data);
  } catch (error) {
    console.error("paystack webhook", error);
    return new NextResponse("Webhook failed", { status: 500 });
  }

  return new NextResponse("OK", { status: 200 });
}
