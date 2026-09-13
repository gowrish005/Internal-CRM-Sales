"use client";

import { useState, useEffect } from "react";
import { Search, X, Menu } from "lucide-react";
import { useRouter } from "next/navigation";

interface TopbarProps {
  title?: string;
  notificationBell?: React.ReactNode;
  onMenuClick?: () => void;
}

export function Topbar({ title, notificationBell, onMenuClick }: TopbarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if (e.key === "Escape") setSearchOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header
        className="flex items-center h-13 px-5 shrink-0 gap-3"
        style={{
          borderBottom: "1px solid #1a2e1e",
          background: "var(--sidebar-bg)",
          height: "52px",
        }}
      >
        {/* Hamburger — mobile only */}
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="flex md:hidden items-center justify-center w-8 h-8 rounded-lg mr-1 transition-colors"
            style={{ background: "#0f1a12", border: "1px solid #1e3322", color: "var(--muted-foreground)" }}
          >
            <Menu size={15} />
          </button>
        )}

        {title && (
          <h1 className="text-sm font-semibold flex-1 tracking-tight" style={{ color: "var(--foreground)" }}>
            {title}
          </h1>
        )}
        {!title && <div className="flex-1" />}

        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-colors"
          style={{
            borderColor: "#1e3322",
            color: "var(--muted-foreground)",
            background: "#0f1a12",
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = "#2a4a2e")}
          onMouseLeave={e => (e.currentTarget.style.borderColor = "#1e3322")}
        >
          <Search size={12} />
          <span className="hidden sm:inline">Search...</span>
          <kbd
            className="hidden sm:inline text-xs px-1 py-0.5 rounded border ml-1"
            style={{ borderColor: "#1e3322", background: "#162419", fontSize: "10px", color: "var(--muted-foreground)" }}
          >
            ⌘K
          </kbd>
        </button>

        {notificationBell}

      </header>

      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-20"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border shadow-2xl overflow-hidden"
            style={{ background: "#111e14", borderColor: "#1e3322" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center px-4 border-b" style={{ borderColor: "#1e3322" }}>
              <Search size={14} style={{ color: "var(--muted-foreground)" }} />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search contacts, leads, tasks..."
                className="flex-1 px-3 py-3.5 text-sm outline-none bg-transparent"
                style={{ color: "var(--foreground)" }}
              />
              <button onClick={() => setSearchOpen(false)}>
                <X size={14} style={{ color: "var(--muted-foreground)" }} />
              </button>
            </div>
            <div className="p-2 min-h-[100px] flex items-center justify-center">
              {query.length < 2 ? (
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  Type at least 2 characters to search
                </p>
              ) : (
                <SearchResults query={query} onSelect={() => setSearchOpen(false)} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SearchResults({ query, onSelect }: { query: string; onSelect: () => void }) {
  const [results, setResults] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data);
      } catch {
        setResults(null);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  if (!results) {
    return <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Searching...</p>;
  }

  const hasResults =
    results.contacts?.length ||
    results.leads?.length ||
    results.tasks?.length;

  if (!hasResults) {
    return <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>No results for "{query}"</p>;
  }

  return (
    <div className="w-full space-y-1 max-h-72 overflow-y-auto">
      {results.contacts?.length > 0 && (
        <Group
          label="Contacts"
          items={results.contacts.map((c: any) => ({
            label: `${c.firstName} ${c.lastName}`,
            sub: c.designation || c.email || "",
            href: `/crm/contacts/${c.id}`,
          }))}
          router={router}
          onSelect={onSelect}
        />
      )}
      {results.leads?.length > 0 && (
        <Group
          label="Leads"
          items={results.leads.map((l: any) => ({
            label: l.name,
            sub: l.status,
            href: `/crm/leads`,
          }))}
          router={router}
          onSelect={onSelect}
        />
      )}
      {results.tasks?.length > 0 && (
        <Group
          label="Tasks"
          items={results.tasks.map((t: any) => ({
            label: t.title,
            sub: t.status,
            href: `/tasks`,
          }))}
          router={router}
          onSelect={onSelect}
        />
      )}
    </div>
  );
}

function Group({ label, items, router, onSelect }: any) {
  return (
    <div>
      <p
        className="px-3 py-1 text-xs font-semibold uppercase tracking-widest"
        style={{ color: "var(--muted-foreground)", fontSize: "10px" }}
      >
        {label}
      </p>
      {items.map((item: any, i: number) => (
        <button
          key={i}
          className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-left transition-colors"
          style={{ color: "var(--foreground)" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#1a2e1c")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          onClick={() => {
            router.push(item.href);
            onSelect();
          }}
        >
          <span className="text-sm">{item.label}</span>
          {item.sub && (
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{item.sub}</span>
          )}
        </button>
      ))}
    </div>
  );
}
