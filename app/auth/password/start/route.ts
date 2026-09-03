import { NextResponse } from "next/server";

/**
 * Legacy password → OTP start. Member auth is email OTP only now.
 * Clients should POST to `/auth/otp/send` instead.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Password sign-in is retired. Use your email for a one-time code instead.",
    },
    { status: 410 },
  );
}
