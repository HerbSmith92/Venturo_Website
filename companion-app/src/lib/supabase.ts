import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.warn("Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in companion-app/.env");
}

const memoryStorage = {
  getItem: async () => null,
  setItem: async () => undefined,
  removeItem: async () => undefined,
};

const isNodeWebRender = Platform.OS === "web" && typeof window === "undefined";

export const supabase = createClient(url ?? "", key ?? "", {
  auth: {
    storage: isNodeWebRender ? memoryStorage : AsyncStorage,
    autoRefreshToken: !isNodeWebRender,
    persistSession: !isNodeWebRender,
    detectSessionInUrl: false,
  },
});

export function isSupabaseConfigured() {
  return Boolean(url && key);
}
