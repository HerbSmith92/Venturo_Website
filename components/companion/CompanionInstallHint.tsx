"use client";

import { useEffect, useState } from "react";

export function CompanionInstallHint() {
  const [standalone, setStandalone] = useState(true);
  const [deferred, setDeferred] = useState<{ prompt: () => Promise<void> } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const nav = window.navigator as Navigator & { standalone?: boolean };
    setStandalone(media.matches || Boolean(nav.standalone));
    if (window.sessionStorage.getItem("companion-install-dismissed") === "1") {
      setDismissed(true);
    }

    function onPrompt(event: Event) {
      event.preventDefault();
      const installEvent = event as Event & { prompt: () => Promise<void> };
      setDeferred(installEvent);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (standalone || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    window.sessionStorage.setItem("companion-install-dismissed", "1");
  }

  return (
    <aside className="companion-install">
      <div>
        <p className="eyebrow">Add To Home Screen</p>
        <p>
          {deferred
            ? "Keep the door in your pocket — install Companion like an app."
            : "On iPhone: Share → Add to Home Screen. Then the camera & list stay ready at the venue."}
        </p>
      </div>
      <div className="companion-install-actions">
        {deferred && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void deferred.prompt()}
          >
            Install
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={dismiss}>
          Not Now
        </button>
      </div>
    </aside>
  );
}
