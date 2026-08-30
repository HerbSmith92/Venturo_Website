import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { getPayFastConfig, verifyPayFastSignature } from "@/lib/payfast";

export async function POST(request: Request) {
  const config = getPayFastConfig();
  if (!config) {
    return new NextResponse("PayFast not configured", { status: 503 });
  }

  const form = await request.formData();
  const data: Record<string, string> = {};
  form.forEach((value, key) => {
    data[key] = String(value);
  });

  if (!verifyPayFastSignature(data, config.passphrase)) {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  const paymentStatus = data.payment_status;
  const mPaymentId = data.m_payment_id;
  const paymentId = data.pf_payment_id;

  if (!mPaymentId) {
    return new NextResponse("Missing payment id", { status: 400 });
  }

  const service = createServiceClient();
  if (!service) {
    return new NextResponse("Service unavailable", { status: 503 });
  }

  const { data: order } = await service
    .from("event_orders")
    .select("id, total_cents, status")
    .eq("m_payment_id", mPaymentId)
    .maybeSingle();

  if (!order) {
    return new NextResponse("Order not found", { status: 404 });
  }

  if (paymentStatus === "COMPLETE") {
    const amount = Number(data.amount_gross);
    const expected = order.total_cents / 100;
    if (Number.isFinite(amount) && Math.abs(amount - expected) > 0.01) {
      return new NextResponse("Amount mismatch", { status: 400 });
    }

    if (order.status !== "paid") {
      const { error } = await service.rpc("fulfill_event_order", {
        p_order_id: order.id,
        p_payment_id: paymentId ?? null,
      });
      if (error) {
        return new NextResponse(error.message, { status: 500 });
      }
    }
  } else if (paymentStatus === "FAILED" || paymentStatus === "CANCELLED") {
    await service
      .from("event_orders")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", order.id)
      .eq("status", "pending");
  }

  return new NextResponse("OK", { status: 200 });
}
