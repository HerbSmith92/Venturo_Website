"use client";

import { useEffect, useRef, useState } from "react";

const OTP_LENGTH = 6;

function onlyDigits(raw: string) {
  return raw.replace(/\D/g, "").slice(0, OTP_LENGTH);
}

function slotsFrom(raw: string) {
  const digits = onlyDigits(raw);
  return Array.from({ length: OTP_LENGTH }, (_, index) => digits[index] ?? "");
}

export function OtpCodeBoxes({
  name = "token",
  value,
  onChange,
  disabled = false,
  autoFocus = true,
}: {
  name?: string;
  value?: string;
  onChange?: (code: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const [digits, setDigits] = useState(() => slotsFrom(value ?? ""));
  const boxes = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (value === undefined) return;
    setDigits(slotsFrom(value));
  }, [value]);

  const code = digits.join("");

  function publish(next: string[]) {
    setDigits(next);
    onChange?.(next.join(""));
  }

  function fillFrom(raw: string, start = 0) {
    const incoming = onlyDigits(raw);
    if (!incoming) {
      if (!raw) return;
      publish(slotsFrom(""));
      return;
    }
    const next = [...digits];
    incoming.split("").forEach((char, index) => {
      const slot = start + index;
      if (slot < OTP_LENGTH) next[slot] = char;
    });
    publish(next);
    boxes.current[Math.min(start + incoming.length, OTP_LENGTH - 1)]?.focus();
  }

  return (
    <div className="otp-boxes">
      <input type="hidden" name={name} value={code} />
      <input
        className="otp-collector"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        value={code}
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
        onChange={(event) => fillFrom(event.target.value, 0)}
      />
      <div className="otp-boxes-row">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(node) => {
              boxes.current[index] = node;
            }}
            className="otp-box"
            type="text"
            inputMode="numeric"
            name={`otp-${index}`}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
            data-1p-ignore="true"
            maxLength={1}
            value={digit}
            disabled={disabled}
            autoFocus={autoFocus && index === 0}
            aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
            onChange={(event) => {
              const incoming = onlyDigits(event.target.value);
              if (incoming.length > 1) {
                fillFrom(incoming, 0);
                return;
              }
              const next = [...digits];
              next[index] = incoming.slice(-1);
              publish(next);
              if (incoming && index < OTP_LENGTH - 1) boxes.current[index + 1]?.focus();
            }}
            onKeyDown={(event) => {
              if (event.key === "Backspace" && !digits[index] && index > 0) {
                event.preventDefault();
                const next = [...digits];
                next[index - 1] = "";
                publish(next);
                boxes.current[index - 1]?.focus();
              }
              if (event.key === "ArrowLeft" && index > 0) {
                event.preventDefault();
                boxes.current[index - 1]?.focus();
              }
              if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
                event.preventDefault();
                boxes.current[index + 1]?.focus();
              }
            }}
            onPaste={(event) => {
              event.preventDefault();
              fillFrom(event.clipboardData.getData("text"), 0);
            }}
          />
        ))}
      </div>
    </div>
  );
}
