import { useLocalSearchParams, router, Redirect } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Network from "expo-network";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandHeader } from "@/components/BrandHeader";
import { ScanCamera } from "@/components/ScanCamera";
import { useAuth } from "@/lib/auth";
import { getDoorStats, listDoorGuests, scanTicket } from "@/lib/door";
import { supabase } from "@/lib/supabase";
import {
  applyLocalCheckIn,
  listQueued,
  loadDoor,
  loadEvents,
  queueScan,
  removeQueued,
  saveDoor,
} from "@/lib/offline";
import { normalizeTicketCode } from "@/lib/ticket-code";
import { colours, fonts } from "@/lib/theme";
import type { DoorGuest, DoorStats, ScanTicketResult } from "@/lib/types";

function guestLabel(guest: Pick<DoorGuest, "guestName" | "guestEmail" | "code">) {
  return guest.guestName || guest.guestEmail || `Ticket ${guest.code}`;
}

function formatWhen(iso: string | null) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("en-ZA", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function paramText(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default function EventDoorScreen() {
  const { id, title: titleParam } = useLocalSearchParams<{ id: string; title?: string }>();
  const insets = useSafeAreaInsets();
  const { session, loading, signOut } = useAuth();
  const eventId = paramText(id);
  const [tab, setTab] = useState<"scan" | "guests">("scan");
  const [title, setTitle] = useState(paramText(titleParam));
  const [stats, setStats] = useState<DoorStats>({
    eventId,
    totalGuests: 0,
    scannedGuests: 0,
    remainingGuests: 0,
  });
  const [guests, setGuests] = useState<DoorGuest[]>([]);
  const [code, setCode] = useState("");
  const [filter, setFilter] = useState("");
  const [lastResult, setLastResult] = useState<ScanTicketResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const lock = useRef(false);
  const titleRef = useRef(title);
  titleRef.current = title;

  const persist = useCallback(
    async (nextGuests: DoorGuest[], nextStats: DoorStats, nextTitle?: string) => {
      await saveDoor({
        eventId,
        title: nextTitle || titleRef.current,
        guests: nextGuests,
        stats: nextStats,
        cachedAt: new Date().toISOString(),
      });
    },
    [eventId],
  );

  const refreshQueued = useCallback(async () => {
    const items = await listQueued(eventId);
    setQueued(items.length);
  }, [eventId]);

  const refreshDoor = useCallback(async () => {
    const eventRow = await supabase.from("events").select("title").eq("id", eventId).maybeSingle();
    const nextTitle = eventRow.data?.title ?? "";
    if (nextTitle) setTitle(nextTitle);

    const [nextStats, nextGuests] = await Promise.all([getDoorStats(eventId), listDoorGuests(eventId)]);
    setStats(nextStats);
    setGuests(nextGuests);
    await persist(nextGuests, nextStats, nextTitle);
  }, [eventId, persist]);

  const flushQueue = useCallback(async () => {
    const state = await Network.getNetworkStateAsync();
    if (!state.isConnected) return;
    const items = await listQueued(eventId);
    if (!items.length) return;
    setSyncing(true);
    try {
      for (const item of items) {
        try {
          await scanTicket(eventId, item.code);
          await removeQueued(item.id);
        } catch {
          // keep queued
        }
      }
      await refreshDoor();
      await refreshQueued();
    } finally {
      setSyncing(false);
    }
  }, [eventId, refreshDoor, refreshQueued]);

  useEffect(() => {
    const incoming = paramText(titleParam);
    if (incoming) setTitle(incoming);

    void loadDoor(eventId).then((cached) => {
      if (!cached) return;
      if (cached.title && cached.title !== "Door") setTitle(cached.title);
      setGuests(cached.guests);
      setStats(cached.stats);
    });
    void loadEvents().then((events) => {
      const match = events.find((event) => event.id === eventId);
      if (match?.title) setTitle(match.title);
    });
    void refreshDoor().catch(() => undefined);
    void refreshQueued();
  }, [eventId, refreshDoor, refreshQueued, titleParam]);

  useEffect(() => {
    const tick = async () => {
      const state = await Network.getNetworkStateAsync();
      setOnline(Boolean(state.isConnected));
      if (state.isConnected) void flushQueue();
    };
    void tick();
    const timer = setInterval(() => void tick(), 20000);
    return () => clearInterval(timer);
  }, [flushQueue]);

  async function submitCode(raw: string) {
    const trimmed = normalizeTicketCode(raw);
    if (!trimmed || lock.current) return;
    lock.current = true;
    setError(null);
    try {
      const state = await Network.getNetworkStateAsync();
      if (state.isConnected) {
        const payload = await scanTicket(eventId, trimmed);
        setLastResult(payload);
        setCode("");
        const applied = applyLocalCheckIn(guests, stats, payload);
        setGuests(applied.guests);
        setStats(applied.stats);
        await persist(applied.guests, applied.stats);
        if (payload.ok || payload.result === "already_scanned") {
          void Haptics.notificationAsync(
            payload.ok
              ? Haptics.NotificationFeedbackType.Success
              : Haptics.NotificationFeedbackType.Warning,
          );
        }
        void refreshDoor().catch(() => undefined);
        return;
      }

      const local = guests.find((guest) => guest.code.toUpperCase() === trimmed);
      if (local?.isScanned) {
        setLastResult({
          ok: false,
          result: "already_scanned",
          message: "Already scanned. Saved on this phone.",
          ticket: {
            id: local.ticketId,
            code: local.code,
            ticketTypeName: local.ticketTypeName,
            guestName: local.guestName,
            guestEmail: local.guestEmail,
            scannedAt: local.scannedAt,
            isScanned: true,
          },
          stats,
        });
        setCode("");
        return;
      }

      await queueScan(eventId, trimmed);
      await refreshQueued();
      if (local) {
        const payload: ScanTicketResult = {
          ok: true,
          result: "ok",
          message: "Checked in offline. We'll sync when you're back online.",
          ticket: {
            id: local.ticketId,
            code: local.code,
            ticketTypeName: local.ticketTypeName,
            guestName: local.guestName,
            guestEmail: local.guestEmail,
            scannedAt: new Date().toISOString(),
            isScanned: true,
          },
        };
        const applied = applyLocalCheckIn(guests, stats, payload);
        setLastResult({ ...payload, stats: applied.stats });
        setGuests(applied.guests);
        setStats(applied.stats);
        await persist(applied.guests, applied.stats);
      } else {
        setLastResult({
          ok: true,
          result: "ok",
          message: "Saved offline. We'll confirm this code when you're back online.",
        });
      }
      setCode("");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed.");
    } finally {
      lock.current = false;
    }
  }

  const filtered = guests.filter((guest) => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return true;
    return (
      guestLabel(guest).toLowerCase().includes(needle) ||
      guest.code.toLowerCase().includes(needle) ||
      guest.ticketTypeName.toLowerCase().includes(needle)
    );
  });

  const tone =
    lastResult?.result === "ok" ? "ok" : lastResult?.result === "already_scanned" ? "warn" : lastResult ? "bad" : null;

  if (!loading && !session) return <Redirect href="/login" />;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <BrandHeader
        backLabel="Back"
        onBack={() => router.back()}
        title={title}
        onSignOut={() => void signOut()}
      />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.pills}>
          <Text style={[styles.pill, !online && styles.pillWarn]}>{online ? "Online" : "Offline"}</Text>
          {queued > 0 ? <Text style={styles.pillWarn}>{queued} waiting to sync</Text> : null}
          <Pressable onPress={() => void flushQueue()} disabled={!online || syncing}>
            <Text style={styles.link}>{syncing ? "Syncing…" : "Sync"}</Text>
          </Pressable>
        </View>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{stats.scannedGuests}</Text>
            <Text style={styles.statLabel}>Scanned</Text>
          </View>
          <View style={[styles.stat, styles.statAccent]}>
            <Text style={styles.statNum}>{stats.remainingGuests}</Text>
            <Text style={styles.statLabel}>Still to come</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{stats.totalGuests}</Text>
            <Text style={styles.statLabel}>On the list</Text>
          </View>
        </View>

        <View style={styles.tabs}>
          <Pressable style={[styles.tab, tab === "scan" && styles.tabOn]} onPress={() => setTab("scan")}>
            <Text style={[styles.tabText, tab === "scan" && styles.tabTextOn]}>Scan</Text>
          </Pressable>
          <Pressable style={[styles.tab, tab === "guests" && styles.tabOn]} onPress={() => setTab("guests")}>
            <Text style={[styles.tabText, tab === "guests" && styles.tabTextOn]}>Guest List</Text>
          </Pressable>
        </View>

        {tab === "scan" ? (
          <View>
            <ScanCamera
              onCode={(value) => void submitCode(value)}
              result={
                lastResult && tone
                  ? {
                      tone,
                      title: lastResult.message,
                      detail: lastResult.ticket
                        ? `${guestLabel({
                            guestName: lastResult.ticket.guestName,
                            guestEmail: lastResult.ticket.guestEmail,
                            code: lastResult.ticket.code,
                          })} · ${lastResult.ticket.ticketTypeName}`
                        : undefined,
                    }
                  : null
              }
            />
            <Text style={styles.label}>Or type the code</Text>
            <View style={styles.row}>
              <TextInput
                value={code}
                onChangeText={setCode}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="Scan or type code"
                placeholderTextColor="rgba(235,235,243,0.4)"
                style={styles.input}
              />
              <Pressable style={styles.primary} onPress={() => void submitCode(code)}>
                <Text style={styles.primaryText}>Check In</Text>
              </Pressable>
            </View>
            {error ? <Text style={styles.flashBad}>{error}</Text> : null}
            {lastResult ? (
              <View
                style={[
                  styles.flash,
                  tone === "ok" && styles.flashOk,
                  tone === "warn" && styles.flashWarn,
                  tone === "bad" && styles.flashBadBox,
                ]}
              >
                <Text style={styles.flashTitle}>{lastResult.message}</Text>
                {lastResult.ticket ? (
                  <Text style={styles.muted}>
                    {guestLabel({
                      guestName: lastResult.ticket.guestName,
                      guestEmail: lastResult.ticket.guestEmail,
                      code: lastResult.ticket.code,
                    })}
                    {" · "}
                    {lastResult.ticket.ticketTypeName}
                    {" · "}
                    {lastResult.ticket.code}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : (
          <View>
            <Text style={styles.label}>Find a guest</Text>
            <TextInput
              value={filter}
              onChangeText={setFilter}
              placeholder="Name, email, code…"
              placeholderTextColor="rgba(235,235,243,0.4)"
              style={styles.input}
            />
            {filtered.map((guest) => (
              <View key={guest.ticketId} style={styles.guest}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.guestName}>{guestLabel(guest)}</Text>
                  <Text style={styles.muted}>
                    {guest.ticketTypeName}
                    {guest.guestEmail ? ` · ${guest.guestEmail}` : ""}
                    {" · "}
                    {guest.code}
                  </Text>
                  <Text style={styles.muted}>
                    Bought {formatWhen(guest.purchasedAt)}
                    {guest.isScanned && guest.scannedAt ? ` · Scanned ${formatWhen(guest.scannedAt)}` : ""}
                  </Text>
                </View>
                <Text style={[styles.badge, guest.isScanned ? styles.badgeIn : styles.badgeOut]}>
                  {guest.isScanned ? "Scanned" : "Waiting"}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colours.night },
  body: { paddingHorizontal: 20, paddingBottom: 48 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 16 },
  pill: {
    color: colours.jade,
    backgroundColor: "rgba(69,166,127,0.22)",
    overflow: "hidden",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontFamily: fonts.body,
    fontSize: 12,
    textTransform: "uppercase",
  },
  pillWarn: {
    color: colours.night,
    backgroundColor: colours.canary,
    overflow: "hidden",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontFamily: fonts.body,
    fontSize: 12,
    textTransform: "uppercase",
  },
  link: { color: colours.sapphire, fontFamily: fonts.body, fontSize: 14 },
  stats: { flexDirection: "row", gap: 10, marginBottom: 16 },
  stat: {
    flex: 1,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(235,235,243,0.07)",
    borderWidth: 1,
    borderColor: "rgba(235,235,243,0.12)",
  },
  statAccent: {
    backgroundColor: "rgba(243,191,74,0.16)",
    borderColor: "rgba(243,191,74,0.35)",
  },
  statNum: { color: colours.snow, fontFamily: fonts.heading, fontSize: 28 },
  statLabel: { color: colours.snow, opacity: 0.72, fontFamily: fonts.body, fontSize: 12, marginTop: 6 },
  tabs: { flexDirection: "row", gap: 8, marginBottom: 16 },
  tab: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: "rgba(235,235,243,0.12)",
    justifyContent: "center",
  },
  tabOn: { backgroundColor: colours.canary },
  tabText: { color: colours.snow, fontFamily: fonts.body, fontSize: 14 },
  tabTextOn: { color: colours.night },
  label: {
    color: colours.snow,
    opacity: 0.7,
    fontFamily: fonts.body,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  row: { flexDirection: "row", gap: 10 },
  input: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(235,235,243,0.22)",
    paddingHorizontal: 14,
    color: colours.snow,
    fontFamily: fonts.body,
    marginBottom: 12,
  },
  primary: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colours.canary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryText: { color: colours.night, fontFamily: fonts.body, fontSize: 14 },
  flash: {
    marginTop: 16,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(235,235,243,0.16)",
  },
  flashOk: { backgroundColor: "rgba(69,166,127,0.18)", borderColor: colours.jade },
  flashWarn: { backgroundColor: "rgba(243,191,74,0.16)", borderColor: colours.canary },
  flashBadBox: { backgroundColor: "rgba(213,71,50,0.18)", borderColor: colours.pomegranate },
  flashTitle: { color: colours.snow, fontFamily: fonts.heading, fontSize: 22, marginBottom: 4 },
  flashBad: { color: colours.pomegranate, fontFamily: fonts.body, marginTop: 12 },
  muted: { color: colours.snow, opacity: 0.75, fontFamily: fonts.body, fontSize: 13 },
  guest: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(235,235,243,0.05)",
    marginTop: 10,
  },
  guestName: { color: colours.snow, fontFamily: fonts.bodyStrong, fontSize: 16, marginBottom: 4 },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontFamily: fonts.body,
    fontSize: 11,
    textTransform: "uppercase",
    overflow: "hidden",
  },
  badgeIn: { color: colours.jade, backgroundColor: "rgba(69,166,127,0.24)" },
  badgeOut: { color: colours.orange, backgroundColor: "rgba(255,158,107,0.18)" },
});
