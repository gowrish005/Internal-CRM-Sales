import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { applyLeadUpdate, LeadUpdateError } from "@/lib/lead-service";

// Autosave endpoint for the lead page. A plain request (sent with
// `keepalive`) instead of a Server Action: actions are dispatched through the
// client router, so one fired right before navigating to the next lead can
// lose its response. This completes regardless of navigation or tab close.
export async function PATCH(req: Request, ctx: RouteContext<"/api/leads/[id]">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  try {
    const lead = await applyLeadUpdate(user, id, body);
    return NextResponse.json({ id: lead.id, name: lead.name, status: lead.status });
  } catch (err) {
    if (err instanceof LeadUpdateError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[PATCH /api/leads/:id]", err);
    return NextResponse.json({ error: "Failed to save lead" }, { status: 500 });
  }
}
