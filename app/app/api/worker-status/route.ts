import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getApiSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabaseAdmin()
    .from("worker_heartbeats")
    .select("last_ping")
    .eq("workspace_id", session.workspaceId)
    .eq("worker_name", "main")
    .single();

  if (!data) {
    return NextResponse.json({ online: false, lastPing: null });
  }

  const lastPing = new Date(data.last_ping).getTime();
  const ago = Date.now() - lastPing;
  const online = ago < 15 * 60 * 1000; // 15 min threshold

  return NextResponse.json({ online, lastPing: data.last_ping, agoMs: ago });
}
