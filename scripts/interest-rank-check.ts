import assert from "node:assert/strict";
import test from "node:test";
import { rankInterests, shortInterests, sortInterests } from "../lib/interest-rank.ts";
import { placeMentioned } from "../lib/place-match.ts";

test("a listing city names the home area as a whole word", () => {
  assert.equal(placeMentioned("Fourways, Johannesburg", "Sandton", "Johannesburg"), true);
  assert.equal(placeMentioned("Fourways, Johannesburg", "Sandton", "Sandton"), true);
  assert.equal(placeMentioned("Randburg", null, "Midrand"), false);
  assert.equal(placeMentioned("2194", null, "Johannesburg"), false);
});

test("a popular interest with fewer listings is behind", () => {
  const ranked = rankInterests([
    { id: "hike", title: "Hiking", members: 20, listings: 2 },
    { id: "food", title: "Food", members: 5, listings: 20 },
    { id: "clay", title: "Pottery", members: 0, listings: 0 },
  ]);
  const hike = ranked.find((row) => row.id === "hike");
  const food = ranked.find((row) => row.id === "food");
  assert.equal(hike?.memberRank, 1);
  assert.equal(hike?.listingRank, 2);
  assert.equal(hike?.behind, 1);
  assert.equal(food?.behind, -1);
  assert.deepEqual(shortInterests(ranked).map((row) => row.id), ["hike"]);
});

test("tied member counts share a rank", () => {
  const ranked = rankInterests([
    { id: "a", title: "A", members: 10, listings: 1 },
    { id: "b", title: "B", members: 10, listings: 4 },
  ]);
  assert.equal(ranked.every((row) => row.memberRank === 1), true);
  assert.equal(ranked.find((row) => row.id === "a")?.listingRank, 2);
});

test("column sort reverses members", () => {
  const ranked = rankInterests([
    { id: "a", title: "Adventure", members: 2, listings: 1 },
    { id: "b", title: "Family", members: 9, listings: 1 },
  ]);
  assert.equal(sortInterests(ranked, "members", "desc")[0]?.id, "b");
  assert.equal(sortInterests(ranked, "members", "asc")[0]?.id, "a");
});
