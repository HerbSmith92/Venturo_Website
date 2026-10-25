/** True when a listing city or area names the place as a whole word. */
export function placeMentioned(city: string | null | undefined, area: string | null | undefined, placeName: string) {
  const needle = normalize(placeName);
  if (!needle) return false;
  const hay = normalize(`${city ?? ""} ${area ?? ""}`);
  return ` ${hay} `.includes(` ${needle} `);
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
