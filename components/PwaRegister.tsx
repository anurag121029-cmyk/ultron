"use client";
import { useEffect } from "react";

// Registers the service worker in production only, so `npm run dev` is
// never served a stale cached shell. Failures are silent — the app still
// works as a normal website without the service worker.
export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;
    navigator.serviceWorker
      .register("/sw.js")
      .catch(() => {
        // Registration failed (e.g. not HTTPS) — app continues without offline support.
        if (!cancelled) {
          navigator.serviceWorker.getRegistrations().catch(() => {});
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
