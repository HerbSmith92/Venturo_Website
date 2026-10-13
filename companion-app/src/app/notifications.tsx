import { Redirect, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandHeader } from "@/components/BrandHeader";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { colours, fonts } from "@/lib/theme";

type InboxItem = {
  id: string;
  title: string;
  body: string;
  link_path: string | null;
  read_at: string | null;
  created_at: string;
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { session, loading, signOut } = useAuth();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = session?.user.id;

  const refresh = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    setError(null);
    const { data, error: loadError } = await supabase
      .from("push_inbox")
      .select("id, title, body, link_path, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    setRefreshing(false);
    if (loadError) {
      setError("Could not load notifications.");
      return;
    }
    setItems((data ?? []) as InboxItem[]);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  if (!loading && !session) return <Redirect href="/login" />;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <BrandHeader
        backLabel="Back"
        onBack={() => router.back()}
        title="Notifications"
        onSignOut={() => void signOut()}
      />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colours.snow} />
        }
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!error && items.length === 0 && !refreshing ? (
          <Text style={styles.muted}>Nothing from Control Room yet.</Text>
        ) : null}
        {items.map((item) => (
          <Pressable
            key={item.id}
            style={[styles.card, item.read_at ? styles.read : null]}
            onPress={() => void openItem(item, refresh)}
          >
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardBody}>{item.body}</Text>
            <Text style={styles.when}>{formatWhen(item.created_at)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

async function openItem(item: InboxItem, refresh: () => Promise<void>) {
  await supabase.rpc("mark_push_read", { p_inbox_id: item.id });
  const event = item.link_path ? /^\/event\/([0-9a-f-]{36})$/i.exec(item.link_path) : null;
  if (event) {
    router.push({ pathname: "/event/[id]", params: { id: event[1] } });
    return;
  }
  await refresh();
}

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colours.night },
  body: { paddingHorizontal: 20, paddingBottom: 48, gap: 12 },
  muted: {
    color: colours.snow,
    opacity: 0.7,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  error: {
    color: colours.pomegranate,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(235,235,243,0.16)",
    padding: 16,
    gap: 6,
  },
  read: { opacity: 0.65 },
  cardTitle: {
    color: colours.snow,
    fontFamily: fonts.heading,
    fontSize: 22,
  },
  cardBody: {
    color: colours.snow,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  when: {
    color: colours.snow,
    opacity: 0.6,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 4,
  },
});
