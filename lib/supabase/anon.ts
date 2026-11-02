import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/env";

/** Cookie-free client for cached public reads. */
export function createAnonClient() {
  if (!isSupabaseConfigured()) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
