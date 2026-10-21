import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function RegisterCommunityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/community");

  return (
    <>
      <p className="eyebrow">Community</p>
      <h1>Register a Community</h1>
      <p className="lede muted">
        A home for the group, then the events it hosts. If it is already on
        Venturo, claim it. That opens it under Communities in this menu.
      </p>
      <p>
        <a className="btn btn-primary" href="/communities">
          Find a Community
        </a>
      </p>
    </>
  );
}
