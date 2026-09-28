import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return json(null, 200);
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return json({ error: "Not signed in" }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !anon || !service) {
    return json({ error: "Account deletion is not configured." }, 500);
  }

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) {
    return json({ error: "Not signed in" }, 401);
  }

  const admin = createClient(url, service);
  const uid = user.id;

  const { count: hosted, error: hostedError } = await admin
    .from("events")
    .select("id", { count: "exact", head: true })
    .or(`organiser_id.eq.${uid},created_by.eq.${uid}`);
  if (hostedError) {
    return json({ error: hostedError.message }, 500);
  }
  if ((hosted ?? 0) > 0) {
    return json(
      {
        error:
          "This account still hosts events. Write to support@venturo.co.za so we can close it.",
      },
      409,
    );
  }

  const { count: guides, error: guidesError } = await admin
    .from("curated_guides")
    .select("id", { count: "exact", head: true })
    .or(`created_by.eq.${uid},updated_by.eq.${uid}`);
  if (guidesError) {
    return json({ error: guidesError.message }, 500);
  }
  if ((guides ?? 0) > 0) {
    return json(
      {
        error:
          "This account is tied to editorial guides. Write to support@venturo.co.za so we can close it.",
      },
      409,
    );
  }

  const steps: Array<{ ok: boolean; error: string | null }> = [];
  const run = async (label: string, work: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await work;
    if (error) steps.push({ ok: false, error: `${label}: ${error.message}` });
  };

  await run(
    "orders",
    admin.from("event_orders").update({ buyer_id: null }).eq("buyer_id", uid),
  );
  await run(
    "tickets",
    admin.from("event_tickets").update({ buyer_id: null }).eq("buyer_id", uid),
  );
  await run(
    "published",
    admin.from("events").update({ published_by: null }).eq("published_by", uid),
  );
  await run("invites", admin.from("event_invites").delete().eq("created_by", uid));
  await run(
    "scans",
    admin.from("event_ticket_scan_events").delete().eq("actor_id", uid),
  );
  await run("personas", admin.from("profile_personas").delete().eq("profile_id", uid));
  await run("interests", admin.from("profile_interests").delete().eq("profile_id", uid));
  await run(
    "bucket",
    admin.from("profile_bucket_items").delete().eq("profile_id", uid),
  );
  await run("access", admin.from("member_access").delete().eq("user_id", uid));
  await run("memberships", admin.from("memberships").delete().eq("user_id", uid));
  await run(
    "organiser",
    admin.from("organiser_profiles").delete().eq("user_id", uid),
  );
  await run(
    "payouts",
    admin.from("organiser_payout_profiles").delete().eq("user_id", uid),
  );
  const reviews = await admin.from("listing_reviews").delete().eq("user_id", uid);
  if (reviews.error) {
    const missing =
      reviews.error.code === "42P01" ||
      reviews.error.code === "PGRST205" ||
      reviews.error.message.includes("listing_reviews");
    if (!missing) {
      return json({ error: `reviews: ${reviews.error.message}` }, 500);
    }
  }
  await run("profile", admin.from("profiles").delete().eq("id", uid));

  const failed = steps.find((step) => !step.ok);
  if (failed?.error) {
    return json({ error: failed.error }, 500);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(uid);
  if (deleteError) {
    return json({ error: deleteError.message }, 500);
  }

  return json({ ok: true });
});

function json(body: unknown, status = 200) {
  return new Response(body == null ? "ok" : JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
