import { mapsQuery, type VenturoEvent } from "@/lib/event-types";

export function EventMap({
  event,
}: {
  event: Pick<
    VenturoEvent,
    | "venueName"
    | "addressLine1"
    | "addressLine2"
    | "city"
    | "postalCode"
    | "country"
    | "latitude"
    | "longitude"
  >;
}) {
  const pin =
    event.latitude != null && event.longitude != null
      ? `${event.latitude},${event.longitude}`
      : mapsQuery(event);
  if (!pin.trim()) return null;

  const encoded = encodeURIComponent(pin);
  return (
    <div className="event-map">
      <iframe
        title={`Map of ${event.venueName || "the venue"}`}
        src={`https://maps.google.com/maps?q=${encoded}&z=15&output=embed`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <a
        className="event-map-link"
        href={`https://www.google.com/maps/search/?api=1&query=${encoded}`}
        target="_blank"
        rel="noreferrer"
      >
        Open In Google Maps
      </a>
    </div>
  );
}
