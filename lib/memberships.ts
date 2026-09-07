import { PAID_AMOUNT_CENTS, PAID_AMOUNT_RANDS } from "@/lib/brand";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getPublicSiteUrl } from "@/lib/site-url";
import { randomBytes } from "crypto";

export type MembershipRow = {
  id: string;
  user_id: string;
  status: "pending" | "active" | "cancelled" | "failed";
  amount_cents: number;
  m_payment_id: string;
  payfast_payment_id: string | null;
  payfast_token: string | null;
  current_period_end: string | null;
  last_payment_at: string | null;
};

type MembershipRecord = {
  id: string;
  user_id: string;
  status: string;
  amount_cents: number;
  bundled_order_id: string | null;
};

function newMembershipPaymentId() {
  return `mem_${randomBytes(12).toString("hex")}`;
}

function periodEndFrom(now = new Date()) {
  const end = new Date(now);
  end.setMonth(end.getMonth() + 1);
  return end.toISOString();
}

function amountMatches(amountGross: string | null | undefined, expectedCents: number) {
  const amount = Number(amountGross);
  if (!Number.isFinite(amount)) return true;
  return Math.abs(amount - expectedCents / 100) <= 0.01;
}

export async function isPayFastMembershipActive(userId: string) {
  const supabase = await createClient();
  if (!supabase) return false;
  const { data } = await supabase
    .from("memberships")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  return Boolean(data?.id);
}

export async function getPayFastMembershipMap(userIds: string[]) {
  const map = new Map<string, boolean>();
  if (userIds.length === 0) return map;
  const service = createServiceClient();
  const client = service ?? (await createClient());
  if (!client) return map;

  const { data } = await client
    .from("memberships")
    .select("user_id")
    .in("user_id", userIds)
    .eq("status", "active");

  for (const row of data ?? []) {
    if (typeof row.user_id === "string") map.set(row.user_id, true);
  }
  return map;
}

export async function createMembershipCheckout(input: {
  userId: string;
  email?: string;
  firstName?: string;
  origin: string;
  /** Join & buy: always a new pending row, linked to the ticket order. */
  bundledOrderId?: string;
  returnUrl?: string;
  cancelUrl?: string;
  itemName?: string;
}) {
  const service = createServiceClient();
  if (!service) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for membership checkout.");
  }

  let membershipId: string | undefined;
  let mPaymentId: string | undefined;

  // Standalone subscribe may reuse a bounced pending row. Join & buy must not
  // steal that row or inherit a previous bundled order.
  if (!input.bundledOrderId) {
    const { data: existing } = await service
      .from("memberships")
      .select("id, m_payment_id, amount_cents, status")
      .eq("user_id", input.userId)
      .eq("status", "pending")
      .is("bundled_order_id", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    membershipId = existing?.id as string | undefined;
    mPaymentId = existing?.m_payment_id as string | undefined;
  }

  if (!membershipId || !mPaymentId) {
    mPaymentId = newMembershipPaymentId();
    const { data, error } = await service
      .from("memberships")
      .insert({
        user_id: input.userId,
        status: "pending",
        provider: "payfast",
        amount_cents: PAID_AMOUNT_CENTS,
        m_payment_id: mPaymentId,
        bundled_order_id: input.bundledOrderId ?? null,
      })
      .select("id, m_payment_id")
      .single();
    if (error || !data) {
      throw new Error(error?.message ?? "Could not create membership checkout.");
    }
    membershipId = data.id;
    mPaymentId = data.m_payment_id;
  }

  if (!membershipId || !mPaymentId) {
    throw new Error("Could not create membership checkout.");
  }

  const publicOrigin = getPublicSiteUrl(input.origin);
  return {
    membershipId,
    mPaymentId,
    amountCents: PAID_AMOUNT_CENTS,
    amountRands: PAID_AMOUNT_RANDS,
    returnUrl:
      input.returnUrl ?? `${publicOrigin}/join/subscribe/return?membership=${membershipId}`,
    cancelUrl: input.cancelUrl ?? `${publicOrigin}/join/subscribe?cancelled=1`,
    notifyUrl: `${publicOrigin}/api/payfast/itn`,
    itemName: input.itemName ?? "Venturo Membership",
  };
}

