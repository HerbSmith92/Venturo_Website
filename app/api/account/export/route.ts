import { getCurrentUser } from "@/lib/auth";
import { listFollowedCommunityIds } from "@/lib/communities";
import { listBuyerTickets } from "@/lib/orders";
import { loadMemberProfile } from "@/lib/profile";
import { listSaves } from "@/lib/saves";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }

  const [profile, saves, tickets, communities] = await Promise.all([
    loadMemberProfile(user.id),
    listSaves(user.id),
    listBuyerTickets(user.id),
    listFollowedCommunityIds(user.id),
  ]);

  const body = {
    email: user.email,
    plan: user.plan,
    profile,
    saves,
    communities,
    tickets: tickets.map((ticket) => ({
      id: ticket.id,
      code: ticket.code,
    })),
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": "attachment; filename=\"venturo-account.json\"",
    },
  });
}
