import type { IndoorOutdoorSetting } from "@/lib/setting";

/** Compact inline SVG for Indoor / Outdoor / both. */
export function SettingIcon({
  setting,
  className,
}: {
  setting: IndoorOutdoorSetting;
  className?: string;
}) {
  const size = 16;
  if (setting === "indoor") {
    return (
      <svg
        className={className}
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M2.5 7.2 8 2.5l5.5 4.7V14H9.2v-3.4H6.8V14H2.5V7.2Z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (setting === "outdoor") {
    return (
      <svg
        className={className}
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M8 2.2v2.2M8 11.6v2.2M2.2 8h2.2M11.6 8h2.2M4.1 4.1l1.6 1.6M10.3 10.3l1.6 1.6M11.9 4.1l-1.6 1.6M5.7 10.3l-1.6 1.6"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    );
  }
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2.2 8.8 5.5 5.8l2 1.7 2.8-2.7 3.5 3.2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M2.2 13.2h11.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
