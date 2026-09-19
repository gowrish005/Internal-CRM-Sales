"use client";

import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, Plus, Trash2 } from "lucide-react";

// ---- shared types & constants ----

export interface WaTemplate { id: string; name: string; body: string; image?: string; }

export const WA_TEMPLATES_KEY = "crm.wa.templates";
const WA_LAST_TEMPLATE_KEY = "crm.wa.last_template";

const WA_ATTRS = [
  { key: "name" }, { key: "phone" }, { key: "email" },
  { key: "college" }, { key: "usn" }, { key: "passoutYear" }, { key: "track" },
];

const DEFAULT_TEMPLATES: WaTemplate[] = [
  { id: "intro", name: "Introduction", body: "Hi {name}! 👋 This is HellCraft Tech reaching out. We came across your profile and wanted to connect regarding an exciting opportunity. Are you available for a quick call?" },
  { id: "followup", name: "Follow-up", body: "Hi {name}, following up on our earlier conversation. Would you be interested in learning more about our program? Feel free to reach out anytime! 😊" },
  { id: "callback", name: "Callback Request", body: "Hi {name}! Thanks for your time earlier. When would be a convenient time for us to call you back?" },
];

// ---- helpers ----

function getTemplates(): WaTemplate[] {
  try { return JSON.parse(localStorage.getItem(WA_TEMPLATES_KEY) ?? "null") || DEFAULT_TEMPLATES; } catch { return [...DEFAULT_TEMPLATES]; }
}

function getActiveId(): string {
  try {
    const ts = getTemplates();
    const last = localStorage.getItem(WA_LAST_TEMPLATE_KEY) ?? "";
    return ts.find((t) => t.id === last) ? last : (ts[0]?.id ?? "");
  } catch { return DEFAULT_TEMPLATES[0]?.id ?? ""; }
}

function saveTemplates(ts: WaTemplate[]) {
  try { localStorage.setItem(WA_TEMPLATES_KEY, JSON.stringify(ts)); } catch {}
}

export function resolveTemplate(template: string, lead: any): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const val = lead[key];
    return val != null && val !== "" ? String(val) : `{${key}}`;
  });
}

export function cleanPhone(phone: string): string {
  let p = phone.replace(/\D/g, "");
  if (p.length === 10) p = "91" + p;
  else if (p.startsWith("0")) p = "91" + p.slice(1);
  return p;
}

// ---- direct send (no modal) ----

export function sendWhatsApp(lead: any): void {
  if (!lead.phone) return;
  const ts = getTemplates();
  const t = ts.find((x) => x.id === getActiveId()) ?? ts[0];
  if (!t) return;
  const text = resolveTemplate(t.body, lead);
  const phone = cleanPhone(lead.phone);
  if (t.image) {
    fetch(t.image).then((r) => r.blob()).then((blob) => {
      navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]).catch(() => {});
    }).catch(() => {});
  }
  const encoded = encodeURIComponent(text);
  const url = `whatsapp://send?phone=${phone}&text=${encoded}`;
  // window.open(_blank) gets blocked on mobile; location.href handles both
  window.location.href = url;
}

// ---- Template Manager modal ----

