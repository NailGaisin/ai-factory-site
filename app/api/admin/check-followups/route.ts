import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const FOLLOW_UP_MS = 24 * 60 * 60 * 1000;

export async function POST() {
  const supabase = getAdminSupabase();

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase не настроен" },
      { status: 500 }
    );
  }

  const cutoff = new Date(
    Date.now() - FOLLOW_UP_MS
  ).toISOString();

  const { data: leads, error } = await supabase
    .from("leads")
    .select(
      "id, created_at, name, company, contact, ai_score, ai_temperature, ai_recommended_action, contact_result"
    )
    .eq("contact_result", "thinking")
    .lt("created_at", cutoff)
    .order("created_at", {
      ascending: true,
    })
    .limit(20);

  if (error) {
    console.error(
      "Follow-up leads load error:",
      error
    );

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  const botToken =
    process.env.TELEGRAM_BOT_TOKEN;

  const chatId =
    process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return NextResponse.json({
      checked: leads?.length ?? 0,
      notified: 0,
      telegram: false,
    });
  }

  let notified = 0;

  for (const lead of leads ?? []) {
    const { data: existing } = await supabase
      .from("lead_notifications")
      .select("id")
      .eq("lead_id", lead.id)
      .eq(
        "notification_type",
        "follow_up_24h"
      )
      .maybeSingle();

    if (existing) {
      continue;
    }

    const ageHours = Math.floor(
      (Date.now() -
        new Date(lead.created_at).getTime()) /
        (60 * 60 * 1000)
    );

    const priority =
      lead.ai_temperature === "hot"
        ? "🔥 HOT"
        : lead.ai_temperature === "warm"
          ? "🟡 WARM"
          : "⚪ COLD";

    const score =
      lead.ai_score == null
        ? "нет"
        : String(lead.ai_score);

    const text = [
      "🔔 FOLLOW-UP",
      "",
      `👤 ${lead.name}`,
      `🏢 ${lead.company}`,
      `📞 ${lead.contact}`,
      "",
      `⏱ Клиент думает уже: ${ageHours} ч.`,
      `🤖 Приоритет: ${priority}`,
      `📊 AI score: ${score}`,
      "",
      lead.ai_recommended_action
        ? `➡️ Следующий шаг: ${lead.ai_recommended_action}`
        : "➡️ Связаться с клиентом повторно.",
    ].join("\n");

    const { error: recordError } =
      await supabase
        .from("lead_notifications")
        .insert({
          lead_id: lead.id,
          notification_type:
            "follow_up_24h",
        });

    if (recordError) {
      if (recordError.code === "23505") {
        continue;
      }

      console.error(
        "Follow-up notification record error:",
        recordError
      );

      continue;
    }

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            chat_id: chatId,
            text,
          }),
        }
      );

      const telegramResult = await response.json().catch(() => null);

      if (!response.ok || telegramResult?.ok !== true) {
        console.error(
          "Telegram follow-up failed:",
          telegramResult?.description ?? response.status
        );

        await supabase
          .from("lead_notifications")
          .delete()
          .eq("lead_id", lead.id)
          .eq("notification_type", "follow_up_24h");

        continue;
      }

      notified++;
    } catch (error) {
      console.error(
        "Telegram follow-up request error:",
        error
      );

      await supabase
        .from("lead_notifications")
        .delete()
        .eq("lead_id", lead.id)
        .eq("notification_type", "follow_up_24h");
    }
  }

  return NextResponse.json({
    checked: leads?.length ?? 0,
    notified,
    telegram: true,
  });
}
