import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createMembershipCheckout } from "@/lib/memberships";
import { buildPayFastCheckout, getPayFastConfig } from "@/lib/payfast";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Log in to subscribe." }, { status: 401 });
  }

  if (user.plan === "paid") {
    return NextResponse.json({ redirect: "/account" });
  }

  const config = getPayFastConfig();
  if (!config) {
    return NextResponse.json(
      {
        error:
          "PayFast is not configured yet. Add PAYFAST_MERCHANT_ID & PAYFAST_MERCHANT_KEY.",
      },
      { status: 503 },
    );
  }
  if (!config.passphrase) {
    return NextResponse.json(
      {
        error:
          "PayFast recurring billing needs PAYFAST_PASSPHRASE set on the merchant & in env.",
      },
      { status: 503 },
    );
  }

  try {
    const origin = new URL(request.url).origin;
    const checkout = await createMembershipCheckout({
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      origin,
    });

    const payfast = buildPayFastCheckout({
      config,
      amountRands: checkout.amountRands,
      itemName: checkout.itemName,
      mPaymentId: checkout.mPaymentId,
      returnUrl: checkout.returnUrl,
      cancelUrl: checkout.cancelUrl,
      notifyUrl: checkout.notifyUrl,
      email: user.email,
      firstName: user.firstName,
      subscription: {
        frequency: 3,
        cycles: 0,
        recurringAmountRands: checkout.amountRands,
      },
    });

    return NextResponse.json({
      payfast,
      membershipId: checkout.membershipId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed." },
      { status: 400 },
    );
  }
}
