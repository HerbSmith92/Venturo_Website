import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const PAYSTACK_API = "https://api.paystack.co";

/** Paystack's recommended minimum first charge in South Africa. */
export const PAYSTACK_MINIMUM_CENTS = 100;

export const PAYSTACK_WEBHOOK_PATH = "/api/paystack/webhook";

const MEMBERSHIP_PLAN_NAME = "Venturo Membership";

export type PaystackMode = "test" | "live" | "unknown";

export type PaystackConfig = {
  secretKey: string;
  mode: PaystackMode;
};

export type PaystackCheckout = {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
};

export type PaystackTransaction = {
  id: number;
  status: string;
  reference: string;
  amount: number;
  currency: string;
  customerCode: string | null;
  customerEmail: string | null;
  planCode: string | null;
  metadata: Record<string, unknown> | null;
};

type PaystackEnvelope<T> = {
  status?: boolean;
  message?: string;
  data?: T;
};

export function newPaystackReference(kind: "evt" | "mem") {
  return `${kind}-${randomBytes(12).toString("hex")}`;
}

export function getPaystackConfig(): PaystackConfig | null {
  const secretKey = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!secretKey) return null;
  return { secretKey, mode: paystackMode(secretKey) };
}

export function paystackMode(secretKey: string): PaystackMode {
  if (secretKey.startsWith("sk_live_")) return "live";
  if (secretKey.startsWith("sk_test_")) return "test";
  return "unknown";
}

export function maskPaystackKey(secretKey: string) {
  const mode = paystackMode(secretKey);
  const prefix = mode === "live" ? "sk_live_" : mode === "test" ? "sk_test_" : "sk_";
  return `${prefix}····${secretKey.slice(-4)}`;
}

export type PaystackStatus = {
  configured: boolean;
  mode: PaystackMode | "missing";
  secretMasked: string | null;
  planCode: string | null;
  webhookPath: string;
};

export function getPaystackStatus(): PaystackStatus {
  const config = getPaystackConfig();
  if (!config) {
    return {
      configured: false,
      mode: "missing",
      secretMasked: null,
      planCode: process.env.PAYSTACK_PLAN_CODE?.trim() || null,
      webhookPath: PAYSTACK_WEBHOOK_PATH,
    };
  }
  return {
    configured: true,
    mode: config.mode,
    secretMasked: maskPaystackKey(config.secretKey),
    planCode: process.env.PAYSTACK_PLAN_CODE?.trim() || null,
    webhookPath: PAYSTACK_WEBHOOK_PATH,
  };
}

export function verifyPaystackSignature(
  rawBody: string,
  signature: string | null,
  secretKey: string,
) {
  if (!signature) return false;
  const hash = createHmac("sha512", secretKey).update(rawBody).digest("hex");
  const expected = Buffer.from(hash);
  const received = Buffer.from(signature);
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

async function paystackRequest<T>(
  secretKey: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${PAYSTACK_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  let payload: PaystackEnvelope<T> = {};
  try {
    payload = (await response.json()) as PaystackEnvelope<T>;
  } catch {
    payload = {};
  }

  if (!response.ok || payload.status === false || payload.data === undefined) {
    throw new Error(payload.message || "Paystack could not complete that request.");
  }
  return payload.data;
}

export async function initializePaystackTransaction(input: {
  secretKey: string;
  email: string;
  amountCents: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, string>;
  /** Monthly membership. Paystack charges the plan amount, not amountCents. */
  planCode?: string;
}): Promise<PaystackCheckout> {
  const body: Record<string, unknown> = {
    email: input.email,
    amount: input.amountCents,
    currency: "ZAR",
    reference: input.reference,
    callback_url: input.callbackUrl,
    metadata: input.metadata,
  };
  if (input.planCode) body.plan = input.planCode;

  const data = await paystackRequest<{
    authorization_url?: string;
    access_code?: string;
    reference?: string;
  }>(input.secretKey, "/transaction/initialize", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!data.authorization_url || !data.reference) {
    throw new Error("Paystack did not return a checkout link.");
  }
  if (data.reference !== input.reference) {
    throw new Error("Paystack returned an unexpected payment reference.");
  }

  return {
    authorizationUrl: data.authorization_url,
    accessCode: data.access_code ?? "",
    reference: data.reference,
  };
}

export async function verifyPaystackTransaction(
  secretKey: string,
  reference: string,
): Promise<PaystackTransaction | null> {
  const encoded = encodeURIComponent(reference);
  const data = await paystackRequest<{
    id?: number;
    status?: string;
    reference?: string;
    amount?: number;
    currency?: string;
    customer?: { customer_code?: string; email?: string };
    plan?: { plan_code?: string } | null;
    metadata?: Record<string, unknown> | null;
  }>(secretKey, `/transaction/verify/${encoded}`);

  if (!data.reference || typeof data.amount !== "number" || !data.status) return null;
  return {
    id: data.id ?? 0,
    status: data.status,
    reference: data.reference,
    amount: data.amount,
    currency: data.currency ?? "",
    customerCode: data.customer?.customer_code ?? null,
    customerEmail: data.customer?.email?.trim().toLowerCase() ?? null,
    planCode: data.plan?.plan_code ?? null,
    metadata: data.metadata ?? null,
  };
}

type PaystackPlan = {
  name?: string;
  plan_code?: string;
  amount?: number;
  interval?: string;
  currency?: string;
};

/** Use PAYSTACK_PLAN_CODE when set. Otherwise reuse or create the monthly plan. */
export async function resolveMembershipPlanCode(secretKey: string, amountCents: number) {
  const fromEnv = process.env.PAYSTACK_PLAN_CODE?.trim();
  if (fromEnv) return fromEnv;

  const listed = await paystackRequest<PaystackPlan[]>(secretKey, "/plan?perPage=50");
  const plans = Array.isArray(listed) ? listed : [];
  const existing = plans.find(
    (plan) =>
      plan.name === MEMBERSHIP_PLAN_NAME &&
      plan.amount === amountCents &&
      plan.interval === "monthly" &&
      (!plan.currency || plan.currency === "ZAR") &&
      plan.plan_code,
  );
  if (existing?.plan_code) return existing.plan_code;

  const created = await paystackRequest<PaystackPlan>(secretKey, "/plan", {
    method: "POST",
    body: JSON.stringify({
      name: MEMBERSHIP_PLAN_NAME,
      interval: "monthly",
      amount: amountCents,
      currency: "ZAR",
    }),
  });
  if (!created.plan_code) throw new Error("Paystack did not return a membership plan.");
  return created.plan_code;
}
