"use client";

import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { requestNotificationPermissionAndGetToken } from "@/lib/firebase-client";
import { saveFcmToken } from "@/lib/actions/notifications";

export function NotificationPrompt() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      // Small delay so the page loads first, not immediately on mount
      const t = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(t);
    }
  }, []);

  if (!show) return null;

  async function handleEnable() {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        // Try to get FCM token if Firebase is configured
        try {
          const token = await requestNotificationPermissionAndGetToken();
          if (token) await saveFcmToken(token);
        } catch {
          // FCM not configured — native permission still granted, in-app notifications work
        }
      }
    } finally {
      setShow(false);
      setLoading(false);
    }
  }

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 shrink-0"
      style={{
        background: "rgba(34,197,94,0.06)",
        borderBottom: "1px solid rgba(34,197,94,0.12)",
      }}
    >
      <div
        className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0"
        style={{ background: "rgba(34,197,94,0.12)" }}
      >
        <Bell size={13} style={{ color: "#22c55e" }} />
      </div>
      <p className="flex-1 text-xs" style={{ color: "rgba(220,220,220,0.7)" }}>
        Enable notifications to get alerts when tasks are assigned to you.
      </p>
      <button
        onClick={handleEnable}
        disabled={loading}
        className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
        style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80" }}
      >
        {loading ? "Enabling…" : "Enable"}
      </button>
      <button
        onClick={() => setShow(false)}
        className="shrink-0"
        style={{ color: "rgba(150,150,150,0.5)" }}
      >
        <X size={13} />
      </button>
    </div>
  );
}
