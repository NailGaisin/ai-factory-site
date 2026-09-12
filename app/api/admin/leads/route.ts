import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getAdminSupabase();

  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase не настроен" },
      { status: 500 }
    );
  }

  const { data, error } = await supabase
    .from("leads")
    .select(
      "id,created_at,name,company,contact,niche,status,contact_result,deal_amount,ai_score,ai_temperature,ai_summary,ai_needs,ai_recommended_action,ai_first_reply,lead_source,utm_source,utm_medium,utm_campaign,first_contacted_at,next_action_at,lost_reason,manager_note"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    leads: data ?? [],
  });
}

