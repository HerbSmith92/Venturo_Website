import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createTicketOrder } from "@/lib/orders";
import {
  buildPayFastCheckout,
  centsToPayFastAmount,
  getPayFastConfig,
} from "@/lib/payfast";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Log in to buy tickets." }, { status: 401 });
  }

  const body = (await request.json()) as {
    eventSlug?: string;
    lines?: { ticketTypeId: string; quantity: number }[];
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
    });

    if (order.free) {
      return NextResponse.json({ redirect: order.redirect });
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

    const payfast = buildPayFastCheckout({
      config,
      amountRands: centsToPayFastAmount(order.totalCents),
      itemName: order.eventTitle,
      mPaymentId: order.mPaymentId,
      returnUrl: order.returnUrl,
      cancelUrl: order.cancelUrl,
      notifyUrl: order.notifyUrl,
      email: user.email,
      firstName: user.firstName,
    });

    return NextResponse.json({ payfast });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed." },
      { status: 400 },
    );
  }
}
