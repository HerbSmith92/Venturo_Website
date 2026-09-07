import { NextResponse } from "next/server";
import { provisionMember, safeNextPath } from "@/lib/member-auth";
import { postAuthPathAfterProvision } from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const safeNext = safeNextPath(url.searchParams.get("next"));
  const authError = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  const failPath = safeNext.startsWith("/signup") ? "/signup" : "/login";
  const failTarget = new URL(failPath, url.origin);
  failTarget.searchParams.set("next", safeNext);

  if (authError) {
    failTarget.searchParams.set("error", authError);
    return NextResponse.redirect(failTarget);
  }

  async function succeed() {
    const dest = await postAuthPathAfterProvision(safeNext);
    return NextResponse.redirect(new URL(dest, url.origin));
  }

  const supabase = await createClient();
  if (supabase && code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      failTarget.searchParams.set("error", error.message);
      return NextResponse.redirect(failTarget);
    }
    const userId = data.user?.id ?? data.session?.user?.id;
    if (userId) {
      await provisionMember(userId);
    }
    return succeed();
  }

  if (supabase && tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "email" | "signup" | "invite" | "magiclink" | "recovery" | "email_change",
    });
    if (error) {
      failTarget.searchParams.set("error", error.message);
      return NextResponse.redirect(failTarget);
    }
    const userId = data.user?.id ?? data.session?.user?.id;
    if (userId) {
      await provisionMember(userId);
    }
    return succeed();
  }

  return NextResponse.redirect(new URL(safeNext, url.origin));
}
