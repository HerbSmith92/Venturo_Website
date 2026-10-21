import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Supabase access token sent by the iOS app. */
export function bearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  return token || null;
}

export function createBearerClient(accessToken: string): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  return createClient(url, key, {
    accessToken: async () => accessToken,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export type BearerUser = {
  id: string;
  email: string | undefined;
  firstName: string;
  plan: "paid" | "free";
  supabase: SupabaseClient;
};

export async function userFromBearer(accessToken: string): Promise<BearerUser | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  // A client created with `accessToken` cannot use `auth`. Calling `auth.getUser`
  // there throws, and the checkout route was answering the app with an empty 500.
  const authClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  let userId: string;
  let email: string | undefined;
  let metadata: { first_name?: string } | undefined;
  try {
    const { data, error } = await authClient.auth.getUser(accessToken);
    if (error || !data.user) return null;
    userId = data.user.id;
    email = data.user.email;
    metadata = data.user.user_metadata as { first_name?: string } | undefined;
  } catch {
    return null;
  }

  const supabase = createBearerClient(accessToken);
  if (!supabase) return null;

  const [{ data: profile }, { data: access }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    supabase.from("member_access").select("subscribed").eq("user_id", userId).maybeSingle(),
  ]);

  const firstName =
    (typeof profile?.display_name === "string" && profile.display_name.trim()) ||
    metadata?.first_name ||
    email?.split("@")[0] ||
    "there";

  return {
    id: userId,
    email,
    firstName,
    plan: access?.subscribed ? "paid" : "free",
    supabase,
  };
}
