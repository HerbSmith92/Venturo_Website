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
      <button className="btn btn-primary" type="submit">
        {following ? "Unfollow" : "Follow"}
      </button>
    </form>
  );
}
