import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const score = Number(body.score);
    const temperature = body.temperature;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Не указан ID заявки" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(score) || score < 0 || score > 100) {
      return NextResponse.json(
        { ok: false, error: "Некорректный AI score" },
        { status: 400 }
      );
    }

    if (!["hot", "warm", "cold"].includes(temperature)) {
      return NextResponse.json(
        { ok: false, error: "Некорректная AI температура" },
        { status: 400 }
      );
    }

    const supabase = getAdminSupabase();

    if (!supabase) {
      return NextResponse.json(
        { ok: false, error: "Supabase не настроен" },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from("leads")
      .update({
        ai_score: Math.round(score),
        ai_temperature: temperature,
        ai_summary: body.summary ?? null,
        ai_needs: body.needs ?? null,
        ai_recommended_action: body.recommendedAction ?? null,
        ai_first_reply: body.firstReply ?? null,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("AI save error:", error);

      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      lead: data,
    });
  } catch (error) {
    console.error("AI save error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Ошибка сохранения AI",
      },
      { status: 500 }
    );
  }
}