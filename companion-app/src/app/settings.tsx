import { Redirect, router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandHeader } from "@/components/BrandHeader";
import { useAuth } from "@/lib/auth";
import { colours, fonts } from "@/lib/theme";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { session, loading, signOut } = useAuth();

  if (!loading && !session) return <Redirect href="/login" />;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <BrandHeader
        backLabel="Back"
        onBack={() => router.back()}
        onSignOut={() => void signOut()}
      />
      <View style={styles.body}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.label}>Signed in</Text>
        <Text style={styles.value}>{session?.user.email ?? "—"}</Text>
        <Pressable
          style={styles.primary}
          onPress={async () => {
            await signOut();
            router.replace("/login");
          }}
        >
          <Text style={styles.primaryText}>Log Out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colours.night },
  body: { paddingHorizontal: 20, paddingTop: 8 },
  title: {
    color: colours.snow,
    fontFamily: fonts.heading,
    fontSize: 32,
    marginBottom: 24,
  },
  label: {
    color: colours.snow,
    opacity: 0.7,
    fontFamily: fonts.body,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  value: {
    color: colours.snow,
    fontFamily: fonts.body,
    fontSize: 16,
    marginBottom: 28,
  },
  primary: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(235,235,243,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: colours.snow, fontFamily: fonts.body, fontSize: 14 },
});
