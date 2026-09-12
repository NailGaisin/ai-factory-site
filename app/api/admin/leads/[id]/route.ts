import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase";
import { isLeadStatus } from "@/lib/leads";

export const dynamic = "force-dynamic";

const contactResults = [
  "not_contacted",
  "contacted",
  "thinking",
  "won",
  "lost",
] as const;

type ContactResult = (typeof contactResults)[number];

function isContactResult(value: unknown): value is ContactResult {
  return (
    typeof value === "string" &&
    contactResults.includes(value as ContactResult)
  );
}

function isDealAmount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0
  );
}

function isDateTime(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 80 &&
    !Number.isNaN(new Date(value).getTime())
  );
}

function normalizedText(
  value: unknown,
  maxLength: number
): string | null | undefined {
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;

  const text = value.trim();
  return text.length <= maxLength ? text : undefined;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Не указан ID заявки" },
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

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", id)
      .single();

    if (leadError) {
      console.error("Lead read error:", leadError);

      return NextResponse.json(
        { ok: false, error: leadError.message },
        { status: 500 }
      );
    }

    const { data: history, error: historyError } = await supabase
      .from("lead_history")
      .select("*")
      .eq("lead_id", id)
      .order("created_at", { ascending: false });

    if (historyError) {
      console.error("Lead history read error:", historyError);
    }

    return NextResponse.json({
      ok: true,
      lead,
      history: history ?? [],
    });
  } catch (error) {
    console.error("Lead read error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Ошибка получения заявки",
      },
      { status: 500 }
    );
  }
}
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Не указан ID заявки" },
        { status: 400 }
      );
    }

    const updateData: {
      status?: string;
      contact_result?: ContactResult;
      deal_amount?: number;
      first_contacted_at?: string | null;
      next_action_at?: string | null;
      lost_reason?: string | null;
      manager_note?: string | null;
    } = {};

    if (body.status !== undefined) {
      if (!isLeadStatus(body.status)) {
        return NextResponse.json(
          { ok: false, error: "Некорректный статус" },
          { status: 400 }
        );
      }

      updateData.status = body.status;
    }

    if (body.contact_result !== undefined) {
      if (!isContactResult(body.contact_result)) {
        return NextResponse.json(
          { ok: false, error: "Некорректный результат контакта" },
          { status: 400 }
        );
      }

      updateData.contact_result = body.contact_result;
    }

    if (updateData.contact_result === "won") {
      updateData.status = "won";
    } else if (
      (updateData.contact_result === "contacted" ||
        updateData.contact_result === "thinking") &&
      updateData.status === undefined
    ) {
      updateData.status = "in_progress";
    }

    if (body.deal_amount !== undefined) {
      const amount = Number(body.deal_amount);

      if (!isDealAmount(amount)) {
        return NextResponse.json(
          { ok: false, error: "Некорректная сумма сделки" },
          { status: 400 }
        );
      }

      updateData.deal_amount = amount;
    }

    if (body.first_contacted_at !== undefined) {
      if (body.first_contacted_at === null || body.first_contacted_at === "") {
        updateData.first_contacted_at = null;
      } else if (isDateTime(body.first_contacted_at)) {
        updateData.first_contacted_at = new Date(
          body.first_contacted_at
        ).toISOString();
      } else {
        return NextResponse.json(
          { ok: false, error: "Некорректное время первого контакта" },
          { status: 400 }
        );
      }
    }

    if (body.next_action_at !== undefined) {
      if (body.next_action_at === null || body.next_action_at === "") {
        updateData.next_action_at = null;
      } else if (isDateTime(body.next_action_at)) {
        updateData.next_action_at = new Date(
          body.next_action_at
        ).toISOString();
      } else {
        return NextResponse.json(
          { ok: false, error: "Некорректное время следующего действия" },
          { status: 400 }
        );
      }
    }

    if (body.lost_reason !== undefined) {
      const lostReason = normalizedText(body.lost_reason, 1_000);

      if (lostReason === undefined) {
        return NextResponse.json(
          { ok: false, error: "Некорректная причина потери" },
          { status: 400 }
        );
      }

      updateData.lost_reason = lostReason;
    }

    if (body.manager_note !== undefined) {
      const managerNote = normalizedText(body.manager_note, 4_000);

      if (managerNote === undefined) {
        return NextResponse.json(
          { ok: false, error: "Некорректная заметка менеджера" },
          { status: 400 }
        );
      }

      updateData.manager_note = managerNote;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { ok: false, error: "Нет данных для обновления" },
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

    const { data: before, error: beforeError } = await supabase
      .from("leads")
      .select(
        "status, contact_result, deal_amount, first_contacted_at, next_action_at, lost_reason, manager_note"
      )
      .eq("id", id)
      .single();

    if (beforeError) {
      console.error("Lead read error:", beforeError);

      return NextResponse.json(
        { ok: false, error: beforeError.message },
        { status: 500 }
      );
    }

    const wasContacted =
      updateData.contact_result === "contacted" ||
      updateData.contact_result === "thinking" ||
      updateData.contact_result === "won" ||
      updateData.contact_result === "lost";

    if (
      wasContacted &&
      updateData.first_contacted_at === undefined &&
      !before.first_contacted_at
    ) {
      updateData.first_contacted_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("leads")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Lead update error:", error);

      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    const historyRows: {
      lead_id: string;
      action: string;
      old_value: string | null;
      new_value: string | null;
    }[] = [];

    if (
      updateData.status !== undefined &&
      before.status !== updateData.status
    ) {
      historyRows.push({
        lead_id: id,
        action: "status",
        old_value: before.status ?? null,
        new_value: updateData.status,
      });
    }

    if (
      updateData.contact_result !== undefined &&
      before.contact_result !== updateData.contact_result
    ) {
      historyRows.push({
        lead_id: id,
        action: "contact_result",
        old_value: before.contact_result ?? null,
        new_value: updateData.contact_result,
      });
    }

    if (
      updateData.deal_amount !== undefined &&
      Number(before.deal_amount ?? 0) !== updateData.deal_amount
    ) {
      historyRows.push({
        lead_id: id,
        action: "deal_amount",
        old_value: String(before.deal_amount ?? 0),
        new_value: String(updateData.deal_amount),
      });
    }

    if (
      updateData.first_contacted_at !== undefined &&
      before.first_contacted_at !== updateData.first_contacted_at
    ) {
      historyRows.push({
        lead_id: id,
        action: "first_contacted_at",
        old_value: before.first_contacted_at ?? null,
        new_value: updateData.first_contacted_at,
      });
    }

    if (
      updateData.next_action_at !== undefined &&
      before.next_action_at !== updateData.next_action_at
    ) {
      historyRows.push({
        lead_id: id,
        action: "next_action_at",
        old_value: before.next_action_at ?? null,
        new_value: updateData.next_action_at,
      });
    }

    if (
      updateData.lost_reason !== undefined &&
      before.lost_reason !== updateData.lost_reason
    ) {
      historyRows.push({
        lead_id: id,
        action: "lost_reason",
        old_value: before.lost_reason ?? null,
        new_value: updateData.lost_reason,
      });
    }

    if (
      updateData.manager_note !== undefined &&
      before.manager_note !== updateData.manager_note
    ) {
      historyRows.push({
        lead_id: id,
        action: "manager_note",
        old_value: before.manager_note ?? null,
        new_value: updateData.manager_note,
      });
    }

    if (historyRows.length > 0) {
      const { error: historyError } = await supabase
        .from("lead_history")
        .insert(historyRows);

      if (historyError) {
        console.error("Lead history error:", historyError);
      }
    }

    return NextResponse.json({
      ok: true,
      lead: data,
    });
  } catch (error) {
    console.error("Lead update error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Ошибка обновления заявки",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Не указан ID заявки" },
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

    const { error } = await supabase
      .from("leads")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Lead delete error:", error);

      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      deleted: id,
    });
  } catch (error) {
    console.error("Lead delete error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Ошибка удаления заявки",
      },
      { status: 500 }
    );
  }
}
