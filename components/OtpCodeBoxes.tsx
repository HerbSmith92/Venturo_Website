"use client";

import { useEffect, useRef, useState } from "react";

const OTP_LENGTH = 6;

function onlyDigits(raw: string) {
  return raw.replace(/\D/g, "").slice(0, OTP_LENGTH);
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
  const [digits, setDigits] = useState(() =>
    Array.from({ length: OTP_LENGTH }, (_, index) => onlyDigits(value ?? "")[index] ?? ""),
  );
  const boxes = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (value === undefined) return;
    setDigits(Array.from({ length: OTP_LENGTH }, (_, index) => onlyDigits(value)[index] ?? ""));
  }, [value]);

  const code = digits.join("").replace(/\s/g, "");

  function publish(next: string[]) {
    setDigits(next);
    onChange?.(next.join("").replace(/\s/g, ""));
  }

  function fillFrom(raw: string, start = 0) {
    const incoming = onlyDigits(raw);
    if (!incoming) return;
    const next = [...digits];
    incoming.split("").forEach((char, index) => {
      const slot = start + index;
      if (slot < OTP_LENGTH) next[slot] = char;
    });
    for (let i = start + incoming.length; i < OTP_LENGTH; i += 1) {
      if (incoming.length >= OTP_LENGTH - start) next[i] = "";
    }
    publish(next);
    const focusAt = Math.min(start + incoming.length, OTP_LENGTH - 1);
    boxes.current[focusAt]?.focus();
  }

  return (
    <fieldset className="otp-boxes" disabled={disabled}>
      <legend className="sr-only">One-time code</legend>
      <input type="hidden" name={name} value={code} />
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
            autoComplete={index === 0 ? "one-time-code" : "off"}
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={index === 0 ? OTP_LENGTH : 1}
            value={digit}
            disabled={disabled}
            autoFocus={autoFocus && index === 0}
            aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
            onChange={(event) => {
              const incoming = onlyDigits(event.target.value);
              if (incoming.length > 1) {
                fillFrom(incoming, index === 0 ? 0 : index);
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
    </fieldset>
  );
}
