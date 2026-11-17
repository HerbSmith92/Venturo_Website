"use client";

import type { ReactNode } from "react";

export type PhoneSize = "compact" | "standard" | "large";

const WIDTH: Record<PhoneSize, number> = {
  compact: 260,
  standard: 300,
  large: 340,
};

export function PhonePreview({
  label = "App preview",
  size = "standard",
  children,
}: {
  label?: string;
  size?: PhoneSize;
  children: ReactNode;
}) {
  return (
    <div className="cr-phone-wrap cr-manage-phone">
      <p className="cr-phone-label">{label}</p>
      <div className="cr-device">
        <div className="cr-device-bezel" style={{ maxWidth: WIDTH[size] }}>
          <div className="cr-device-screen">
            <div className="cr-device-status">
              <span>09:41</span>
              <span className="cr-device-island" aria-hidden />
              <span className="cr-device-signals" aria-hidden>
                ●●●
              </span>
            </div>
            <div className="cr-manage-phone-body">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PhoneSizeToggle({
  value,
  onChange,
}: {
  value: PhoneSize;
  onChange: (size: PhoneSize) => void;
}) {
  return (
    <div className="cr-manage-phone-sizes" role="group" aria-label="Preview size">
      {(
        [
          ["compact", "Compact"],
          ["standard", "Standard"],
          ["large", "Large"],
        ] as const
      ).map(([key, title]) => (
        <button
          key={key}
          type="button"
          className={value === key ? "btn is-on" : "btn"}
          onClick={() => onChange(key)}
        >
          {title}
        </button>
      ))}
    </div>
  );
}
