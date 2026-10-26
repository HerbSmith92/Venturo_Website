import { BecomeHostForm } from "@/components/profile/BecomeHostForm";
import { getCurrentUser } from "@/lib/auth";
import { canHost, hostSubscribeHref } from "@/lib/host-access";
import { defaultOrganiserProfile, isEventHost, loadOrganiserProfile } from "@/lib/host-profile";
import { loadMemberProfile, loadProfileCatalog } from "@/lib/profile";
import { PORTAL_EVENTS } from "@/lib/portal";
import { redirect } from "next/navigation";

export default async function BecomeHostPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/host");
  if (await isEventHost(user.id)) redirect(PORTAL_EVENTS);
  if (!canHost(user)) {
    return (
      <>
        <p className="eyebrow">Event Host</p>
        <h1>Become an Event Host</h1>
        <p className="lede">Hosting needs a paid membership. R 19.99 a month, on this same account.</p>
        <p>
          <a className="btn btn-primary" href={hostSubscribeHref("/account/host")}>
            Subscribe to host
          </a>
        </p>
      </>
    );
  }

  const [profile, catalog, savedHost] = await Promise.all([
    loadMemberProfile(user.id),
    loadProfileCatalog(),
    loadOrganiserProfile(user.id),
  ]);
  const firstName = profile.firstName.trim() || (user.firstName !== "there" ? user.firstName : "");
  const hostProfile = defaultOrganiserProfile(
    firstName,
    profile.lastName,
    user.email ?? "",
    savedHost,
  );

  return (
    <>
      <p className="eyebrow">Event Host</p>
      <h1>Become an Event Host</h1>
      <p className="lede muted">
        Confirm your details &amp; describe the events you want to host. Submit opens Event Host.
      </p>
      <BecomeHostForm
        firstName={firstName}
        lastName={profile.lastName}
        email={user.email ?? ""}
        phone={profile.phone}
        homePlaceId={profile.homePlaceId}
        places={catalog.places}
        hostProfile={hostProfile}
      />
    </>
  );
}
