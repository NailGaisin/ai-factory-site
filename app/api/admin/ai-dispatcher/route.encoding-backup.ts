import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getAdminSupabase();

    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase admin configuration is missing" },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const leads = (data ?? []).map((lead: any) => {
      const score =
        typeof lead.ai_score === "number"
          ? lead.ai_score
          : 0;

      const amount =
        typeof lead.deal_amount === "number"
          ? lead.deal_amount
          : Number(lead.deal_amount ?? 0);

      let priority = "cold";
      let reason = "Низкий приоритет";

      if (score >= 80) {
        priority = "hot";
        reason = "Высокий AI Score";
      } else if (amount > 0 && score >= 60) {
        priority = "money";
        reason = "Есть потенциальная сумма сделки";
      } else if (
        lead.contact_result === "contacted" ||
        lead.contact_result === "thinking"
      ) {
        priority = "followup";
        reason = "Нужен следующий контакт";
      } else if (lead.status === "new") {
        priority = "urgent";
        reason = "Новая необработанная заявка";
      } else if (score >= 50) {
        priority = "warm";
        reason = "Средний приоритет";
      }

      return {
        id: lead.id,
        name: lead.name,
        company: lead.company,
        contact: lead.contact,
        niche: lead.niche,
        status: lead.status,
        contactResult: lead.contact_result,
        dealAmount: amount,
        aiScore: score,
        aiTemperature: lead.ai_temperature,
        aiSummary: lead.ai_summary,
        aiNeeds: lead.ai_needs,
        aiRecommendedAction: lead.ai_recommended_action,
        priority,
        reason,
        createdAt: lead.created_at,
      };
    });

    const priorityOrder: Record<string, number> = {
      hot: 5,
      money: 4,
      urgent: 3,
      followup: 2,
      warm: 1,
      cold: 0,
    };

    leads.sort((a, b) => {
      const priorityDiff =
        priorityOrder[b.priority] -
        priorityOrder[a.priority];

      if (priorityDiff !== 0) return priorityDiff;

      return b.aiScore - a.aiScore;
    });

    return NextResponse.json({
      ok: true,
      count: leads.length,
      queue: leads,
      summary: {
        hot: leads.filter((x) => x.priority === "hot").length,
        money: leads.filter((x) => x.priority === "money").length,
        urgent: leads.filter((x) => x.priority === "urgent").length,
        followup: leads.filter((x) => x.priority === "followup").length,
        warm: leads.filter((x) => x.priority === "warm").length,
        cold: leads.filter((x) => x.priority === "cold").length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "AI dispatcher error",
      },
      { status: 500 }
    );
  }
}