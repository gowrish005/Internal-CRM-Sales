"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, CheckCheck, X } from "lucide-react";
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "@/lib/actions/notifications";

type Notification = {
  id: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  createdAt: Date;
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unread = notifications.filter((n) => !n.isRead).length;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getNotifications();
      setNotifications(data as Notification[]);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Refresh when FCM foreground message arrives
    const handler = () => load();
    window.addEventListener("fcm-message", handler);
    // Poll every 60s as fallback
    const interval = setInterval(load, 60_000);
    return () => {
      window.removeEventListener("fcm-message", handler);
      clearInterval(interval);
    };
  }, [load]);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  async function handleMarkRead(id: string) {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    await markNotificationRead(id);
  }

  async function handleMarkAll() {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    await markAllNotificationsRead();
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen((v) => !v); if (!open) load(); }}
        className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors relative"
        style={{ background: "#0f1a12", border: "1px solid #1e3322", color: "var(--muted-foreground)" }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = "#2a4a2e")}
        onMouseLeave={e => (e.currentTarget.style.borderColor = "#1e3322")}
        title="Notifications"
      >
        <Bell size={14} />
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 flex items-center justify-center rounded-full font-bold"
            style={{
              width: 16, height: 16, fontSize: 9,
              background: "#22c55e", color: "#071209",
              boxShadow: "0 0 6px rgba(34,197,94,0.6)",
            }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 rounded-xl border shadow-2xl overflow-hidden z-50"
          style={{
            width: 340, top: "100%",
            background: "#111e14", borderColor: "#1e3322",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#1e3322" }}>
            <span className="text-sm font-semibold" style={{ color: "#e8e8e8" }}>
              Notifications {unread > 0 && <span style={{ color: "#22c55e" }}>({unread})</span>}
            </span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={handleMarkAll}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors"
                  style={{ color: "#22c55e", background: "rgba(34,197,94,0.08)" }}
                  title="Mark all read"
                >
                  <CheckCheck size={12} /> All read
                </button>
              )}
              <button onClick={() => setOpen(false)} style={{ color: "var(--muted-foreground)" }}>
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto" style={{ maxHeight: 380 }}>
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-xs" style={{ color: "var(--muted-foreground)" }}>
                Loading…
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Bell size={24} style={{ color: "rgba(34,197,94,0.2)" }} />
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleMarkRead(n.id)}
                  className="w-full text-left px-4 py-3 border-b flex items-start gap-3 transition-colors"
                  style={{
                    borderColor: "#1a2e1e",
                    background: n.isRead ? "transparent" : "rgba(34,197,94,0.04)",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(34,197,94,0.07)")}
                  onMouseLeave={e => (e.currentTarget.style.background = n.isRead ? "transparent" : "rgba(34,197,94,0.04)")}
                >
                  {/* Unread dot */}
                  <div className="mt-1.5 shrink-0">
                    {!n.isRead
                      ? <div className="w-2 h-2 rounded-full" style={{ background: "#22c55e", boxShadow: "0 0 4px #22c55e" }} />
                      : <div className="w-2 h-2 rounded-full" style={{ background: "rgba(34,197,94,0.2)" }} />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: "#e8e8e8" }}>{n.title}</p>
                    <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--muted-foreground)" }}>{n.body}</p>
                    <p className="text-xs mt-1" style={{ color: "rgba(34,197,94,0.4)", fontSize: 10 }}>
                      {formatRelative(new Date(n.createdAt))}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return date.toLocaleDateString();
}
