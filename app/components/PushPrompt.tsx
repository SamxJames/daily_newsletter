"use client";

import { useEffect, useState } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const DISMISSED_KEY = "push-prompt-dismissed";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type PromptState = "hidden" | "visible" | "busy";

/**
 * Registers the service worker on every load (needed regardless of
 * notification permission), and — if permission hasn't been decided yet —
 * shows a small in-page prompt before triggering the native browser dialog.
 * iOS requires the native prompt to follow a user gesture, so this can't
 * fire automatically on load.
 */
export default function PushPrompt() {
  const [state, setState] = useState<PromptState>("hidden");

  useEffect(() => {
    if (!VAPID_PUBLIC_KEY) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });

    if (Notification.permission !== "default") return;
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return;
    } catch {
      // Private browsing — fall through and show the prompt anyway.
    }

    setState("visible");
  }, []);

  async function enable() {
    if (!VAPID_PUBLIC_KEY) return;
    setState("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("hidden");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });

      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });

      if (!response.ok) throw new Error(`/api/subscribe returned ${response.status}`);
      setState("hidden");
    } catch (error) {
      console.error("Push subscription failed:", error);
      setState("visible");
    }
  }

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Private browsing — the prompt will just reappear next visit, harmless.
    }
    setState("hidden");
  }

  if (state === "hidden") return null;

  return (
    <div className="push-prompt" role="note">
      <span className="push-prompt-text">Get a ping when the next brief is ready.</span>
      <div className="push-prompt-actions">
        <button type="button" onClick={enable} disabled={state === "busy"}>
          {state === "busy" ? "Enabling…" : "Enable"}
        </button>
        <button type="button" onClick={dismiss} className="push-prompt-dismiss">
          Not now
        </button>
      </div>
    </div>
  );
}
