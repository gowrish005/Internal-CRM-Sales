// The order of leads as last shown in the leads list (after its filters and
// sorting), so ←/→ on a lead page walks the same sequence. Captured when a lead
// is opened and kept fixed while stepping through, so changing a lead's status
// never reshuffles where "next" goes. Per browser tab (sessionStorage).

const KEY = "crm.leads.order";
const listeners = new Set<() => void>();
let memory: string | null = null;

export function saveLeadOrder(ids: string[]) {
  memory = JSON.stringify(ids);
  try { sessionStorage.setItem(KEY, memory); } catch {}
  listeners.forEach((cb) => cb());
}

export function readLeadOrderRaw() {
  try { return sessionStorage.getItem(KEY) ?? memory; } catch { return memory; }
}

export function subscribeLeadOrder(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function parseLeadOrder(raw: string | null): string[] {
  try { const v = raw ? JSON.parse(raw) : []; return Array.isArray(v) ? v : []; } catch { return []; }
}
