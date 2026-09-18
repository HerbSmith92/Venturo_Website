import { StyleSheet, View } from "react-native";
import { BrandSplash } from "@/components/BrandSplash";
import { colours } from "@/lib/theme";

/** Standalone splash for screen-by-screen review. Launch still uses the overlay. */
export default function SplashScreen() {
  return (
    <View style={styles.shell}>
      <BrandSplash autoDismiss={false} onReady={() => undefined} />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colours.night,
  },
});
