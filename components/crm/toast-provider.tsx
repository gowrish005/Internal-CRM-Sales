"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";

type Toast = { id: number; message: string; kind: "success" | "error" };
type Notify = (message: string, kind?: Toast["kind"]) => void;

const ToastContext = createContext<Notify>(() => {});

/** App-wide toasts. Mounted in LayoutShell, above the per-page transition, so a toast survives navigation. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const notify = useCallback<Notify>((message, kind = "success") => {
    const id = ++nextId.current;
    setToasts((t) => [...t.slice(-3), { id, message, kind }]); // at most 4 on screen
    setTimeout(() => dismiss(id), kind === "error" ? 6000 : 2500);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      {typeof document !== "undefined" && toasts.length > 0 && createPortal(
        <div className="fixed bottom-4 right-4 z-[300] flex flex-col items-end gap-2" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs shadow-lg max-w-xs"
              style={{
                background: "#111e14",
                borderColor: t.kind === "error" ? "rgba(220,38,38,0.5)" : "rgba(34,197,94,0.35)",
                color: t.kind === "error" ? "#fca5a5" : "#bbf7d0",
                animation: "toast-in 160ms ease-out",
              }}
            >
              {t.kind === "error" ? <X size={13} /> : <Check size={13} />}
              <span className="flex-1">{t.message}</span>
              <button onClick={() => dismiss(t.id)} className="opacity-60 hover:opacity-100" aria-label="Dismiss"><X size={11} /></button>
            </div>
          ))}
          <style>{`@keyframes toast-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
