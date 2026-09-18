import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import {
  eventCategoryColour,
  formatCents,
  formatEventWhen,
  hasMemberDeal,
  publicPriceLabel,
} from "@/lib/event-style";
import { colours, fonts } from "@/lib/theme";
import type { CompanionEventCard } from "@/lib/types";

export const POSTER_ASPECT = 4 / 5;

export function EventPosterCard({
  event,
  onPress,
  width,
}: {
  event: CompanionEventCard;
  onPress: () => void;
  width: number;
}) {
  const colour = eventCategoryColour(event.category);
  const membersOnly = Boolean(event.membersOnly);
  const fromPriceCents = event.fromPriceCents ?? null;
  const memberFromPriceCents = event.memberFromPriceCents ?? null;
  const deal = hasMemberDeal({ fromPriceCents, memberFromPriceCents });
  const kicker = [
    event.category || "Adventure & Thrills",
    event.audienceGender && event.audienceGender !== "Everyone" ? event.audienceGender : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const when = event.startsAt ? formatEventWhen(event.startsAt, event.timezone) : "Date coming";
  const showCancelled = event.status === "cancelled";
  const imageHeight = Math.round(width * POSTER_ASPECT);
  const imageUri = event.imageUrl?.trim() || null;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        { width },
        deal ? { borderColor: colour, borderWidth: 2 } : null,
      ]}
    >
      <View style={[styles.accent, { backgroundColor: colour }]} />
      <View style={[styles.imageWrap, { width, height: imageHeight }]}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={{ width, height: imageHeight }} resizeMode="cover" />
        ) : (
          <View style={{ width, height: imageHeight, backgroundColor: "rgba(235,235,243,0.08)" }} />
        )}
        {showCancelled ? <Text style={[styles.badge, styles.cancelled]}>Cancelled</Text> : null}
        {deal ? (
          <Text style={styles.deal}>{membersOnly ? "Members" : "Members Save"}</Text>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text style={[styles.kicker, { color: colour }]}>{kicker}</Text>
        <Text style={styles.title} numberOfLines={2}>
          {event.title || "Untitled adventure"}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {when}
          {event.city ? ` · ${event.city}` : ""}
        </Text>
        <Text style={styles.price}>
          {publicPriceLabel({ membersOnly, fromPriceCents, memberFromPriceCents })}
        </Text>
        {deal && !membersOnly && memberFromPriceCents !== null ? (
          <Text style={styles.memberPrice}>Members from {formatCents(memberFromPriceCents)}</Text>
        ) : null}
        {event.stats ? (
          <Text style={styles.meta}>
            {event.stats.scannedGuests} scanned · {event.stats.remainingGuests} still to come
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#221D2C",
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(235,235,243,0.08)",
  },
  accent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    zIndex: 2,
  },
  imageWrap: {
    backgroundColor: "rgba(235,235,243,0.08)",
    overflow: "hidden",
  },
  badge: {
    position: "absolute",
    left: 14,
    top: 10,
    overflow: "hidden",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontFamily: fonts.bodyStrong,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  cancelled: {
    backgroundColor: colours.pomegranate,
    color: colours.snow,
  },
  deal: {
    position: "absolute",
    left: 14,
    bottom: 10,
    overflow: "hidden",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: colours.canary,
    color: colours.night,
    fontFamily: fonts.bodyStrong,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  body: {
    paddingTop: 10,
    paddingRight: 14,
    paddingBottom: 12,
    paddingLeft: 16,
  },
  kicker: {
    fontFamily: fonts.body,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  title: {
    color: colours.snow,
    fontFamily: fonts.heading,
    fontSize: 16,
    lineHeight: 18,
    marginBottom: 4,
  },
  meta: {
    color: "rgba(235,235,243,0.75)",
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
  price: {
    color: colours.snow,
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 8,
  },
  memberPrice: {
    color: colours.canary,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
});
