import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  ANALYTICS_SESSION_COOKIE,
  ANALYTICS_VISITOR_COOKIE,
} from "@/lib/website-analytics";
import { platformFeatures } from "@/lib/platform-features";

export async function recordWebsiteConversion(input: {
  name: "rsvp" | "purchase";
  path: string;
  userId: string;
  orderId: string;
  valueCents?: number;
}) {
  if (!platformFeatures.enhancedAnalytics) return;
  const jar = await cookies();
  const sessionId = jar.get(ANALYTICS_SESSION_COOKIE)?.value;
  const visitorKey = jar.get(ANALYTICS_VISITOR_COOKIE)?.value;
  const admin = createServiceClient();
  if (!admin || !sessionId || !visitorKey) return;

  const { data: session } = await admin
    .from("analytics_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("visitor_key", visitorKey)
    .maybeSingle();
  if (!session) return;

  const { count } = await admin
    .from("analytics_events")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("name", input.name)
    .eq("properties->>order_id", input.orderId);
  if (count) return;

  await admin.from("analytics_events").insert({
    session_id: sessionId,
    visitor_key: visitorKey,
    user_id: input.userId,
    name: input.name,
    path: input.path,
    properties: {
      order_id: input.orderId,
      value_cents: input.valueCents ?? 0,
    },
  });
}
