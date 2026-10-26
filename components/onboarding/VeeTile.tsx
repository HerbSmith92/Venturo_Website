import type { CSSProperties } from "react";
import type { VeeLook } from "@/lib/vee-avatars";

export function VeeTile({
  title,
  subtitle,
  look,
  pressed,
  onClick,
}: {
  title: string;
  subtitle?: string | null;
  look: VeeLook;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`vee-tile${pressed ? " on" : ""}`}
      data-ink={look.ink}
      style={{ "--vee-accent": look.accent } as CSSProperties}
      aria-pressed={pressed}
      onClick={onClick}
    >
      <img src={look.src} alt="" />
      <span>{title}</span>
      {subtitle ? <small>{subtitle}</small> : null}
    </button>
  );
}