export async function fulfillPayFastMembership(input: {
  mPaymentId: string;
  paymentStatus: string;
  paymentId?: string | null;
  token?: string | null;
  amountGross?: string | null;
}) {
  const service = createServiceClient();
  if (!service) return { ok: false as const, error: "Service unavailable" };

  const membershipSelect = "id, user_id, status, amount_cents, bundled_order_id";

  let membership: MembershipRecord | null = null;

  if (input.mPaymentId) {
    const { data } = await service
      .from("memberships")
      .select(membershipSelect)
      .eq("m_payment_id", input.mPaymentId)
      .maybeSingle();
    membership = data;
  }

  // Recurring ITNs can arrive with token only after the first payment.
  if (!membership && input.token) {
    const { data: byToken } = await service
      .from("memberships")
      .select(membershipSelect)
      .eq("payfast_token", input.token)
      .maybeSingle();
    membership = byToken;
  }

  if (!membership) return { ok: false as const, error: "Membership not found" };
  return fulfillMembershipRow(service, membership, input);
}

async function loadBundledOrder(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
  orderId: string | null,
) {
  if (!orderId) return null;
  const { data } = await service
    .from("event_orders")
    .select("id, total_cents, status")
    .eq("id", orderId)
    .maybeSingle();
  return data as { id: string; total_cents: number; status: string } | null;
}

async function failBundledOrder(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
  orderId: string | null,
) {
  if (!orderId) return;
  await service
    .from("event_orders")
    .update({ status: "failed", updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "pending");
}

async function fulfillBundledOrder(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
  orderId: string,
  paymentId?: string | null,
) {
  const { error } = await service.rpc("fulfill_event_order", {
    p_order_id: orderId,
    p_payment_id: paymentId ?? null,
  });
  return error;
}

async function fulfillMembershipRow(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
  membership: MembershipRecord,
  input: {
    paymentStatus: string;
    paymentId?: string | null;
    token?: string | null;
    amountGross?: string | null;
  },
) {
  const now = new Date();
  const bundled = await loadBundledOrder(service, membership.bundled_order_id);

  if (input.paymentStatus === "COMPLETE") {
    const membershipOnly = amountMatches(input.amountGross, membership.amount_cents);
    const combinedCents = bundled
      ? membership.amount_cents + bundled.total_cents
      : null;
    const combinedOk =
      combinedCents !== null && amountMatches(input.amountGross, combinedCents);
    const orderUnpaid = Boolean(bundled && bundled.status !== "paid");
    const firstBundleCharge =
      membership.status === "pending" && orderUnpaid && (bundled?.total_cents ?? 0) > 0;

    if (firstBundleCharge ? !combinedOk : !membershipOnly && !combinedOk) {
      return { ok: false as const, error: "Amount mismatch" };
    }

    const patch: Record<string, unknown> = {
      status: "active",
      payfast_payment_id: input.paymentId ?? null,
      last_payment_at: now.toISOString(),
      current_period_end: periodEndFrom(now),
      cancelled_at: null,
      updated_at: now.toISOString(),
    };
    if (input.token) patch.payfast_token = input.token;

    const { error } = await service.from("memberships").update(patch).eq("id", membership.id);
    if (error) return { ok: false as const, error: error.message };

    if (bundled && bundled.status !== "paid") {
      const fulfillError = await fulfillBundledOrder(service, bundled.id, input.paymentId);
      if (fulfillError) return { ok: false as const, error: fulfillError.message };
    }

    return { ok: true as const, membershipId: membership.id, userId: membership.user_id };
  }

  if (input.paymentStatus === "CANCELLED") {
    await service
      .from("memberships")
      .update({
        status: "cancelled",
        cancelled_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", membership.id);
    await failBundledOrder(service, membership.bundled_order_id);
    return { ok: true as const, membershipId: membership.id, userId: membership.user_id };
  }

  if (input.paymentStatus === "FAILED" && membership.status === "pending") {
    await service
      .from("memberships")
      .update({ status: "failed", updated_at: now.toISOString() })
      .eq("id", membership.id);
    await failBundledOrder(service, membership.bundled_order_id);
    return { ok: true as const, membershipId: membership.id, userId: membership.user_id };
  }

  return { ok: true as const, membershipId: membership.id, userId: membership.user_id };
}

export async function loadMembershipForUser(userId: string, membershipId: string) {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("memberships")
    .select(
      "id, user_id, status, amount_cents, m_payment_id, payfast_payment_id, payfast_token, current_period_end, last_payment_at",
    )
    .eq("id", membershipId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as MembershipRow | null) ?? null;
}
