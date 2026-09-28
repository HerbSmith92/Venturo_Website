import { submitClaim } from "@/app/member-actions";

export function ClaimRequestButton({
  listingId,
  listingName,
  listingSlug,
  signedIn,
}: {
  listingId: string;
  listingName: string;
  listingSlug: string;
  signedIn: boolean;
}) {
  if (!signedIn) {
    return (
      <a className="btn btn-primary" href={`/login?next=/directory/claim?q=${encodeURIComponent(listingName)}`}>
        Log In To Claim
      </a>
    );
  }

  return (
    <form action={submitClaim} className="field">
      <input type="hidden" name="listing_id" value={listingId} />
      <input type="hidden" name="listing_name" value={listingName} />
      <input type="hidden" name="listing_slug" value={listingSlug} />
      <span>How can we verify this is yours?</span>
      <textarea name="evidence" required rows={3} placeholder="Your role, website, or a number we can call." />
      <button className="btn btn-primary" type="submit">
        Request Claim
      </button>
    </form>
  );
}
