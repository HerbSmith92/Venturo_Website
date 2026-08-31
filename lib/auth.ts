import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPaidMembership } from "@/lib/revenuecat";
import type { Plan } from "@/lib/revenuecat";
import { isStaff, roleFromClaims, type AppRole } from "@/lib/roles";

export type CurrentUser = {
  id: string;
  email: string | undefined;
  firstName: string;
  plan: Plan;
  role: AppRole | null;
};

export type StaffSession = {
  id: string;
  email: string | undefined;
  firstName: string;
  role: AppRole | null;
};

function claimsRecord(claims: unknown): Record<string, unknown> | null {
  if (!claims || typeof claims !== "object") return null;
  return claims as Record<string, unknown>;
}

function firstNameFromClaims(claims: Record<string, unknown>) {
  const metadata = (claims.user_metadata ?? {}) as { first_name?: string };
  if (metadata.first_name) return metadata.first_name;
  if (typeof claims.email === "string") return claims.email.split("@")[0];
  return "there";
}

export async function getStaffSession(): Promise<StaffSession | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data } = await supabase.auth.getClaims();
  const claims = claimsRecord(data?.claims);
  if (!claims || typeof claims.sub !== "string") return null;

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : undefined,
    firstName: firstNameFromClaims(claims),
    role: roleFromClaims(claims),
  };
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getStaffSession();
  if (!session) return null;

  const supabase = await createClient();
  let firstName = session.firstName;
  if (supabase) {
    const { data } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", session.id)
      .maybeSingle();
    if (data?.display_name) firstName = data.display_name;
  }

  const paid = await getPaidMembership(session.id);
  return {
    ...session,
    firstName,
    plan: paid ? "paid" : "free",
  };
}

export async function requireAdmin() {
  const session = await getStaffSession();
  if (!session) redirect("/admin/login");
  if (session.role !== "admin") redirect("/admin/denied");
  return { ...session, role: "admin" as const };
}

export async function requireStaff() {
  const session = await getStaffSession();
  if (!session) redirect("/admin/login");
  if (!isStaff(session.role)) redirect("/admin/denied");
  return session;
}
