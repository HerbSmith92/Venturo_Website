import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createTicketOrder } from "@/lib/orders";
import {
  PAYSTACK_MINIMUM_CENTS,
  getPaystackConfig,
  initializePaystackTransaction,
} from "@/lib/paystack";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Log in to buy tickets." }, { status: 401 });
  }

  const body = (await request.json()) as {
    eventSlug?: string;
    lines?: { ticketTypeId: string; quantity: number }[];
    promoCode?: string;
    inviteToken?: string;
  };

  if (!body.eventSlug || !body.lines?.length) {
    return NextResponse.json({ error: "Choose tickets first." }, { status: 400 });
  }

  try {
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
    });

    if (order.free) {
      return NextResponse.json({ redirect: order.redirect });
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

    return NextResponse.json({ authorizationUrl: checkout.authorizationUrl });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed." },
      { status: 400 },
    );
  }
}
