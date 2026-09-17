// Single source of truth for lead statuses — used by validation, server
// actions and the leads UI. Must match `enum LeadStatus` in prisma/schema.prisma.
// (B2B contacts have their own, separate `ContactStatus` pipeline.)

export const LEAD_STATUSES = ["NEW", "CONTACTED", "HOT", "CALLBACK", "NO_REPLY", "WON", "LOST"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "NEW",
  CONTACTED: "CONTACTED",
  HOT: "HOT",
  CALLBACK: "CALLBACK",
  NO_REPLY: "NO REPLY",
  WON: "WON",
  LOST: "LOST",
};

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  NEW: "#6b7280",       // not called yet
  CONTACTED: "#3b82f6", // reached, decision pending
  HOT: "#f97316",       // interested
  CALLBACK: "#8b5cf6",  // asked to be called back
  NO_REPLY: "#eab308",  // tried, not reached — retry
  WON: "#059669",
  LOST: "#dc2626",
};

export const isLeadStatus = (s: unknown): s is LeadStatus => LEAD_STATUSES.includes(s as LeadStatus);
