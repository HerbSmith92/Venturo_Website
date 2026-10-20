import {
  fulfillPaystackMembership,
  rememberPaystackSubscription,
} from "@/lib/memberships";
import {
  getPaystackConfig,
  verifyPaystackTransaction,
  type PaystackTransaction,
} from "@/lib/paystack";
import { sendTicketEmail } from "@/lib/ticket-email";
import { stampTicketContact } from "@/lib/ticket-contact";
import { createServiceClient } from "@/lib/supabase/admin";

function metadataKind(metadata: Record<string, unknown> | null) {
  const kind = metadata?.kind;
  if (kind === "ticket" || kind === "membership") return kind;
  return null;
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function fulfillTicket(txn: PaystackTransaction) {
  const service = createServiceClient();
  if (!service) throw new Error("Service unavailable");

  const { data: order } = await service
    .from("event_orders")
    .select("id, total_cents, status")
    .eq("m_payment_id", txn.reference)
    .maybeSingle();

  if (!order) throw new Error("Order not found");

  if (txn.status === "success") {
    if (txn.currency !== "ZAR") throw new Error("Currency mismatch");
    if (txn.amount !== order.total_cents) throw new Error("Amount mismatch");
    if (order.status !== "paid") {
      const { error } = await service.rpc("fulfill_event_order", {
        p_order_id: order.id,
        p_payment_id: String(txn.id),
      });
      if (error) throw new Error(error.message);
    }
    await stampTicketContact(order.id);
    await sendTicketEmail(order.id);
    return;
  }

  if (txn.status === "failed" || txn.status === "abandoned") {
    await service
      .from("event_orders")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", order.id)
      .eq("status", "pending");
  }
}

async function settleCharge(txn: PaystackTransaction, outcome: "success" | "failed") {
  const kind = metadataKind(txn.metadata);
  const ticket = kind === "ticket" || txn.reference.startsWith("evt-");
  const membership =
    kind === "membership" || txn.reference.startsWith("mem-") || Boolean(txn.planCode);

  if (ticket) {
    await fulfillTicket(txn);
    return;
  }

  if (!membership) return;

  if (outcome === "success") {
    if (txn.currency !== "ZAR") throw new Error("Currency mismatch");
    const result = await fulfillPaystackMembership({
      reference: txn.reference,
      customerCode: txn.customerCode,
      payerEmail: txn.customerEmail,
      paymentStatus: "COMPLETE",
      transactionId: String(txn.id),
      amountCents: txn.amount,
      paystackCustomerCode: txn.customerCode,
    });
    if (!result.ok) {
      if (result.error === "Membership not found" && !txn.reference.startsWith("mem-")) return;
      throw new Error(result.error);
    }
    return;
  }

  if (txn.status !== "failed" && txn.status !== "abandoned") return;
  const result = await fulfillPaystackMembership({
    reference: txn.reference,
    customerCode: txn.customerCode,
    payerEmail: txn.customerEmail,
    paymentStatus: "FAILED",
    transactionId: String(txn.id),
  });
  if (!result.ok && result.error !== "Membership not found") throw new Error(result.error);
}

export async function handlePaystackEvent(eventName: string, data: unknown) {
  const config = getPaystackConfig();
  if (!config) throw new Error("Paystack not configured");
  const payload = asRecord(data) ?? {};

  if (eventName === "charge.success" || eventName === "charge.failed") {
    const reference = asString(payload.reference);
    if (!reference) return;
    const txn = await verifyPaystackTransaction(config.secretKey, reference);
    if (!txn) throw new Error("Could not verify the Paystack transaction.");
    if (eventName === "charge.success") {
      if (txn.status !== "success") throw new Error("Paystack did not confirm success.");
      await settleCharge(txn, "success");
      return;
    }
    if (txn.status === "success") return;
    await settleCharge(txn, "failed");
    return;
  }

  if (eventName === "subscription.create") {
    const subscriptionCode = asString(payload.subscription_code);
    if (!subscriptionCode) return;
    const customer = asRecord(payload.customer);
    const result = await rememberPaystackSubscription({
      subscriptionCode,
      emailToken: asString(payload.email_token),
      customerCode: asString(customer?.customer_code),
      payerEmail: asString(customer?.email),
      nextPaymentDate: asString(payload.next_payment_date),
    });
    if (!result.ok) throw new Error(result.error);
    return;
  }

  if (eventName === "subscription.disable") {
    const subscriptionCode = asString(payload.subscription_code);
    if (!subscriptionCode) return;
    const customer = asRecord(payload.customer);
    const result = await fulfillPaystackMembership({
      subscriptionCode,
      customerCode: asString(customer?.customer_code),
      payerEmail: asString(customer?.email),
      paymentStatus: "CANCELLED",
    });
    if (!result.ok && result.error !== "Membership not found") throw new Error(result.error);
  }
}

export async function confirmPaystackTicket(orderId: string, userId: string) {
  try {
    const config = getPaystackConfig();
    const service = createServiceClient();
    if (!config || !service) return;

    const { data: order } = await service
      .from("event_orders")
      .select("id, buyer_id, status, m_payment_id")
      .eq("id", orderId)
      .maybeSingle();
    if (!order || order.buyer_id !== userId || order.status === "paid") return;
    if (typeof order.m_payment_id !== "string" || !order.m_payment_id) return;

    const txn = await verifyPaystackTransaction(config.secretKey, order.m_payment_id);
    if (!txn || txn.status !== "success" || txn.reference !== order.m_payment_id) return;
    await fulfillTicket(txn);
  } catch (error) {
    console.error("confirmPaystackTicket", error);
  }
}

export async function confirmPaystackMembership(membershipId: string, userId: string) {
  try {
    const config = getPaystackConfig();
    const service = createServiceClient();
    if (!config || !service) return;

    const { data: membership } = await service
      .from("memberships")
      .select("id, user_id, status, m_payment_id")
      .eq("id", membershipId)
      .maybeSingle();
    if (!membership || membership.user_id !== userId || membership.status === "active") return;
    if (typeof membership.m_payment_id !== "string" || !membership.m_payment_id) return;

    const txn = await verifyPaystackTransaction(config.secretKey, membership.m_payment_id);
    if (!txn || txn.status !== "success" || txn.currency !== "ZAR") return;
    if (txn.reference !== membership.m_payment_id) return;

    const result = await fulfillPaystackMembership({
      reference: txn.reference,
      customerCode: txn.customerCode,
      payerEmail: txn.customerEmail,
      paymentStatus: "COMPLETE",
      transactionId: String(txn.id),
      amountCents: txn.amount,
      paystackCustomerCode: txn.customerCode,
    });
    if (!result.ok) console.error("confirmPaystackMembership", result.error);
  } catch (error) {
    console.error("confirmPaystackMembership", error);
  }
}
