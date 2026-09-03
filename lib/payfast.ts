import { createHash } from "crypto";

export type PayFastConfig = {
  merchantId: string;
  merchantKey: string;
  passphrase: string;
  sandbox: boolean;
};

export function getPayFastConfig(): PayFastConfig | null {
  const merchantId = process.env.PAYFAST_MERCHANT_ID;
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
  const passphrase = process.env.PAYFAST_PASSPHRASE ?? "";
  if (!merchantId || !merchantKey) return null;
  return {
    merchantId,
    merchantKey,
    passphrase,
    sandbox: (process.env.PAYFAST_ENV ?? "sandbox") !== "live",
  };
}

export function payFastProcessUrl(sandbox: boolean) {
  return sandbox
    ? "https://sandbox.payfast.co.za/eng/process"
    : "https://www.payfast.co.za/eng/process";
}

function encodePayFast(value: string) {
  return encodeURIComponent(value.trim()).replace(/%20/g, "+");
}

/** Build signature over param keys in submission order (PayFast requirement). */
export function payFastSignature(
  params: Record<string, string>,
  passphrase: string,
) {
  const pairs = Object.entries(params)
    .filter(([key, value]) => key !== "signature" && value !== "")
    .map(([key, value]) => `${key}=${encodePayFast(value)}`);

  let paramString = pairs.join("&");
  if (passphrase) {
    paramString += `&passphrase=${encodePayFast(passphrase)}`;
  }
  return createHash("md5").update(paramString).digest("hex");
}

export function verifyPayFastSignature(
  data: Record<string, string>,
  passphrase: string,
) {
  const received = data.signature;
  if (!received) return false;
  const { signature: _ignored, ...rest } = data;
  const expected = payFastSignature(rest, passphrase);
  return expected.toLowerCase() === received.toLowerCase();
}

export function buildPayFastCheckout(input: {
  config: PayFastConfig;
  amountRands: string;
  itemName: string;
  mPaymentId: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
  email?: string;
  firstName?: string;
  /** Monthly recurring membership (PayFast Subscriptions). */
  subscription?: {
    frequency?: 1 | 2 | 3 | 4 | 5 | 6;
    cycles?: number;
    recurringAmountRands?: string;
  };
}) {
  const params: Record<string, string> = {
    merchant_id: input.config.merchantId,
    merchant_key: input.config.merchantKey,
    return_url: input.returnUrl,
    cancel_url: input.cancelUrl,
    notify_url: input.notifyUrl,
    m_payment_id: input.mPaymentId,
    amount: input.amountRands,
    item_name: input.itemName.slice(0, 100),
  };
  if (input.email) params.email_address = input.email;
  if (input.firstName) params.name_first = input.firstName;

  if (input.subscription) {
    // 1 = subscription, frequency 3 = monthly, cycles 0 = ongoing.
    params.subscription_type = "1";
    params.frequency = String(input.subscription.frequency ?? 3);
    params.cycles = String(input.subscription.cycles ?? 0);
    params.recurring_amount =
      input.subscription.recurringAmountRands ?? input.amountRands;
    params.subscription_notify_webhook = "true";
  }

  const signature = payFastSignature(params, input.config.passphrase);
  return {
    action: payFastProcessUrl(input.config.sandbox),
    fields: { ...params, signature },
  };
}

export function centsToPayFastAmount(cents: number) {
  return (cents / 100).toFixed(2);
}

export type PayFastStatus = {
  configured: boolean;
  mode: "sandbox" | "live" | "missing";
  merchantIdMasked: string | null;
  processUrl: string | null;
  itnPath: string;
};

export function getPayFastStatus(): PayFastStatus {
  const config = getPayFastConfig();
  if (!config) {
    return {
      configured: false,
      mode: "missing",
      merchantIdMasked: null,
      processUrl: null,
      itnPath: "/api/payfast/itn",
    };
  }
  const id = config.merchantId;
  const masked =
    id.length <= 4 ? "****" : `${id.slice(0, 2)}····${id.slice(-2)}`;
  return {
    configured: true,
    mode: config.sandbox ? "sandbox" : "live",
    merchantIdMasked: masked,
    processUrl: payFastProcessUrl(config.sandbox),
    itnPath: "/api/payfast/itn",
  };
}
