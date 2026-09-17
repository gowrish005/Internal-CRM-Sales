// One-off: convert Lead.status from the old B2B pipeline
// (NEW CONTACTED QUALIFIED PROPOSAL NEGOTIATION WON LOST) to the calling
// pipeline (NEW CONTACTED HOT CALLBACK NO_REPLY WON LOST).
//
// Uses the MongoDB driver directly: once the schema changes, Prisma can no
// longer read the old enum values. Idempotent — leads already on a new value
// are left alone. Dry run by default:
//   node scripts/migrate-lead-statuses.mjs          # show plan
//   APPLY=1 node scripts/migrate-lead-statuses.mjs  # write
import { MongoClient } from "mongodb";

process.loadEnvFile(".env");
const APPLY = process.env.APPLY === "1";
const OLD = new Set(["QUALIFIED", "PROPOSAL", "NEGOTIATION"]);
const NEW = new Set(["NEW", "CONTACTED", "HOT", "CALLBACK", "NO_REPLY", "WON", "LOST"]);

const NO_REPLY_RE = /pick|respond|switch|incoming|incming|no answer|not reachable/;
const CALLBACK_RE = /call ?back|call later|tomorrow/;

/** Decide from the stored status plus the latest recorded call outcome (if any). */
function mapStatus(status, callNote) {
  const note = (callNote || "").toLowerCase();
  switch (status) {
    case "QUALIFIED": case "PROPOSAL": case "NEGOTIATION": return "HOT";
    case "WON": case "LOST": return status;
    case "NEW":
      if (NO_REPLY_RE.test(note)) return "NO_REPLY";
      if (CALLBACK_RE.test(note)) return "CALLBACK";
      return "NEW";
    case "CONTACTED":
      // Moved to CONTACTED in the app after a "no reply" note: the app edit wins.
      if (CALLBACK_RE.test(note)) return "CALLBACK";
      return "CONTACTED";
  }
  return null;
}

const client = new MongoClient(process.env.DATABASE_URL);
await client.connect();
const db = client.db();
const leads = await db.collection("Lead").find({}, { projection: { name: 1, status: 1 } }).toArray();
const notes = await db.collection("Note").find({ leadId: { $ne: null } }, { projection: { leadId: 1, content: 1, createdAt: 1 } }).sort({ createdAt: 1 }).toArray();
const latestCall = new Map();
for (const n of notes) {
  const m = n.content.match(/Call status: (.*)/);
  if (m) latestCall.set(String(n.leadId), m[1].trim());
}

const plan = new Map(); // "FROM -> TO | note" -> ids
const unknown = [];
for (const l of leads) {
  if (NEW.has(l.status) && !OLD.has(l.status) && !["NEW", "CONTACTED"].includes(l.status)) continue; // already migrated
  const to = mapStatus(l.status, latestCall.get(String(l._id)));
  if (!to) { unknown.push(`${l.name}: ${l.status}`); continue; }
  const key = `${l.status.padEnd(11)} -> ${to.padEnd(9)} | ${(latestCall.get(String(l._id)) || "(no call note)").toLowerCase()}`;
  if (!plan.has(key)) plan.set(key, []);
  plan.get(key).push(l._id);
}
let changing = 0;
for (const [k, ids] of [...plan].sort()) {
  const [from, to] = k.split("|")[0].split("->").map((s) => s.trim());
  if (from !== to) changing += ids.length;
  console.log(String(ids.length).padStart(4), k, from === to ? "" : "  *");
}
console.log(`\n${leads.length} leads; ${changing} change status (*)`);
if (unknown.length) { console.log("UNMAPPED:", unknown); process.exitCode = 1; }

if (APPLY && !unknown.length) {
  const byTarget = new Map();
  for (const [k, ids] of plan) {
    const [from, to] = k.split("|")[0].split("->").map((s) => s.trim());
    if (from === to) continue;
    byTarget.set(to, [...(byTarget.get(to) || []), ...ids]);
  }
  for (const [to, ids] of byTarget) {
    const r = await db.collection("Lead").updateMany({ _id: { $in: ids } }, { $set: { status: to } });
    console.log(`set ${to}: ${r.modifiedCount}`);
  }
  const final = await db.collection("Lead").aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }, { $sort: { _id: 1 } }]).toArray();
  console.log("now:", final.map((g) => `${g._id} ${g.n}`).join(" · "));
}
await client.close();