export function WhatsAppTemplateManager({ onClose }: { onClose: () => void }) {
  const [templates, setTemplates] = useState<WaTemplate[]>(getTemplates);
  const [editingId, setEditingId] = useState(getActiveId);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const imgInputRef = useRef<HTMLInputElement>(null);

  const editing = templates.find((t) => t.id === editingId) ?? templates[0];
  const activeId = getActiveId();

  function persist(updated: WaTemplate[]) {
    setTemplates(updated);
    saveTemplates(updated);
  }

  function selectTemplate(id: string) {
    setEditingId(id);
    try { localStorage.setItem(WA_LAST_TEMPLATE_KEY, id); } catch {}
  }

  function updateBody(body: string) {
    persist(templates.map((t) => t.id === editing?.id ? { ...t, body } : t));
  }

  function updateImage(img: string | undefined) {
    persist(templates.map((t) => t.id === editing?.id ? { ...t, image: img } : t));
  }

  function addTemplate() {
    if (!newName.trim()) return;
    const id = Date.now().toString();
    const ts = [...templates, { id, name: newName.trim(), body: "" }];
    persist(ts);
    selectTemplate(id);
    setNewName("");
    setShowNew(false);
  }

  function deleteTemplate(id: string) {
    if (templates.length <= 1) return;
    const updated = templates.filter((t) => t.id !== id);
    persist(updated);
    if (editingId === id) selectTemplate(updated[0].id);
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => updateImage(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function insertAttr(key: string, textareaRef: React.RefObject<HTMLTextAreaElement | null>) {
    const el = textareaRef.current;
    const inserted = `{${key}}`;
    if (!el) { updateBody((editing?.body ?? "") + inserted); return; }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const body = editing?.body ?? "";
    updateBody(body.slice(0, start) + inserted + body.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + inserted.length, start + inserted.length);
    });
  }

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-xl rounded-2xl border shadow-2xl flex flex-col"
        style={{ background: "#111e14", borderColor: "#1e3322", maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: "#1e3322" }}>
          <div className="flex items-center gap-2">
            <MessageCircle size={16} style={{ color: "#25d366" }} />
            <h2 className="text-sm font-semibold" style={{ color: "#e8e8e8" }}>WhatsApp Templates</h2>
          </div>
          <button onClick={onClose} className="flex items-center justify-center w-7 h-7 rounded-lg" style={{ color: "var(--muted-foreground)", background: "rgba(255,255,255,0.05)" }}>×</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Template tabs */}
          <div>
            <div className="text-xs font-medium mb-2" style={{ color: "var(--muted-foreground)" }}>
              Templates — <span style={{ color: "#25d366" }}>selected = active (used when sending)</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {templates.map((t) => {
                const isActive = t.id === editingId;
                return (
                  <div key={t.id} className="flex items-center gap-0.5">
                    <button
                      onClick={() => selectTemplate(t.id)}
                      className="px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{ background: isActive ? "#25d366" : "rgba(37,211,102,0.12)", color: isActive ? "#000" : "#25d366" }}
                    >{t.name}{t.image ? " 🖼" : ""}</button>
                    <button
                      onClick={() => deleteTemplate(t.id)}
                      className="opacity-40 hover:opacity-90 p-0.5 rounded"
                      style={{ color: "var(--muted-foreground)" }}
                      title="Delete"
                      disabled={templates.length <= 1}
                    ><Trash2 size={11} /></button>
                  </div>
                );
              })}
              {showNew ? (
                <div className="flex items-center gap-1">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addTemplate(); if (e.key === "Escape") { setShowNew(false); setNewName(""); } }}
                    placeholder="Template name…"
                    className="rounded-full border px-2.5 py-1 text-xs outline-none"
                    style={{ background: "rgba(255,255,255,0.04)", borderColor: "#1e3322", color: "#e8e8e8", width: 130 }}
                    autoFocus
                  />
                  <button onClick={addTemplate} className="px-2 py-1 rounded-full text-xs font-medium" style={{ background: "#25d366", color: "#000" }}>Add</button>
                  <button onClick={() => { setShowNew(false); setNewName(""); }} className="text-xs px-1" style={{ color: "var(--muted-foreground)" }}>✕</button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNew(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border"
                  style={{ borderColor: "#1e3322", borderStyle: "dashed", color: "var(--muted-foreground)" }}
                ><Plus size={10} /> New</button>
              )}
            </div>
          </div>

          {editing && (
            <>
              {/* Attribute chips */}
              <div>
                <div className="text-xs font-medium mb-2" style={{ color: "var(--muted-foreground)" }}>Insert attribute</div>
                <div className="flex flex-wrap gap-1.5">
                  {WA_ATTRS.map((a) => (
                    <button
                      key={a.key}
                      onClick={() => insertAttr(a.key, textareaRef)}
                      className="px-2 py-0.5 rounded text-xs font-mono"
                      style={{ background: "rgba(255,255,255,0.06)", color: "var(--muted-foreground)", border: "1px solid rgba(255,255,255,0.1)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                    >{`{${a.key}}`}</button>
                  ))}
                </div>
              </div>

              {/* Message body */}
              <div>
                <div className="text-xs font-medium mb-2" style={{ color: "var(--muted-foreground)" }}>Message body</div>
                <textarea
                  ref={textareaRef}
                  value={editing.body}
                  onChange={(e) => updateBody(e.target.value)}
                  rows={6}
                  className="w-full rounded-lg border p-3 text-sm resize-none outline-none"
                  style={{ background: "rgba(255,255,255,0.04)", borderColor: "#1e3322", color: "#e8e8e8", fontFamily: "inherit" }}
                  placeholder="Type your message… use {name}, {phone}, {college}, etc."
                />
              </div>

              {/* Image */}
              <div>
                <div className="text-xs font-medium mb-2" style={{ color: "var(--muted-foreground)" }}>Image (optional)</div>
                {editing.image ? (
                  <div className="relative inline-block">
                    <img src={editing.image} alt="template" className="rounded-lg max-h-36 max-w-full object-contain" style={{ border: "1px solid #1e3322" }} />
                    <button
                      onClick={() => updateImage(undefined)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: "rgba(0,0,0,0.7)", color: "#e8e8e8" }}
                    >×</button>
                  </div>
                ) : (
                  <button
                    onClick={() => imgInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs"
                    style={{ borderColor: "#1e3322", borderStyle: "dashed", color: "var(--muted-foreground)", background: "transparent" }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#25d366")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1e3322")}
                  >+ Attach image</button>
                )}
                <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                {editing.image && (
                  <p className="text-xs mt-1.5" style={{ color: "var(--muted-foreground)" }}>
                    Image copies to clipboard automatically when sending — paste with ⌘V in WhatsApp
                  </p>
                )}
              </div>
            </>
          )}

          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            Changes save automatically. The highlighted template is used when you click the WhatsApp button on any lead.
          </p>
        </div>

        <div className="flex justify-end px-5 py-4 border-t shrink-0" style={{ borderColor: "#1e3322" }}>
          <button onClick={onClose} className="px-4 py-1.5 rounded-md text-sm font-medium" style={{ background: "#25d366", color: "#000" }}>Done</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
