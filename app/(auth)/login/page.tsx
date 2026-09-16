"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password.");
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--background)" }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4"
            style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)" }}
          >
            <Zap size={20} className="text-white" fill="white" />
          </div>
          <h1 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>GAPSO CRM</h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>Sign in to your account</p>
        </div>

        <div
          className="rounded-2xl border p-6"
          style={{ background: "var(--card)", borderColor: "#1e3322" }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>
                Email
              </label>
              <input
                type="email"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@gapso.in"
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors"
                style={{
                  borderColor: "#1e3322",
                  background: "#0d1a11",
                  color: "var(--foreground)",
                }}
                onFocus={e => (e.currentTarget.style.borderColor = "#22c55e")}
                onBlur={e => (e.currentTarget.style.borderColor = "#1e3322")}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors"
                style={{
                  borderColor: "#1e3322",
                  background: "#0d1a11",
                  color: "var(--foreground)",
                }}
                onFocus={e => (e.currentTarget.style.borderColor = "#22c55e")}
                onBlur={e => (e.currentTarget.style.borderColor = "#1e3322")}
              />
            </div>

            {error && (
              <p className="text-xs rounded-lg px-3 py-2" style={{ color: "#ef4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-all disabled:opacity-60 btn-primary-glow"
              style={{
                background: "#22c55e",
                color: "#071209",
              }}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: "var(--sidebar-section)" }}>
          Internal access only. Contact your admin for access.
        </p>
      </div>
    </div>
  );
}
