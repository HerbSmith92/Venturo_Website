import { CameraView, useCameraPermissions } from "expo-camera";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colours, fonts } from "@/lib/theme";

export type ScanBanner = {
  tone: "ok" | "warn" | "bad";
  title: string;
  detail?: string;
};

export function ScanCamera({
  onCode,
  result,
}: {
  onCode: (code: string) => void;
  result?: ScanBanner | null;
}) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [open, setOpen] = useState(false);
  const [torch, setTorch] = useState(false);
  const [last, setLast] = useState({ code: "", at: 0 });

  function close() {
    setOpen(false);
    setTorch(false);
  }

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.openBtn} onPress={() => setOpen(true)}>
        <Text style={styles.openText}>Open Camera</Text>
      </Pressable>

      {open ? (
      <Modal visible animationType="fade" onRequestClose={close}>
        <View style={styles.full}>
          {!permission ? (
            <Text style={styles.note}>Checking camera…</Text>
          ) : !permission.granted ? (
            <View style={[styles.permit, { paddingTop: insets.top + 16 }]}>
              <Text style={styles.note}>
                Allow the camera so we can read QR codes from phones & printed tickets.
              </Text>
              <Pressable style={styles.openBtn} onPress={() => void requestPermission()}>
                <Text style={styles.openText}>Allow Camera</Text>
              </Pressable>
              <Pressable style={styles.ghost} onPress={close}>
                <Text style={styles.ghostText}>Close</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                enableTorch={torch}
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={({ data }) => {
                  const now = Date.now();
                  if (data === last.code && now - last.at < 2800) return;
                  setLast({ code: data, at: now });
                  onCode(data);
                }}
              />
              <View style={styles.frame} pointerEvents="none" />
              <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
                <Pressable style={styles.ghost} onPress={close} accessibilityLabel="Close camera">
                  <Text style={styles.ghostText}>Close</Text>
                </Pressable>
                <Pressable style={styles.ghost} onPress={() => setTorch((value) => !value)}>
                  <Text style={styles.ghostText}>{torch ? "Torch Off" : "Torch On"}</Text>
                </Pressable>
              </View>
              {result ? (
                <View
                  style={[
                    styles.banner,
                    { paddingBottom: Math.max(insets.bottom, 16) },
                    result.tone === "ok" && styles.bannerOk,
                    result.tone === "warn" && styles.bannerWarn,
                    result.tone === "bad" && styles.bannerBad,
                  ]}
                >
                  <Text style={styles.bannerTitle}>{result.title}</Text>
                  {result.detail ? <Text style={styles.bannerDetail}>{result.detail}</Text> : null}
                  <Text style={styles.hint}>Ready for the next ticket</Text>
                </View>
              ) : (
                <Text style={[styles.hint, { bottom: Math.max(insets.bottom, 20) }]}>
                  Line up a phone or a printed ticket
                </Text>
              )}
            </>
          )}
        </View>
      </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 18 },
  openBtn: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colours.canary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  openText: { color: colours.night, fontFamily: fonts.body, fontSize: 14 },
  full: { flex: 1, backgroundColor: colours.night },
  permit: { flex: 1, paddingHorizontal: 20, gap: 16, justifyContent: "center" },
  note: { color: colours.snow, opacity: 0.8, fontFamily: fonts.body, fontSize: 14 },
  frame: {
    position: "absolute",
    top: "22%",
    left: "12%",
    right: "12%",
    bottom: "28%",
    borderWidth: 2,
    borderColor: colours.canary,
    borderRadius: 12,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  ghost: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(42,45,53,0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  ghostText: { color: colours.snow, fontFamily: fonts.body, fontSize: 14 },
  hint: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 20,
    color: colours.snow,
    fontFamily: fonts.body,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    textAlign: "center",
  },
  banner: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  bannerOk: { backgroundColor: "rgba(69,166,127,0.92)" },
  bannerWarn: { backgroundColor: "rgba(243,191,74,0.92)" },
  bannerBad: { backgroundColor: "rgba(213,71,50,0.92)" },
  bannerTitle: { color: colours.night, fontFamily: fonts.heading, fontSize: 22, marginBottom: 4 },
  bannerDetail: { color: colours.night, fontFamily: fonts.body, fontSize: 14, marginBottom: 8 },
});
