import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { PAID_AMOUNT_CENTS } from "@/lib/brand";
import { createMembershipCheckout } from "@/lib/memberships";
import {
  getPaystackConfig,
  initializePaystackTransaction,
  resolveMembershipPlanCode,
} from "@/lib/paystack";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Log in to subscribe." }, { status: 401 });
  }

  if (user.plan === "paid") {
    return NextResponse.json({ redirect: "/account" });
  }

  const config = getPaystackConfig();
  if (!config) {
    return NextResponse.json(
      { error: "Paystack is not configured yet. Add PAYSTACK_SECRET_KEY." },
      { status: 503 },
    );
  }
  if (!user.email) {
    return NextResponse.json(
      { error: "Add an email to your account before subscribing." },
      { status: 400 },
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

    const planCode = await resolveMembershipPlanCode(config.secretKey, PAID_AMOUNT_CENTS);
    const session = await initializePaystackTransaction({
      secretKey: config.secretKey,
      email: user.email,
      amountCents: checkout.amountCents,
      reference: checkout.mPaymentId,
      callbackUrl: checkout.returnUrl,
      metadata: { kind: "membership", membership_id: checkout.membershipId },
      planCode,
    });

    return NextResponse.json({
      authorizationUrl: session.authorizationUrl,
      membershipId: checkout.membershipId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed." },
      { status: 400 },
    );
  }
}
