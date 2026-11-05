"use client";

export function DirectorySearch({
  q,
  place,
  price,
  sort,
  category,
  lat,
  lng,
}: {
  q: string;
  place: string;
  price: string;
  sort: string;
  category: string;
  lat?: string;
  lng?: string;
}) {
  const filtered = Boolean(q || place || price || (category && category !== "all") || lat);

  return (
    <form className="directory-filters" action="/directory">
      {category && category !== "all" ? <input type="hidden" name="category" value={category} /> : null}
      {lat ? <input type="hidden" name="lat" value={lat} /> : null}
      {lng ? <input type="hidden" name="lng" value={lng} /> : null}
      <input name="q" type="search" defaultValue={q} placeholder="Keyword" aria-label="Keyword" />
      <input name="place" type="search" defaultValue={place} placeholder="Place" aria-label="Place" />
      <input name="price" inputMode="decimal" defaultValue={price} placeholder="Max price (R)" aria-label="Maximum price" />
      <select name="sort" defaultValue={sort} aria-label="Sort">
        <option value="name">Name</option>
        <option value="price">Price</option>
        <option value="rating">Rating</option>
        <option value="distance">Distance</option>
      </select>
      <div className="directory-filter-actions">
        <button className="btn btn-secondary" type="submit">
          Search
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => {
            if (!navigator.geolocation) return;
            navigator.geolocation.getCurrentPosition((position) => {
              const params = new URLSearchParams(window.location.search);
              params.set("lat", String(position.coords.latitude));
              params.set("lng", String(position.coords.longitude));
              params.set("sort", "distance");
              window.location.href = `/directory?${params.toString()}`;
            });
          }}
        >
          Near Me
        </button>
        {filtered ? (
          <a className="btn btn-ghost" href="/directory">
            Clear
          </a>
        ) : null}
      </div>
    </form>
  );
}
