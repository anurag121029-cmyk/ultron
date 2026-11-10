"use client";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

// Install prompt for Android/Chrome (beforeinstallprompt) + manual
// "Add to Home Screen" instructions for iPhone/Safari, which has no prompt.
// Also shows an offline note — the shell opens offline, but chat/image/vision need internet.
export default function InstallApp() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [offline, setOffline] = useState(false);
  const [installResult, setInstallResult] = useState("");

  useEffect(() => {
    setInstalled(isStandalone());
    setOffline(!window.navigator.onLine);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      setInstallResult("ULTRON is installed — look for it on your home screen.");
    };
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  async function install() {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        setInstallResult("Installing ULTRON… look for it on your home screen.");
      } else {
        setInstallResult("Install dismissed — you can install later from this button.");
      }
      setDeferred(null);
    } catch {
      setInstallResult("Install didn't start — try your browser menu → Add to Home Screen.");
    }
  }

  if (installed && !offline) return null;

  return (
    <div className="install-wrap" aria-live="polite">
      {offline && (
        <p className="offline-banner" role="status">
          You&apos;re offline — ULTRON&apos;s saved shell is available, but chat, images and vision need internet.
        </p>
      )}
      {!installed && deferred && (
        <button className="btn primary install-btn" onClick={install}>
          📲 Install ULTRON app
        </button>
      )}
      {!installed && !deferred && isIOS() && (
        <div className="install-ios">
          <button className="btn install-btn" onClick={() => setShowIosHelp((s) => !s)}>
            📲 Get the ULTRON app
          </button>
          {showIosHelp && (
            <p className="muted install-steps">
              On iPhone: tap <strong>Share</strong> (the square with an arrow) in Safari, then tap{" "}
              <strong>Add to Home Screen</strong> → <strong>Add</strong>. ULTRON will then open like a real app.
            </p>
          )}
        </div>
      )}
      {!installed && !deferred && !isIOS() && (
        <p className="muted install-hint">
          Tip: in Chrome on Android, tap the browser menu → <strong>Add to Home Screen</strong> to install ULTRON as an app.
        </p>
      )}
      {installResult && <p className="muted" role="status">{installResult}</p>}
    </div>
  );
}
