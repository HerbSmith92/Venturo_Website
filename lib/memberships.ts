import { PAID_AMOUNT_CENTS, PAID_AMOUNT_RANDS } from "@/lib/brand";
import { setPayFastAccess } from "@/lib/member-access";
import { newPaystackReference, PAYSTACK_WEBHOOK_PATH } from "@/lib/paystack";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getPublicSiteUrl } from "@/lib/site-url";

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

function payerEmail(email?: string) {
  const trimmed = email?.trim().toLowerCase();
  return trimmed || null;
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
  const email = payerEmail(input.email);

  // Standalone subscribe may reuse a bounced pending Paystack row, with a fresh
  // reference so a failed attempt can start again. Join & buy must not steal
  // that row or inherit a previous bundled order.
  if (!input.bundledOrderId) {
    const { data: existing } = await service
      .from("memberships")
      .select("id")
      .eq("user_id", input.userId)
      .eq("status", "pending")
      .eq("provider", "paystack")
      .is("bundled_order_id", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      mPaymentId = newPaystackReference("mem");
      const { error } = await service
        .from("memberships")
        .update({
          m_payment_id: mPaymentId,
          amount_cents: PAID_AMOUNT_CENTS,
          payer_email: email,
          provider: "paystack",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      membershipId = existing.id as string;
    }
  }

  if (!membershipId || !mPaymentId) {
    mPaymentId = newPaystackReference("mem");
    const { data, error } = await service
      .from("memberships")
      .insert({
        user_id: input.userId,
        status: "pending",
        provider: "paystack",
        amount_cents: PAID_AMOUNT_CENTS,
        m_payment_id: mPaymentId,
        payer_email: email,
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

  const origin = input.origin.replace(/\/$/, "");
  const publicOrigin = getPublicSiteUrl(input.origin);
  return {
    membershipId,
    mPaymentId,
    amountCents: PAID_AMOUNT_CENTS,
    amountRands: PAID_AMOUNT_RANDS,
    returnUrl:
      input.returnUrl ?? `${origin}/join/subscribe/return?membership=${membershipId}`,
    cancelUrl: input.cancelUrl ?? `${origin}/join/subscribe?cancelled=1`,
    notifyUrl: `${publicOrigin}${PAYSTACK_WEBHOOK_PATH}`,
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

async function syncPayFastAccessFromMemberships(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
  userId: string,
) {
  const { data } = await service
    .from("memberships")
    .select("id, current_period_end")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  return setPayFastAccess(
    userId,
    Boolean(data?.id),
    typeof data?.current_period_end === "string" ? data.current_period_end : null,
  );
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

type MembershipSettleInput = {
  paymentStatus: string;
  paymentId?: string | null;
  token?: string | null;
  amountGross?: string | null;
  paystack?: {
    transactionId?: string | null;
    customerCode?: string | null;
    subscriptionCode?: string | null;
    emailToken?: string | null;
    periodEnd?: string | null;
  };
};

async function findPaystackMembership(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
  lookup: {
    reference?: string | null;
    customerCode?: string | null;
    payerEmail?: string | null;
    subscriptionCode?: string | null;
  },
) {
  const membershipSelect = "id, user_id, status, amount_cents, bundled_order_id";

  if (lookup.reference) {
    const { data } = await service
      .from("memberships")
      .select(membershipSelect)
      .eq("m_payment_id", lookup.reference)
      .maybeSingle();
    if (data) return data as MembershipRecord;
  }

  if (lookup.subscriptionCode) {
    const { data } = await service
      .from("memberships")
      .select(membershipSelect)
      .eq("paystack_subscription_code", lookup.subscriptionCode)
      .maybeSingle();
    if (data) return data as MembershipRecord;
  }

  if (lookup.customerCode) {
    const { data } = await service
      .from("memberships")
      .select(membershipSelect)
      .eq("paystack_customer_code", lookup.customerCode)
      .in("status", ["pending", "active"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as MembershipRecord;
  }

  const email = lookup.payerEmail?.trim().toLowerCase();
  if (email) {
    const { data } = await service
      .from("memberships")
      .select(membershipSelect)
      .eq("payer_email", email)
      .eq("provider", "paystack")
      .in("status", ["pending", "active"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as MembershipRecord;
  }

  return null;
}

export async function fulfillPaystackMembership(input: {
  reference?: string | null;
  customerCode?: string | null;
  payerEmail?: string | null;
  subscriptionCode?: string | null;
  paymentStatus: "COMPLETE" | "FAILED" | "CANCELLED";
  transactionId?: string | null;
  amountCents?: number | null;
  paystackCustomerCode?: string | null;
  paystackSubscriptionCode?: string | null;
  emailToken?: string | null;
  periodEnd?: string | null;
}) {
  const service = createServiceClient();
  if (!service) return { ok: false as const, error: "Service unavailable" };

  if (input.paymentStatus === "COMPLETE" && typeof input.amountCents !== "number") {
    return { ok: false as const, error: "Amount mismatch" };
  }

  const membership = await findPaystackMembership(service, {
    reference: input.reference,
    customerCode: input.customerCode,
    payerEmail: input.payerEmail,
    subscriptionCode: input.subscriptionCode,
  });
  if (!membership) return { ok: false as const, error: "Membership not found" };

  return fulfillMembershipRow(service, membership, {
    paymentStatus: input.paymentStatus,
    paymentId: input.transactionId,
    amountGross:
      typeof input.amountCents === "number" ? (input.amountCents / 100).toFixed(2) : null,
    paystack: {
      transactionId: input.transactionId,
      customerCode: input.paystackCustomerCode ?? input.customerCode,
      subscriptionCode: input.paystackSubscriptionCode ?? input.subscriptionCode,
      emailToken: input.emailToken,
      periodEnd: input.periodEnd,
    },
  });
}

export async function rememberPaystackSubscription(input: {
  subscriptionCode: string;
  emailToken?: string | null;
  customerCode?: string | null;
  payerEmail?: string | null;
  nextPaymentDate?: string | null;
}) {
  const service = createServiceClient();
  if (!service) return { ok: false as const, error: "Service unavailable" };

  const membership = await findPaystackMembership(service, {
    customerCode: input.customerCode,
    payerEmail: input.payerEmail,
    subscriptionCode: input.subscriptionCode,
  });
  if (!membership) return { ok: true as const, matched: false };

  const patch: Record<string, unknown> = {
    paystack_subscription_code: input.subscriptionCode,
    updated_at: new Date().toISOString(),
  };
  if (input.emailToken) patch.paystack_email_token = input.emailToken;
  if (input.customerCode) patch.paystack_customer_code = input.customerCode;
  if (input.nextPaymentDate && membership.status === "active") {
    patch.current_period_end = input.nextPaymentDate;
  }

  const { error } = await service.from("memberships").update(patch).eq("id", membership.id);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, matched: true };
}

async function fulfillMembershipRow(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
  membership: MembershipRecord,
  input: MembershipSettleInput,
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
    if (input.paystack?.transactionId) {
      patch.paystack_transaction_id = input.paystack.transactionId;
    }
    if (input.paystack?.customerCode) {
      patch.paystack_customer_code = input.paystack.customerCode;
    }
    if (input.paystack?.subscriptionCode) {
      patch.paystack_subscription_code = input.paystack.subscriptionCode;
    }
    if (input.paystack?.emailToken) patch.paystack_email_token = input.paystack.emailToken;
    if (input.paystack?.periodEnd) patch.current_period_end = input.paystack.periodEnd;

    const { error } = await service.from("memberships").update(patch).eq("id", membership.id);
    if (error) return { ok: false as const, error: error.message };

    if (bundled && bundled.status !== "paid") {
      const fulfillError = await fulfillBundledOrder(service, bundled.id, input.paymentId);
      if (fulfillError) return { ok: false as const, error: fulfillError.message };
    }

    const accessOk = await setPayFastAccess(
      membership.user_id,
      true,
      typeof patch.current_period_end === "string" ? patch.current_period_end : periodEndFrom(now),
    );
    if (!accessOk) return { ok: false as const, error: "Could not update member access" };

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
    const accessOk = await syncPayFastAccessFromMemberships(service, membership.user_id);
    if (!accessOk) return { ok: false as const, error: "Could not update member access" };
    return { ok: true as const, membershipId: membership.id, userId: membership.user_id };
  }

  if (input.paymentStatus === "FAILED" && membership.status === "pending") {
    await service
      .from("memberships")
      .update({ status: "failed", updated_at: now.toISOString() })
      .eq("id", membership.id);
    await failBundledOrder(service, membership.bundled_order_id);
    const accessOk = await syncPayFastAccessFromMemberships(service, membership.user_id);
    if (!accessOk) return { ok: false as const, error: "Could not update member access" };
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
