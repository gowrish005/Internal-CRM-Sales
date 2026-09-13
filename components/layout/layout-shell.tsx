"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { PageTransition } from "./page-transition";
import { FCMProvider } from "@/components/notifications/fcm-provider";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { NotificationPrompt } from "@/components/notifications/notification-prompt";

interface LayoutShellProps {
  user: { name?: string | null; email?: string | null; image?: string | null; role?: string };
  children: React.ReactNode;
}

export function LayoutShell({ user, children }: LayoutShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)" }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        user={user}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Topbar
          notificationBell={<NotificationBell />}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <NotificationPrompt />
        <main
          className="flex-1 overflow-y-auto p-4 md:p-6"
          style={{ background: "var(--background)" }}
        >
          <PageTransition>{children}</PageTransition>
        </main>
      </div>

      <FCMProvider />
    </div>
  );
}
