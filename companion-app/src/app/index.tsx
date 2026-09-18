import { Redirect, router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandHeader } from "@/components/BrandHeader";
import { EventPosterCard } from "@/components/EventPosterCard";
import { useAuth } from "@/lib/auth";
import { listDoorEvents } from "@/lib/door";
import { loadEvents, saveEvents } from "@/lib/offline";
import { colours, fonts } from "@/lib/theme";
import type { CompanionEventCard } from "@/lib/types";

const CARD_GAP = 12;

export default function EventsScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { session, loading, signOut } = useAuth();
  const [events, setEvents] = useState<CompanionEventCard[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardWidth = Math.round(width * 0.58);

  const refresh = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const next = await listDoorEvents();
      setEvents(next);
      setFromCache(false);
      await saveEvents(next);
    } catch (err) {
      const cached = await loadEvents();
      if (cached.length) {
        setEvents(cached);
        setFromCache(true);
      }
      setError(err instanceof Error ? err.message : "Could not refresh events.");
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    void loadEvents().then((cached) => {
      if (cached.length) {
        setEvents(cached);
        setFromCache(true);
      }
    });
    void refresh();
  }, [session, refresh]);

  if (!loading && !session) return <Redirect href="/login" />;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <BrandHeader title="Pick An Event" onSignOut={() => void signOut()} />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl refreshing={syncing} onRefresh={() => void refresh()} tintColor={colours.snow} />
        }
      >
        <Text style={styles.subhead}>Your Events</Text>
        {fromCache ? <Text style={styles.cache}>Saved on this phone</Text> : null}
        {error && !events.length ? <Text style={styles.error}>{error}</Text> : null}
        {events.length === 0 && !syncing ? (
          <Text style={styles.muted}>
            No live events yet. The door unlocks when Control Room publishes.
          </Text>
        ) : (
          <ScrollView
            horizontal
            nestedScrollEnabled
            directionalLockEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={cardWidth + CARD_GAP}
            snapToAlignment="start"
            disableIntervalMomentum
            contentContainerStyle={styles.rail}
          >
            {events.map((event) => (
              <EventPosterCard
                key={event.id}
                event={event}
                width={cardWidth}
                onPress={() =>
                  router.push({
                    pathname: "/event/[id]",
                    params: { id: event.id, title: event.title },
                  })
                }
              />
            ))}
          </ScrollView>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colours.night },
  body: { paddingBottom: 48 },
  subhead: {
    color: colours.snow,
    fontFamily: fonts.heading,
    fontSize: 22,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  cache: {
    color: colours.canary,
    fontFamily: fonts.body,
    fontSize: 12,
    marginHorizontal: 20,
    marginTop: -10,
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  rail: {
    paddingHorizontal: 20,
    gap: CARD_GAP,
    paddingBottom: 8,
  },
  muted: {
    color: colours.snow,
    opacity: 0.7,
    fontFamily: fonts.body,
    fontSize: 13,
    marginHorizontal: 20,
  },
  error: {
    color: colours.pomegranate,
    fontFamily: fonts.body,
    marginHorizontal: 20,
    marginBottom: 12,
  },
});
