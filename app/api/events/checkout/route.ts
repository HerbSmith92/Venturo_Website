import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createTicketOrder } from "@/lib/orders";
import {
  PAYSTACK_MINIMUM_CENTS,
  getPaystackConfig,
  initializePaystackTransaction,
} from "@/lib/paystack";
import { bearerToken, userFromBearer } from "@/lib/supabase/bearer";
import { bodyHasConsent, CONSENT_REQUIRED, hasMemberConsent, recordMemberConsent } from "@/lib/policy-consent";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const token = bearerToken(request);
  let bearerUser: Awaited<ReturnType<typeof userFromBearer>> = null;
  if (token) {
    try {
      bearerUser = await userFromBearer(token);
    } catch {
      bearerUser = null;
    }
    if (!bearerUser) {
      return NextResponse.json({ error: "Log in to buy tickets." }, { status: 401 });
    }
  }
  const user = bearerUser ?? (await getCurrentUser());
  if (!user) {
    return NextResponse.json({ error: "Log in to buy tickets." }, { status: 401 });
  }
  const orderClient: SupabaseClient | undefined = bearerUser?.supabase;

  const body = (await request.json()) as {
    eventSlug?: string;
    lines?: { ticketTypeId: string; quantity: number }[];
    promoCode?: string;
    inviteToken?: string;
    source?: string;
    platform?: string;
    occurrenceStartsAt?: string;
    acceptTerms?: boolean;
    acceptPrivacy?: boolean;
  };

  if (!body.eventSlug || !body.lines?.length) {
    return NextResponse.json({ error: "Choose tickets first." }, { status: 400 });
  }

  try {
    const consented = await hasMemberConsent(user.id);
    if (!consented && !bodyHasConsent(body)) {
      return NextResponse.json({ error: CONSENT_REQUIRED }, { status: 400 });
    }
    if (!consented) await recordMemberConsent(user.id, "checkout");

    const origin = new URL(request.url).origin;
    const order = await createTicketOrder({
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      eventSlug: body.eventSlug,
      lines: body.lines,
      paidMember: user.plan === "paid",
      origin,
      promoCode: body.promoCode,
      inviteToken: body.inviteToken,
      occurrenceStartsAt: body.occurrenceStartsAt,
      appCheckout: body.source === "app",
      activityPlatform:
        body.platform === "ios" || body.platform === "android" || body.platform === "web"
          ? body.platform
          : body.source === "app"
            ? "unknown"
            : "web",
    }, orderClient);

    if (order.free) {
      return NextResponse.json({
        redirect: order.redirect,
        orderId: order.orderId,
        totalCents: order.totalCents,
        free: true,
      });
    }

    if (order.joinAndBuy) {
      return NextResponse.json(
        { error: "Subscribe on the website to buy a member ticket." },
        { status: 403 },
      );
    }

    if (order.totalCents < PAYSTACK_MINIMUM_CENTS) {
      return NextResponse.json(
        { error: "Paystack needs at least R 1.00 for a card payment." },
        { status: 400 },
      );
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
        { error: "Add an email to your account before paying." },
        { status: 400 },
      );
    }

    const checkout = await initializePaystackTransaction({
      secretKey: config.secretKey,
      email: user.email,
      amountCents: order.totalCents,
      reference: order.mPaymentId,
      callbackUrl: order.returnUrl,
      metadata: { kind: "ticket", order_id: order.orderId },
    });

    return NextResponse.json({
      authorizationUrl: checkout.authorizationUrl,
      orderId: order.orderId,
      totalCents: order.totalCents,
      free: false,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed." },
      { status: 400 },
    );
  }
}
