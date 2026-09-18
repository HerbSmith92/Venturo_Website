import { Redirect, router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandHeader } from "@/components/BrandHeader";
import { useAuth } from "@/lib/auth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { colours, fonts } from "@/lib/theme";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { session, loading } = useAuth();
  const [step, setStep] = useState<"methods" | "email" | "code">("methods");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!loading && session) return <Redirect href="/" />;

  async function sendCode() {
    setError(null);
    if (!isSupabaseConfigured()) {
      setError("Connect Supabase in companion-app/.env first.");
      return;
    }
    setPending(true);
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false },
    });
    setPending(false);
    if (sendError) {
      const lower = sendError.message.toLowerCase();
      if (lower.includes("rate limit") || lower.includes("security purposes")) {
        setError("Hang tight — wait a moment before requesting another code.");
        return;
      }
      if (lower.includes("signups not allowed") || lower.includes("user not found")) {
        setError("No profile for that email yet. Join as a host on the website first.");
        return;
      }
      setError(sendError.message);
      return;
    }
    setStep("code");
  }

  async function verify() {
    setError(null);
    setPending(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: token.trim(),
      type: "email",
    });
    setPending(false);
    if (verifyError) {
      setError(verifyError.message);
      return;
    }
    router.replace("/");
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <BrandHeader showLogo />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>
          {step === "code" ? "Enter Your Code" : "Log In To Companion"}
        </Text>
        <Text style={styles.lede}>
          {step === "code"
            ? `We emailed a 6-digit code to ${email}. Check Mail on your phone — Inbox & Junk. It is not an SMS; iCloud can take a minute.`
            : "Same Venturo account as Event Host. Pull the guest list onto this phone, then scan at the door."}
        </Text>

        {step === "methods" && (
          <Pressable style={styles.method} onPress={() => setStep("email")}>
            <View style={styles.mark}>
              <Text style={styles.markText}>@</Text>
            </View>
            <View>
              <Text style={styles.methodTitle}>Email</Text>
              <Text style={styles.methodHint}>One-time code to your inbox</Text>
            </View>
          </Pressable>
        )}

        {step === "email" && (
          <View style={styles.form}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="you@studio.co.za"
              placeholderTextColor="rgba(235,235,243,0.4)"
              style={styles.input}
            />
            <Pressable style={styles.primary} onPress={() => void sendCode()} disabled={pending}>
              <Text style={styles.primaryText}>{pending ? "Please Wait" : "Email Me A Code"}</Text>
            </Pressable>
            <Pressable onPress={() => setStep("methods")}>
              <Text style={styles.link}>Other ways to log in</Text>
            </Pressable>
          </View>
        )}

        {step === "code" && (
          <View style={styles.form}>
            <Text style={styles.label}>One-Time Code</Text>
            <TextInput
              autoComplete="one-time-code"
              keyboardType="number-pad"
              value={token}
              onChangeText={setToken}
              placeholder="123456"
              placeholderTextColor="rgba(235,235,243,0.4)"
              style={styles.input}
            />
            <Pressable style={styles.primary} onPress={() => void verify()} disabled={pending}>
              <Text style={styles.primaryText}>{pending ? "Please Wait" : "Verify & Continue"}</Text>
            </Pressable>
            <Pressable onPress={() => void sendCode()}>
              <Text style={styles.link}>Resend code</Text>
            </Pressable>
          </View>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colours.night },
  body: { paddingHorizontal: 20, paddingBottom: 48 },
  title: {
    color: colours.snow,
    fontFamily: fonts.heading,
    fontSize: 32,
    marginBottom: 12,
  },
  lede: {
    color: colours.snow,
    opacity: 0.8,
    fontFamily: fonts.body,
    fontSize: 14,
    marginBottom: 24,
    lineHeight: 22,
  },
  method: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 64,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(235,235,243,0.16)",
  },
  mark: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colours.canary,
    alignItems: "center",
    justifyContent: "center",
  },
  markText: { color: colours.night, fontFamily: fonts.bodyStrong, fontSize: 18 },
  methodTitle: { color: colours.snow, fontFamily: fonts.bodyStrong, fontSize: 16 },
  methodHint: { color: colours.snow, opacity: 0.7, fontFamily: fonts.body, fontSize: 13 },
  form: { gap: 10 },
  label: {
    color: colours.snow,
    opacity: 0.7,
    fontFamily: fonts.body,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(235,235,243,0.22)",
    paddingHorizontal: 14,
    color: colours.snow,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  primary: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colours.canary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: colours.night, fontFamily: fonts.body, fontSize: 14 },
  link: { color: colours.sapphire, fontFamily: fonts.body, fontSize: 14, marginTop: 8 },
  error: { color: colours.pomegranate, fontFamily: fonts.body, marginTop: 16 },
});
