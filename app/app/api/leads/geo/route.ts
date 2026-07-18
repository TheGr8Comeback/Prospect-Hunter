import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getApiSession } from "@/lib/auth";


export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const WORKSPACE_ID = session.workspaceId;

  const { data, error } = await supabaseAdmin()
    .from("leads")
    .select("slug,name,category,city,lat,lng,warm_score,has_website,email,status")
    .eq("workspace_id", WORKSPACE_ID)
    .not("lat", "is", null)
    .not("lng", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const geojson = {
    type: "FeatureCollection" as const,
    features: (data ?? []).map((lead) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [Number(lead.lng), Number(lead.lat)],
      },
      properties: {
        slug: lead.slug,
        name: lead.name,
        category: lead.category,
        city: lead.city,
        warm_score: lead.warm_score ?? 0,
        has_website: lead.has_website,
        email: lead.email,
        status: lead.status,
      },
    })),
  };

  return NextResponse.json(geojson);
}
