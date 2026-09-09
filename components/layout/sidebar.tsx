"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  GitBranch,
  TrendingUp,
  Calendar,
  CheckSquare,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Zap,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";

const nav = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  {
    label: "CRM",
    children: [
      { href: "/crm/contacts", icon: Users, label: "Contacts" },
      { href: "/crm/branches", icon: GitBranch, label: "Branches" },
      { href: "/crm/leads", icon: TrendingUp, label: "Leads" },
    ],
  },
  { href: "/calendar", icon: Calendar, label: "Calendar" },
  { href: "/tasks", icon: CheckSquare, label: "Tasks" },
  { href: "/activity", icon: Activity, label: "Activity" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

interface SidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string;
  };
}

export function Sidebar({ user }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside
      className="flex flex-col h-full shrink-0 transition-all duration-200"
      style={{
        width: collapsed ? "var(--sidebar-width-collapsed)" : "var(--sidebar-width)",
        background: "var(--sidebar-bg)",
        borderRight: "1px solid rgba(34,197,94,0.08)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-4 shrink-0 gap-3">
        <div
          className="flex items-center justify-center w-8 h-8 rounded-xl shrink-0"
          style={{
            background: "linear-gradient(135deg, #15803d, #22c55e)",
            boxShadow: "0 0 12px rgba(34,197,94,0.3)",
          }}
        >
          <Zap size={17} className="text-white" fill="white" />
        </div>
        {!collapsed && (
          <span className="font-bold text-sm tracking-tight truncate" style={{ color: "#ebebeb", letterSpacing: "-0.01em" }}>
            HellCraft
          </span>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: "1px", background: "rgba(34,197,94,0.07)", marginBottom: "8px" }} />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-0.5">
        {nav.map((item) => {
          if ("children" in item) {
            return (
              <div key={item.label} className="pt-4">
                {!collapsed && (
                  <p
                    className="px-2 pb-2 font-semibold uppercase tracking-[0.1em]"
                    style={{ color: "rgba(34,197,94,0.35)", fontSize: "9px" }}
                  >
                    {item.label}
                  </p>
                )}
                {collapsed && <div className="my-3" style={{ height: "1px", background: "rgba(34,197,94,0.07)" }} />}
                {item.children!.map((child) => (
                  <NavLink
                    key={child.href}
                    href={child.href}
                    icon={child.icon}
                    label={child.label}
                    active={isActive(child.href)}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            );
          }
          return (
            <NavLink
              key={item.href}
              href={item.href!}
              icon={item.icon!}
              label={item.label}
              active={isActive(item.href!)}
              collapsed={collapsed}
            />
          );
        })}
      </nav>

      {/* Bottom */}
      <div style={{ borderTop: "1px solid rgba(34,197,94,0.08)" }}>
        {/* User */}
        <div className="px-3 pt-3 pb-1">
          <div
            className="flex items-center gap-2.5 px-2 py-2 rounded-xl"
            style={{ background: "rgba(34,197,94,0.05)" }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{
                background: "linear-gradient(135deg, #15803d, #22c55e)",
                color: "#fff",
                fontSize: "10px",
              }}
            >
              {user.name ? getInitials(user.name) : "?"}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: "#e8e8e8" }}>{user.name}</p>
                <p className="truncate font-medium" style={{ color: "rgba(34,197,94,0.45)", fontSize: "10px", letterSpacing: "0.05em" }}>
                  {user.role}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="px-3 pb-3 space-y-0.5">
          <BottomButton
            icon={<LogOut size={15} />}
            label="Sign out"
            collapsed={collapsed}
            onClick={() => signOut({ callbackUrl: "/login" })}
          />
          <BottomButton
            icon={collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
            label="Collapse"
            collapsed={collapsed}
            onClick={() => setCollapsed(!collapsed)}
          />
        </div>
      </div>
    </aside>
  );
}

function NavLink({
  href,
  icon: Icon,
  label,
  active,
  collapsed,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn("group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-all duration-150")}
      style={
        active
          ? {
              background: "rgba(34,197,94,0.1)",
              color: "#4ade80",
            }
          : {
              color: "rgba(180,180,180,0.5)",
            }
      }
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = "rgba(34,197,94,0.06)";
          (e.currentTarget as HTMLElement).style.color = "rgba(220,220,220,0.8)";
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = "transparent";
          (e.currentTarget as HTMLElement).style.color = "rgba(180,180,180,0.5)";
        }
      }}
      title={collapsed ? label : undefined}
    >
      {/* Active left indicator */}
      {active && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-full"
          style={{ height: "60%", background: "#22c55e", boxShadow: "0 0 6px #22c55e" }}
        />
      )}

      <Icon
        size={17}
        className="shrink-0"
        style={{ color: active ? "#22c55e" : "inherit" }}
      />
      {!collapsed && (
        <span className="truncate font-medium" style={{ fontSize: "13px" }}>{label}</span>
      )}
    </Link>
  );
}

function BottomButton({
  icon,
  label,
  collapsed,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center w-full rounded-xl px-2.5 py-1.5 text-sm transition-all"
      style={{ color: "rgba(160,160,160,0.45)" }}
      onMouseEnter={e => {
        (e.currentTarget.style.color = "rgba(210,210,210,0.8)");
        (e.currentTarget.style.background = "rgba(34,197,94,0.06)");
      }}
      onMouseLeave={e => {
        (e.currentTarget.style.color = "rgba(160,160,160,0.45)");
        (e.currentTarget.style.background = "transparent");
      }}
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed && <span className="ml-2" style={{ fontSize: "13px" }}>{label}</span>}
    </button>
  );
}
