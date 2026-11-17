"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createEventDraft } from "@/lib/events";

function safeHttpsUrl(value: string) {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (["localhost", "127.0.0.1", "::1"].includes(url.hostname.toLowerCase())) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function createVenturoEvent() {
  const staff = await requireStaff();
  let event: { id: string };
  try {
    event = await createEventDraft(staff.id, {
      title: "Untitled event",
      description: "",
      bookingMethod: "venturo_ticketing",
      ticketTypes: [],
    });
  } catch (error) {
    redirect(
      `/admin/events/new?error=${encodeURIComponent(
        error instanceof Error ? error.message : "Could not create that event.",
      )}`,
    );
  }
  revalidatePath("/admin/events");
  redirect(`/admin/events/${event.id}/edit`);
}

export async function createExternalEvent(formData: FormData) {
  const staff = await requireStaff();
  const title = String(formData.get("title") ?? "").trim();
  const organiserDisplayName = String(formData.get("organiserDisplayName") ?? "").trim();
  const externalProviderName = String(formData.get("externalProviderName") ?? "").trim();
  const externalBookingUrl = safeHttpsUrl(String(formData.get("externalBookingUrl") ?? ""));
  const externalBookingButtonLabel =
    String(formData.get("externalBookingButtonLabel") ?? "").trim() || "Book now";

  if (!title) {
    redirect("/admin/events/new?kind=external&error=" + encodeURIComponent("Give the event a name."));
  }
  if (!organiserDisplayName) {
    redirect(
      "/admin/events/new?kind=external&error=" +
        encodeURIComponent("Add the event organiser (the business or community running it)."),
    );
  }
  if (!externalProviderName) {
    redirect(
      "/admin/events/new?kind=external&error=" +
        encodeURIComponent("Add the booking provider, e.g. Quicket."),
    );
  }
  if (!externalBookingUrl) {
    redirect(
      "/admin/events/new?kind=external&error=" +
        encodeURIComponent("Add a valid HTTPS booking link."),
    );
  }

  let event: { id: string };
  try {
    event = await createEventDraft(staff.id, {
      title,
      description: "",
      organiserDisplayName,
      bookingMethod: "external",
      externalProviderName,
      externalBookingUrl,
      externalBookingButtonLabel,
      ticketTypes: [],
    });
  } catch (error) {
    redirect(
      `/admin/events/new?kind=external&error=${encodeURIComponent(
        error instanceof Error ? error.message : "Could not create that event.",
      )}`,
    );
  }
  revalidatePath("/admin/events");
  redirect(`/admin/events/${event.id}/edit`);
}
