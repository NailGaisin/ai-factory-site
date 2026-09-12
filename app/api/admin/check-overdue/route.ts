import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const OVERDUE_MS = 15 * 60 * 1000;

export async function POST() {
  const supabase = getAdminSupabase();

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase не настроен" },
      { status: 500 }
    );
  }

  const cutoff = new Date(
    Date.now() - OVERDUE_MS
  ).toISOString();

  const { data: leads, error } = await supabase
    .from("leads")
    .select(
      "id, created_at, name, company, contact, ai_score, ai_temperature, ai_recommended_action, contact_result"
    )
    .lt("created_at", cutoff)
    .or(
      "contact_result.is.null,contact_result.eq.not_contacted"
    )
    .order("created_at", {
      ascending: true,
    })
    .limit(20);

  if (error) {
    console.error("Overdue leads load error:", error);

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
    console.error(
      "Telegram credentials are not configured"
    );

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
        "overdue_15m"
      )
      .maybeSingle();

    if (existing) {
      continue;
    }

    const ageMinutes = Math.floor(
      (Date.now() -
        new Date(lead.created_at).getTime()) /
        60000
    );

    const temperature =
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
      "🚨 ПРОСРОЧЕННАЯ ЗАЯВКА",
      "",
      `👤 ${lead.name}`,
      `🏢 ${lead.company}`,
      `📞 ${lead.contact}`,
      "",
      `⏱ Без контакта: ${ageMinutes} мин.`,
      `🤖 Приоритет: ${temperature}`,
      `📊 AI score: ${score}`,
      lead.ai_recommended_action
        ? `➡️ Следующий шаг: ${lead.ai_recommended_action}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const { error: notificationError } =
      await supabase
        .from("lead_notifications")
        .insert({
          lead_id: lead.id,
          notification_type: "overdue_15m",
        });

    if (notificationError) {
      if (notificationError.code === "23505") {
        continue;
      }

      console.error(
        "Notification record error:",
        notificationError
      );

      continue;
    }

    try {
      const telegramResponse =
        await fetch(
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

      const telegramResult = await telegramResponse
        .json()
        .catch(() => null);

      if (!telegramResponse.ok || telegramResult?.ok !== true) {
        console.error(
          "Telegram notification failed:",
          telegramResult?.description ?? telegramResponse.status
        );

        await supabase
          .from("lead_notifications")
          .delete()
          .eq("lead_id", lead.id)
          .eq("notification_type", "overdue_15m");

        continue;
      }

      notified++;
    } catch (telegramError) {
      console.error(
        "Telegram request error:",
        telegramError
      );

      await supabase
        .from("lead_notifications")
        .delete()
        .eq("lead_id", lead.id)
        .eq("notification_type", "overdue_15m");
    }
  }

  return NextResponse.json({
    checked: leads?.length ?? 0,
    notified,
    telegram: true,
  });
}
