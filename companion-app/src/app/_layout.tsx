import { useFonts } from "expo-font";
import { Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { BrandSplash } from "@/components/BrandSplash";
import { AuthProvider } from "@/lib/auth";
import { colours } from "@/lib/theme";

SplashScreen.preventAutoHideAsync();


export default function RootLayout() {
  const [loaded] = useFonts({
    SocialGothicRough: require("../../assets/fonts/SocialGothic-Rough.otf"),
    NunitoExtraLight: require("../../assets/fonts/Nunito-ExtraLight.ttf"),
    NunitoRegular: require("../../assets/fonts/Nunito-Regular.ttf"),
  });
  const [brandSplashDone, setBrandSplashDone] = useState(false);
  const pathname = usePathname();
  const showLaunchSplash = !brandSplashDone && pathname !== "/splash";

  useEffect(() => {
    if (!loaded) return;
    const fallback = setTimeout(() => {
      void SplashScreen.hideAsync();
    }, 2500);
    return () => clearTimeout(fallback);
  }, [loaded]);

  if (!loaded) return null;

  return (
    <AuthProvider>
      <View style={styles.shell}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colours.night },
            animation: "fade",
          }}
        />
        {showLaunchSplash ? (
          <View style={styles.overlay}>
            <BrandSplash
              onReady={() => void SplashScreen.hideAsync()}
              onFinished={() => setBrandSplashDone(true)}
            />
          </View>
        ) : null}
      </View>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colours.night,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
});
