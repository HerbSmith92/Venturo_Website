import { getPublicSiteUrl } from "@/lib/site-url";

export function campaignPublicUrl(eventSlug: string, campaignSlug: string, origin?: string) {
  return `${getPublicSiteUrl(origin)}/events/${eventSlug}?c=${encodeURIComponent(campaignSlug)}`;
}

export function invitePublicUrl(token: string, origin?: string) {
  return `${getPublicSiteUrl(origin)}/invite/${token}`;
}

export function inviteMailto(email: string, eventTitle: string, url: string) {
  const subject = encodeURIComponent(eventTitle);
  const body = encodeURIComponent(`You're invited to ${eventTitle}. Grab your ticket here:\n\n${url}`);
  return `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
}
