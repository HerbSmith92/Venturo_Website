import { toggleFollow } from "@/app/member-actions";

export function FollowForm({
  communityId,
  following,
  next,
}: {
  communityId: string;
  following: boolean;
  next: string;
}) {
  return (
    <form action={toggleFollow}>
      <input type="hidden" name="community_id" value={communityId} />
      <input type="hidden" name="next" value={next} />
      {!following ? (
        <label className="muted" style={{ display: "block", marginBottom: 10, maxWidth: 420 }}>
          <input type="checkbox" name="host_visible" style={{ marginRight: 8 }} />
          Let this community’s managers see my display name, profile photo &amp; follow date.
          Contact details &amp; location stay private. You can change this later.
        </label>
      ) : null}
      <button className="btn btn-primary" type="submit">
        {following ? "Unfollow" : "Follow"}
      </button>
    </form>
  );
}
