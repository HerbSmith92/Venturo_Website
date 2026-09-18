import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colours, fonts } from "@/lib/theme";

export function BrandHeader({
  showLogo = false,
  title,
  onSignOut,
  backLabel,
  onBack,
}: {
  showLogo?: boolean;
  title?: string;
  onSignOut?: () => void;
  backLabel?: string;
  onBack?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const showMenu = Boolean(onSignOut);

  return (
    <View style={styles.stack}>
      <View style={[styles.wrap, showLogo ? styles.wrapLogo : styles.wrapTitle]}>
        <View style={styles.left}>
          {showLogo ? (
            <Image
              source={require("../../assets/images/logo-stacked.png")}
              style={styles.logo}
              contentFit="contain"
              accessibilityLabel="Venturo"
            />
          ) : onBack ? (
            <Pressable onPress={onBack} style={styles.ghost} hitSlop={8}>
              <Text style={styles.ghostText}>{backLabel ?? "Back"}</Text>
            </Pressable>
          ) : title ? (
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
          ) : (
            <View />
          )}
        </View>
        {showMenu ? (
          <Pressable
            onPress={() => setMenuOpen(true)}
            style={styles.burgerHit}
            accessibilityRole="button"
            accessibilityLabel="Menu"
          >
            <View style={styles.burgerLine} />
            <View style={styles.burgerLine} />
            <View style={styles.burgerLine} />
          </Pressable>
        ) : null}
      </View>
      {onBack && title?.trim() ? (
        <Text style={styles.pageTitle} numberOfLines={2}>
          {title}
        </Text>
      ) : null}

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={[styles.menuScrim, { paddingTop: insets.top + 12 }]} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.menu} onPress={(event) => event.stopPropagation()}>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                router.push("/settings");
              }}
            >
              <Text style={styles.menuText}>Settings</Text>
            </Pressable>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                onSignOut?.();
              }}
            >
              <Text style={styles.menuText}>Log Out</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { paddingBottom: 4 },
  wrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 4,
    minHeight: 44,
    gap: 16,
  },
  wrapLogo: { alignItems: "flex-start", minHeight: 56, paddingBottom: 8 },
  wrapTitle: { alignItems: "center" },
  left: { flex: 1, minWidth: 0 },
  title: {
    color: colours.snow,
    fontFamily: fonts.heading,
    fontSize: 34,
    lineHeight: 36,
    paddingRight: 8,
  },
  pageTitle: {
    color: colours.snow,
    fontFamily: fonts.heading,
    fontSize: 34,
    lineHeight: 36,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
    textAlign: "left",
  },
  logo: {
    width: 88,
    height: 88,
  },
  ghost: {
    minHeight: 44,
    justifyContent: "center",
  },
  ghostText: {
    color: colours.snow,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  burgerHit: {
    width: 44,
    height: 44,
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 6,
  },
  burgerLine: {
    height: 2,
    backgroundColor: colours.snow,
    borderRadius: 1,
  },
  menuScrim: {
    flex: 1,
    backgroundColor: "rgba(20,0,26,0.55)",
    alignItems: "flex-end",
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  menu: {
    minWidth: 200,
    borderRadius: 18,
    backgroundColor: colours.night,
    borderWidth: 1,
    borderColor: "rgba(235,235,243,0.16)",
    overflow: "hidden",
  },
  menuItem: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  menuText: {
    color: colours.snow,
    fontFamily: fonts.body,
    fontSize: 14,
  },
});
