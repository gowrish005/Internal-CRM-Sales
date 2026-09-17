// One-off: the CONTACTED lead status was removed from the calling pipeline
// (NEW HOT CALLBACK NO_REPLY WON LOST). Move every Lead currently sitting on
// CONTACTED to NO_REPLY.
//
// Uses the MongoDB driver directly: once the schema changes, Prisma can no
// longer read the removed enum value. Idempotent — leads not on CONTACTED
// are left alone. Dry run by default:
//   node scripts/migrate-contacted-to-no-reply.mjs          # show plan
//   APPLY=1 node scripts/migrate-contacted-to-no-reply.mjs  # write
import { MongoClient } from "mongodb";

process.loadEnvFile(".env");
const APPLY = process.env.APPLY === "1";

const client = new MongoClient(process.env.DATABASE_URL);
await client.connect();
const db = client.db();

const toMigrate = await db.collection("Lead").countDocuments({ status: "CONTACTED" });
console.log(`${toMigrate} lead(s) on CONTACTED -> NO_REPLY`);

if (APPLY && toMigrate) {
  const r = await db.collection("Lead").updateMany({ status: "CONTACTED" }, { $set: { status: "NO_REPLY" } });
  console.log(`set NO_REPLY: ${r.modifiedCount}`);
  const final = await db.collection("Lead").aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }, { $sort: { _id: 1 } }]).toArray();
  console.log("now:", final.map((g) => `${g._id} ${g.n}`).join(" · "));
}
await client.close();
