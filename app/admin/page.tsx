import { getAdminSupabase } from "@/lib/supabase";
import CrmDashboard from "./crm-dashboard";

export const dynamic = "force-dynamic";

type Lead = {
  id: string;
  createdAt: string;
  name: string;
  company: string | null;
  contact: string;
  niche: string;
  status: "new" | "in_progress" | "won" | "archived";
  contactResult: string | null;
  dealAmount: number;
  aiScore: number | null;
  aiTemperature: "hot" | "warm" | "cold" | null;
  aiSummary: string | null;
  aiNeeds: string | null;
  aiRecommendedAction: string | null;
  aiFirstReply: string | null;
  leadSource: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  firstContactedAt: string | null;
  nextActionAt: string | null;
  lostReason: string | null;
  managerNote: string | null;
};

function status(value: unknown): Lead["status"] {
  if (
    value === "new" ||
    value === "in_progress" ||
    value === "won" ||
    value === "archived"
  ) {
    return value;
  }

  return "new";
}

async function getLeads(): Promise<{
  leads: Lead[];
  error: string | null;
}> {
  const supabase = getAdminSupabase();

  if (!supabase) {
    return {
      leads: [],
      error: "Supabase не настроен",
    };
  }

  const { data, error } = await supabase
    .from("leads")
    .select(
      "id,created_at,name,company,contact,niche,status,contact_result,deal_amount,ai_score,ai_temperature,ai_summary,ai_needs,ai_recommended_action,ai_first_reply,lead_source,utm_source,utm_medium,utm_campaign,first_contacted_at,next_action_at,lost_reason,manager_note"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return {
      leads: [],
      error: error.message,
    };
  }

  return {
    leads: (data ?? []).map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      name: row.name ?? "",
      company: row.company ?? null,
      contact: row.contact ?? "",
      niche: row.niche ?? "",
      status: status(row.status),
      contactResult: row.contact_result ?? null,
      dealAmount: Number(row.deal_amount ?? 0),
      aiScore:
        row.ai_score == null ? null : Number(row.ai_score),
      aiTemperature:
        row.ai_temperature === "hot" ||
        row.ai_temperature === "warm" ||
        row.ai_temperature === "cold"
          ? row.ai_temperature
          : null,
      aiSummary: row.ai_summary ?? null,
      aiNeeds: row.ai_needs ?? null,
      aiRecommendedAction:
        row.ai_recommended_action ?? null,
      aiFirstReply: row.ai_first_reply ?? null,
      leadSource: row.lead_source ?? "direct",
      utmSource: row.utm_source ?? null,
      utmMedium: row.utm_medium ?? null,
      utmCampaign: row.utm_campaign ?? null,
      firstContactedAt: row.first_contacted_at ?? null,
      nextActionAt: row.next_action_at ?? null,
      lostReason: row.lost_reason ?? null,
      managerNote: row.manager_note ?? null,
    })),
    error: null,
  };
}

export default async function AdminPage() {
  const result = await getLeads();

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        html,body{margin:0;padding:0;background:#070a0f}
        *{box-sizing:border-box}
        body{font-family:Inter,Arial,sans-serif}
        button,input,select{font:inherit}
      ` }} />

      <CrmDashboard
        initialLeads={result.leads}
        initialError={result.error}
      />
    </>
  );
}
