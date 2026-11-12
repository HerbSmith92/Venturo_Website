import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type EventHostContact = {
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function phoneOf(profilePhone: unknown, telephone: unknown, mobile: unknown) {
  return asText(telephone) || asText(mobile) || asText(profilePhone) || null;
}

function nameOf(hostName: unknown, first: unknown, last: unknown, email: string | null) {
  const host = asText(hostName);
  if (host) return host;
  const person = [asText(first), asText(last)].filter(Boolean).join(" ").trim();
  if (person) return person;
  if (email) return email;
  return "Unnamed host";
}

async function emailsFor(ids: string[]) {
  const service = createServiceClient();
  const emails = new Map<string, string>();
  if (!service || ids.length === 0) return emails;
  await Promise.all(
    ids.map(async (id) => {
      const { data } = await service.auth.admin.getUserById(id);
      const email = data.user?.email?.trim();
      if (email) emails.set(id, email);
    }),
  );
  return emails;
}

async function userIdsMatchingAuthFilter(query: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !key || query.length < 3) return [] as string[];
  const response = await fetch(
    `${url}/auth/v1/admin/users?page=1&per_page=20&filter=${encodeURIComponent(query)}`,
    { headers: { Authorization: `Bearer ${key}`, apikey: key } },
  );
  if (!response.ok) return [];
  const payload = (await response.json()) as { users?: { id?: string }[] };
  return (payload.users ?? []).map((user) => user.id).filter((id): id is string => Boolean(id));
}

export async function loadEventHosts(
  userIds: string[],
  options?: { withAuthEmail?: boolean },
): Promise<Map<string, EventHostContact>> {
  const hosts = new Map<string, EventHostContact>();
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return hosts;

  const supabase = await createClient();
  if (!supabase) return hosts;

  const [profiles, organisers, emails] = await Promise.all([
    supabase.from("profiles").select("id, display_name, last_name, phone").in("id", ids),
    supabase
      .from("organiser_profiles")
      .select("user_id, host_name, contact_email, telephone, mobile")
      .in("user_id", ids),
    options?.withAuthEmail === false ? Promise.resolve(new Map<string, string>()) : emailsFor(ids),
  ]);

  const profileById = new Map((profiles.data ?? []).map((row) => [row.id as string, row]));
  const organiserById = new Map((organisers.data ?? []).map((row) => [row.user_id as string, row]));

  for (const id of ids) {
    const profile = profileById.get(id);
    const organiser = organiserById.get(id);
    const email = emails.get(id) ?? (asText(organiser?.contact_email) || null);
    hosts.set(id, {
      userId: id,
      name: nameOf(organiser?.host_name, profile?.display_name, profile?.last_name, email),
      email,
      phone: phoneOf(profile?.phone, organiser?.telephone, organiser?.mobile),
    });
  }

  return hosts;
}

export async function loadEventHost(userId: string): Promise<EventHostContact | null> {
  if (!userId) return null;
  const hosts = await loadEventHosts([userId]);
  return hosts.get(userId) ?? null;
}

function like(query: string) {
  return `%${query.replace(/[%_,()"]/g, "")}%`;
}

export async function searchEventHosts(query: string): Promise<EventHostContact[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  const q = query.trim();
  const ids = new Set<string>();

  if (UUID.test(q)) ids.add(q);

  if (q.length >= 3) {
    for (const id of await userIdsMatchingAuthFilter(q)) ids.add(id);
  }

  if (q.length >= 2) {
    const pattern = like(q);
    const [byName, byHost] = await Promise.all([
      supabase
        .from("profiles")
        .select("id")
        .or(`display_name.ilike.${pattern},last_name.ilike.${pattern},phone.ilike.${pattern}`)
        .limit(20),
      supabase
        .from("organiser_profiles")
        .select("user_id")
        .or(
          `host_name.ilike.${pattern},contact_email.ilike.${pattern},telephone.ilike.${pattern},mobile.ilike.${pattern}`,
        )
        .limit(20),
    ]);
    for (const row of byName.data ?? []) ids.add(row.id as string);
    for (const row of byHost.data ?? []) ids.add(row.user_id as string);
  } else if (!q) {
    const { data } = await supabase
      .from("organiser_profiles")
      .select("user_id")
      .order("updated_at", { ascending: false })
      .limit(20);
    for (const row of data ?? []) ids.add(row.user_id as string);
    if (ids.size < 12) {
      const { data: events } = await supabase
        .from("events")
        .select("organiser_id")
        .order("updated_at", { ascending: false })
        .limit(40);
      for (const row of events ?? []) {
        ids.add(row.organiser_id as string);
        if (ids.size >= 20) break;
      }
    }
  }

  const hosts = await loadEventHosts([...ids].slice(0, 24));
  return [...hosts.values()].sort((a, b) => a.name.localeCompare(b.name, "en-ZA"));
}

export async function assignEventHost(eventId: string, userId: string, actorId: string) {
  if (!UUID.test(eventId) || !UUID.test(userId)) {
    throw new Error("Pick a member on Venturo.");
  }

  const supabase = await createClient();
  const service = createServiceClient();
  if (!supabase) throw new Error("Supabase is not connected.");

  const { data: event, error: loadError } = await supabase
    .from("events")
    .select("id, organiser_id, title")
    .eq("id", eventId)
    .maybeSingle();
  if (loadError || !event) throw new Error("Event not found.");
  if (event.organiser_id === userId) return;

  const { data: profile } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (!profile) {
    const emails = await emailsFor([userId]);
    if (!emails.has(userId)) throw new Error("That member is not on Venturo.");
  }

  const { error } = await supabase
    .from("events")
    .update({ organiser_id: userId, updated_at: new Date().toISOString() })
    .eq("id", eventId);
  if (error) throw new Error(error.message);

  const writer = service ?? supabase;
  await writer.from("event_audit_events").insert({
    event_id: eventId,
    actor_id: actorId,
    action: "assign_organiser",
    before: { organiser_id: event.organiser_id },
    after: { organiser_id: userId },
  });
}
