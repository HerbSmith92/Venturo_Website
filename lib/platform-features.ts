import "server-only";

function enabled(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

export const platformFeatures = {
  occurrenceBooking: enabled(process.env.FEATURE_OCCURRENCE_BOOKING),
  notificationOutbox: enabled(process.env.FEATURE_NOTIFICATION_OUTBOX),
  eventReports: enabled(process.env.FEATURE_EVENT_REPORTS),
  enhancedAnalytics: enabled(process.env.FEATURE_ENHANCED_ANALYTICS),
  communityTools: enabled(process.env.FEATURE_COMMUNITY_TOOLS),
} as const;
