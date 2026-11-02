import { AuthorJoinAuth } from "@/components/AuthorJoinAuth";
import { AuthorJoinClaim } from "@/components/AuthorJoinClaim";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { isStaff } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

type InvitePeek = {
  expires_at: string;
  claimed: boolean;
  expired: boolean;
  email: string | null;
};

export default async function AuthorJoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  if (!supabase || !token) notFound();
  const { data } = await supabase.rpc("get_guide_author_invite", { p_token: token });
  const invite = data as InvitePeek | null;
  if (!invite?.expires_at) notFound();

  const user = await getCurrentUser();
  const staffSession = user && isStaff(user.role);
  const next = `/authors/join/${token}`;
  const closed = invite.expired || invite.claimed;

  return (
    <main className="shell section">
      <p className="eyebrow">Guides</p>
      <h1>Write with Venturo</h1>
      <p className="lede muted">
        Pick a username, we email you a one-time code, then you fill in your own Author card &amp;
        start your Guides. Venturo still publishes them.
      </p>
      {error ? <p className="error">{error}</p> : null}
      {invite.expired ? (
        <p className="notice">That invite has expired. Ask Venturo for a new link.</p>
      ) : null}
      {invite.claimed && !user ? (
        <p className="notice">
          That invite has already been used. <a href="/login?next=/admin/guides">Log in</a> if this
          is your account.
        </p>
      ) : null}
      {staffSession && !invite.expired ? (
        <p className="notice">
          You&apos;re signed in as staff. Log out, then open this link as the writer — they pick a
          username &amp; get a one-time code.
        </p>
      ) : null}
      {!closed && !user ? (
        <AuthorJoinAuth
          configured={isSupabaseConfigured()}
          next={next}
          suggestedEmail={invite.email ?? ""}
        />
      ) : null}
      {user && !staffSession && !invite.expired ? <AuthorJoinClaim token={token} /> : null}
    </main>
  );
}
