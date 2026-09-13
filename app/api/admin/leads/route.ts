import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function status(value: unknown) {
  return value === "new" ||
    value === "in_progress" ||
    value === "won" ||
    value === "archived"
    ? value
    : "new";
}

function serializeLead(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ""),
    createdAt: String(row.created_at ?? ""),
    name: String(row.name ?? ""),
    company: typeof row.company === "string" ? row.company : null,
    contact: String(row.contact ?? ""),
    niche: String(row.niche ?? ""),
    status: status(row.status),
    contactResult:
      typeof row.contact_result === "string" ? row.contact_result : null,
    dealAmount: Number(row.deal_amount ?? 0),
    aiScore: row.ai_score == null ? null : Number(row.ai_score),
    aiTemperature:
      row.ai_temperature === "hot" ||
      row.ai_temperature === "warm" ||
      row.ai_temperature === "cold"
        ? row.ai_temperature
        : null,
    aiSummary: typeof row.ai_summary === "string" ? row.ai_summary : null,
    aiNeeds: typeof row.ai_needs === "string" ? row.ai_needs : null,
    aiRecommendedAction:
      typeof row.ai_recommended_action === "string"
        ? row.ai_recommended_action
        : null,
    aiFirstReply:
      typeof row.ai_first_reply === "string" ? row.ai_first_reply : null,
    leadSource:
      typeof row.lead_source === "string" ? row.lead_source : "direct",
    utmSource: typeof row.utm_source === "string" ? row.utm_source : null,
    utmMedium: typeof row.utm_medium === "string" ? row.utm_medium : null,
    utmCampaign:
      typeof row.utm_campaign === "string" ? row.utm_campaign : null,
    firstContactedAt:
      typeof row.first_contacted_at === "string"
        ? row.first_contacted_at
        : null,
    nextActionAt:
      typeof row.next_action_at === "string" ? row.next_action_at : null,
    lostReason:
      typeof row.lost_reason === "string" ? row.lost_reason : null,
    managerNote:
      typeof row.manager_note === "string" ? row.manager_note : null,
  };
}

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

  return NextResponse.json(
    {
      ok: true,
      leads: (data ?? []).map((row) =>
        serializeLead(row as Record<string, unknown>)
      ),
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}

