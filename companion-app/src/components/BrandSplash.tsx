import { Image } from "expo-image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SPLASH_PHOTOS, TAGLINES } from "@/lib/brand";
import { colours, fonts } from "@/lib/theme";

const PHOTO_MS = 2600;
const TAGLINE_MS = 2800;
const MIN_VISIBLE_MS = 5200;
const FADE_MS = 420;
const CROSSFADE_MS = 700;
const nativeDriver = Platform.OS !== "web";

function nextIndex(current: number, length: number) {
  return (current + 1) % length;
}

export function BrandSplash({
  onReady,
  onFinished,
  autoDismiss = true,
}: {
  onReady: () => void;
  onFinished?: () => void;
  autoDismiss?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const startPhoto = useMemo(
    () => Math.floor(Math.random() * SPLASH_PHOTOS.length),
    [],
  );
  const startTagline = useMemo(
    () => Math.floor(Math.random() * TAGLINES.length),
    [],
  );
  const [photoIndex, setPhotoIndex] = useState(startPhoto);
  const [taglineIndex, setTaglineIndex] = useState(startTagline);
  const taglineOpacity = useRef(new Animated.Value(1)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const finished = useRef(false);
  const ready = useRef(false);
  const logoSize = Math.min(168, Math.round(width * 0.42));

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: FADE_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: nativeDriver,
    }).start(() => onFinished?.());
  };

  useEffect(() => {
    const photos = setInterval(() => {
      setPhotoIndex((current) => nextIndex(current, SPLASH_PHOTOS.length));
    }, PHOTO_MS);
    const lines = setInterval(() => {
      Animated.timing(taglineOpacity, {
        toValue: 0,
        duration: 280,
        easing: Easing.in(Easing.quad),
        useNativeDriver: nativeDriver,
      }).start(({ finished: faded }) => {
        if (!faded) return;
        setTaglineIndex((current) => nextIndex(current, TAGLINES.length));
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.quad),
          useNativeDriver: nativeDriver,
        }).start();
      });
    }, TAGLINE_MS);
    const hold = autoDismiss ? setTimeout(finish, MIN_VISIBLE_MS) : undefined;
    return () => {
      clearInterval(photos);
      clearInterval(lines);
      if (hold) clearTimeout(hold);
    };
  }, [autoDismiss, taglineOpacity]);

  return (
    <Animated.View
      style={[styles.root, { opacity: screenOpacity, pointerEvents: "auto" }]}
    >
      <Pressable
        style={styles.fill}
        onPress={autoDismiss ? finish : undefined}
        accessibilityRole="button"
        accessibilityLabel="Continue"
        onLayout={() => {
          if (ready.current) return;
          ready.current = true;
          onReady();
        }}
      >
        <Image
          source={SPLASH_PHOTOS[photoIndex]}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={CROSSFADE_MS}
          accessibilityIgnoresInvertColors
        />
        <View style={styles.wash} />
        <View
          style={[
            styles.lockup,
            {
              paddingTop: insets.top + 72,
              paddingBottom: insets.bottom + 48,
            },
          ]}
        >
          <Image
            source={require("../../assets/images/logo-stacked-dark.png")}
            style={{ width: logoSize, height: logoSize }}
            contentFit="contain"
            accessibilityLabel="Venturo"
          />
          <Animated.View style={[styles.taglineWrap, { opacity: taglineOpacity }]}>
            <Text style={styles.tagline}>{TAGLINES[taglineIndex]}</Text>
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: colours.night,
  },
  fill: {
    flex: 1,
  },
  wash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(42,45,53,0.42)",
  },
  lockup: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 28,
  },
  taglineWrap: {
    marginTop: 28,
    maxWidth: 320,
  },
  tagline: {
    color: colours.snow,
    fontFamily: fonts.heading,
    fontSize: 26,
    lineHeight: 30,
    textAlign: "center",
  },
});
