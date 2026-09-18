"use client";

import { useEffect, useRef, useState } from "react";
import { createQrDetector } from "@/lib/qr-detect";

export function CompanionScanner({
  active,
  onCode,
}: {
  active: boolean;
  onCode: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onCodeRef = useRef(onCode);
  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);

  onCodeRef.current = onCode;

  useEffect(() => {
    if (!active) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setTorchOn(false);
      setTorchAvailable(false);
      return;
    }

    let cancelled = false;
    const detect = createQrDetector();
    let last = { code: "", at: 0 };

    async function start() {
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }

        const track = stream.getVideoTracks()[0];
        const capabilities = track?.getCapabilities?.() as { torch?: boolean } | undefined;
        setTorchAvailable(Boolean(capabilities?.torch));

        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const value = await detect(videoRef.current);
            if (value) {
              const now = Date.now();
              if (value !== last.code || now - last.at > 2800) {
                last = { code: value, at: now };
                onCodeRef.current(value);
              }
            }
          } catch {
            // keep looping
          }
          if (!cancelled) window.setTimeout(tick, 220);
        };
        void tick();
      } catch {
        setError("Camera permission blocked. Allow the camera, or type the code below.");
      }
    }

    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [active]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      });
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
    }
  }

  if (!active) return null;

  return (
    <div className="companion-camera-wrap">
      <div className="companion-camera">
        <video ref={videoRef} muted playsInline autoPlay />
        <span className="companion-camera-frame" aria-hidden="true" />
        <p className="companion-camera-hint">Line up a phone or a printed ticket</p>
      </div>
      {torchAvailable && (
        <button type="button" className="btn btn-secondary" onClick={() => void toggleTorch()}>
          {torchOn ? "Torch Off" : "Torch On"}
        </button>
      )}
      {error && <p className="companion-flash bad">{error}</p>}
    </div>
  );
}
