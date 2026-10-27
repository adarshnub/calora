"use client";
import { useEffect } from "react";
import { APPEARANCE_KEY, applyAppearance } from "@/lib/shared/appearance";
export function AppearanceController() {
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      try {
        const saved = localStorage.getItem(APPEARANCE_KEY);
        if (saved === "light" || saved === "dark" || saved === "system")
          applyAppearance(saved);
      } catch {}
    };
    update();
    media.addEventListener("change", update);
    const storage = (e: StorageEvent) => {
      if (e.key === APPEARANCE_KEY) update();
    };
    window.addEventListener("storage", storage);
    return () => {
      media.removeEventListener("change", update);
      window.removeEventListener("storage", storage);
    };
  }, []);
  return null;
}
