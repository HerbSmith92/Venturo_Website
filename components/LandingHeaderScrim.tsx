"use client";

import { useEffect } from "react";

/** Keeps the landing nav readable on the hero, then solid once the directory scrolls up. */
export function LandingHeaderScrim() {
  useEffect(() => {
    const chrome = document.querySelector(".chrome");
    if (!(chrome instanceof HTMLElement)) return;

    const onScroll = () => {
      chrome.classList.toggle("chrome-solid", window.scrollY > 12);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      chrome.classList.remove("chrome-solid");
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return null;
}
