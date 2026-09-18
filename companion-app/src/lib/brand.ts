import type { ImageSource } from "expo-image";

/** Locked in Brand Guide v1.2. Do not rewrite. Headlines stay Title Case. */
export const TAGLINES = [
  "Quality Time Is Our Love Language",
  "Your Next Adventure Awaits",
  "Explore, Connect, Thrive",
  "Find Your Next Thrill",
  "Expand Your Comfort Zone",
  "Life’s An Adventure",
] as const;

export const SPLASH_PHOTOS: ImageSource[] = [
  require("../../assets/images/splash/hero-family-van.jpg"),
  require("../../assets/images/splash/climbing.jpg"),
  require("../../assets/images/splash/zipline.jpg"),
  require("../../assets/images/splash/nightlife.jpg"),
  require("../../assets/images/splash/gokart.jpg"),
  require("../../assets/images/splash/family.jpg"),
];
