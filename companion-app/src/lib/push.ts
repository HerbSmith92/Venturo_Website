import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";

const APP = "companion";
const INSTALL_KEY = "venturo.push.install";

let pushToken: string | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function deviceCanReceivePush() {
  return Boolean(pushToken);
}

export async function registerThisDevice() {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return;

  const installId = await installIdentifier();
  const token = await requestExpoToken();
  pushToken = token;

  const { error } = await supabase.rpc("register_push_device", {
    p_install_id: installId,
    p_platform: Platform.OS,
    p_app: APP,
    p_token: token,
  });
  if (error) console.warn("Could not register this phone for notifications.", error.message);
}

export async function unregisterThisDevice() {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return;
  pushToken = null;
  const installId = await SecureStore.getItemAsync(INSTALL_KEY);
  if (!installId) return;
  await supabase.rpc("unregister_push_device", {
    p_install_id: installId,
    p_app: APP,
  });
}

export function subscribeToInbox(userId: string) {
  const channel = supabase
    .channel(`push-inbox-${userId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "push_inbox", filter: `user_id=eq.${userId}` },
      (payload) => {
        if (pushToken) return;
        const row = payload.new as { title?: string; body?: string; link_path?: string | null };
        void Notifications.scheduleNotificationAsync({
          content: {
            title: row.title || "Venturo",
            body: row.body || "",
            data: { path: row.link_path ?? "" },
            sound: true,
          },
          trigger: null,
        });
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function notificationPath(data: Record<string, unknown> | undefined) {
  const path = data?.path;
  if (typeof path !== "string") return null;
  const event = /^\/event\/([0-9a-f-]{36})$/i.exec(path);
  if (event) return { kind: "event" as const, id: event[1] };
  return { kind: "inbox" as const };
}

async function installIdentifier() {
  const existing = await SecureStore.getItemAsync(INSTALL_KEY);
  if (existing) return existing;
  const created = newInstallId();
  await SecureStore.setItemAsync(INSTALL_KEY, created);
  return created;
}

async function requestExpoToken() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Venturo",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== "granted") {
    const asked = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
    status = asked.status;
  }
  if (status !== "granted" || !Device.isDevice) return null;

  const projectId = easProjectId();
  if (!projectId) return null;

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch (error) {
    console.warn("Push token was not issued.", error);
    return null;
  }
}

function easProjectId() {
  if (process.env.EXPO_PUBLIC_EAS_PROJECT_ID) return process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return Constants.easConfig?.projectId ?? extra?.eas?.projectId ?? null;
}

function newInstallId() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && "randomUUID" in cryptoApi) return cryptoApi.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
