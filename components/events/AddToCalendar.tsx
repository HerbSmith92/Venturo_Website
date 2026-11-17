function compactUtc(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function AddToCalendar({
  slug,
  title,
  startsAt,
  endsAt,
  location,
}: {
  slug: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string;
}) {
  const dates = `${compactUtc(startsAt)}/${compactUtc(endsAt || startsAt)}`;
  const google = new URL("https://calendar.google.com/calendar/render");
  google.searchParams.set("action", "TEMPLATE");
  google.searchParams.set("text", title);
  google.searchParams.set("dates", dates);
  google.searchParams.set("location", location);

  return (
    <div className="calendar-actions" aria-label="Add to calendar">
      <a className="btn btn-secondary" href={`/api/events/${encodeURIComponent(slug)}/calendar?on=${encodeURIComponent(startsAt)}`}>
        Add to calendar
      </a>
      <a className="text-link" href={google.toString()} target="_blank" rel="noreferrer">
        Google Calendar
      </a>
    </div>
  );
}
