"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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

type Props = {
  initialLeads: Lead[];
  initialError: string | null;
};

type Tab =
  | "overview"
  | "leads"
  | "funnel"
  | "finance"
  | "analytics"
  | "ai"
  | "archive";

const statusNames: Record<Lead["status"], string> = {
  new: "Новая",
  in_progress: "В работе",
  won: "Успешная",
  archived: "Архив",
};

const contactNames: Record<string, string> = {
  not_contacted: "Не связывались",
  contacted: "Связались",
  thinking: "Думает",
  won: "Сделка",
  lost: "Потеряна",
};

function money(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function date(value: string | null | undefined) {
  if (!value) return "—";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function dateTimeLocal(value: string | null) {
  if (!value) return "";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  const offset = parsed.getTimezoneOffset() * 60_000;
  return new Date(parsed.getTime() - offset).toISOString().slice(0, 16);
}

function sourceLabel(lead: Lead) {
  if (lead.utmSource) {
    return `UTM: ${lead.utmSource}`;
  }

  if (lead.leadSource === "referral") {
    return "Переход с другого сайта";
  }

  return "Прямой переход";
}

export default function CrmDashboard({
  initialLeads,
  initialError,
}: Props) {
  const router = useRouter();

  const [dataLeads, setDataLeads] = useState<Lead[]>(initialLeads);
  const [tab, setTab] = useState<Tab>("overview");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setDataLeads(initialLeads);
  }, [initialLeads]);

  useEffect(() => {
    const refreshWhenReturning = () => {
      const activeElement = document.activeElement;
      const isEditing =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement;

      if (
        document.visibilityState === "visible" &&
        !isEditing &&
        busy === null
      ) {
        router.refresh();
      }
    };

    window.addEventListener("focus", refreshWhenReturning);
    document.addEventListener("visibilitychange", refreshWhenReturning);
    const refreshTimer = window.setInterval(refreshWhenReturning, 10_000);

    return () => {
      window.removeEventListener("focus", refreshWhenReturning);
      document.removeEventListener("visibilitychange", refreshWhenReturning);
      window.clearInterval(refreshTimer);
    };
  }, [router, busy]);

  const activeLeads = useMemo(
    () => dataLeads.filter((lead) => lead.status !== "archived"),
    [dataLeads]
  );

  const archivedLeads = useMemo(
    () => dataLeads.filter((lead) => lead.status === "archived"),
    [dataLeads]
  );

  const stats = useMemo(() => {
    const total = activeLeads.length;
    const fresh = activeLeads.filter((x) => x.status === "new").length;
    const working = activeLeads.filter(
      (x) => x.status === "in_progress"
    ).length;
    const won = activeLeads.filter((x) => x.status === "won").length;
    const thinking = activeLeads.filter(
      (x) => x.contactResult === "thinking"
    ).length;
    const contacted = activeLeads.filter(
      (x) =>
        x.contactResult === "contacted" ||
        x.contactResult === "thinking" ||
        x.contactResult === "won"
    ).length;
    const hot = activeLeads.filter(
      (x) => x.aiTemperature === "hot"
    ).length;

    const revenue = activeLeads
      .filter((x) => x.status === "won")
      .reduce((sum, x) => sum + Number(x.dealAmount || 0), 0);

    const pipeline = activeLeads
      .filter((x) => x.status !== "won")
      .reduce((sum, x) => sum + Number(x.dealAmount || 0), 0);

    const overdue = activeLeads.filter((lead) => {
      if (!lead.nextActionAt || lead.status === "won") return false;

      const dueAt = new Date(lead.nextActionAt).getTime();
      return Number.isFinite(dueAt) && dueAt <= Date.now();
    }).length;

    return {
      total,
      fresh,
      working,
      won,
      thinking,
      contacted,
      hot,
      revenue,
      pipeline,
      overdue,
      conversion: total ? Math.round((won / total) * 100) : 0,
      contactConversion: total
        ? Math.round((contacted / total) * 100)
        : 0,
    };
  }, [activeLeads]);

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();

    return dataLeads.filter((lead) => {
      const text = [
        lead.name,
        lead.company ?? "",
        lead.contact,
        lead.niche,
      ]
        .join(" ")
        .toLowerCase();

      const searchOk = !q || text.includes(q);

      const filterOk =
        filter === "all" ||
        filter === lead.status ||
        filter === lead.aiTemperature ||
        filter === lead.contactResult;

      return searchOk && filterOk;
    });
  }, [dataLeads, search, filter]);

  const sourceStats = useMemo(() => {
    const grouped = new Map<
      string,
      { source: string; leads: number; won: number; revenue: number }
    >();

    for (const lead of activeLeads) {
      const source = sourceLabel(lead);
      const current = grouped.get(source) ?? {
        source,
        leads: 0,
        won: 0,
        revenue: 0,
      };

      current.leads += 1;

      if (lead.status === "won") {
        current.won += 1;
        current.revenue += Number(lead.dealAmount || 0);
      }

      grouped.set(source, current);
    }

    return [...grouped.values()].sort((a, b) => b.leads - a.leads);
  }, [activeLeads]);

  async function patchLead(
    id: string,
    body: Record<string, unknown>
  ) {
    const changes = { ...body };

    if (changes.contact_result === "won") {
      changes.status = "won";
    } else if (
      (changes.contact_result === "contacted" ||
        changes.contact_result === "thinking") &&
      changes.status === undefined
    ) {
      changes.status = "in_progress";
    }

    setBusy(id);
    setNotice("");

    try {
      const response = await fetch(`/api/admin/leads/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(changes),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Не удалось сохранить");
      }

      const savedLead = data.lead as
        | { first_contacted_at?: string | null }
        | undefined;

      setDataLeads((current) =>
        current.map((lead) => {
          if (lead.id !== id) return lead;

          return {
            ...lead,
            ...(changes.status !== undefined
              ? { status: changes.status as Lead["status"] }
              : {}),
            ...(changes.contact_result !== undefined
              ? { contactResult: String(changes.contact_result) }
              : {}),
            ...(changes.deal_amount !== undefined
              ? { dealAmount: Number(changes.deal_amount) }
              : {}),
            ...(changes.first_contacted_at !== undefined
              ? {
                  firstContactedAt:
                    typeof changes.first_contacted_at === "string"
                      ? changes.first_contacted_at
                      : null,
                }
              : {}),
            ...(savedLead?.first_contacted_at !== undefined
              ? {
                  firstContactedAt:
                    savedLead.first_contacted_at ?? null,
                }
              : {}),
            ...(changes.next_action_at !== undefined
              ? {
                  nextActionAt:
                    typeof changes.next_action_at === "string"
                      ? changes.next_action_at
                      : null,
                }
              : {}),
            ...(changes.lost_reason !== undefined
              ? {
                  lostReason:
                    typeof changes.lost_reason === "string"
                      ? changes.lost_reason
                      : null,
                }
              : {}),
            ...(changes.manager_note !== undefined
              ? {
                  managerNote:
                    typeof changes.manager_note === "string"
                      ? changes.manager_note
                      : null,
                }
              : {}),
          };
        })
      );

      setNotice("Изменения сохранены");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Ошибка сохранения"
      );
    } finally {
      setBusy(null);
    }
  }

  async function archiveLead(lead: Lead) {
    await patchLead(lead.id, {
      status: "archived",
    });
  }

  async function deleteLead(lead: Lead) {
    if (
      !window.confirm(
        `Удалить заявку «${lead.name}» окончательно?`
      )
    ) {
      return;
    }

    setBusy(lead.id);
    setNotice("");

    try {
      const response = await fetch(
        `/api/admin/leads/${lead.id}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Ошибка удаления");
      }

      setDataLeads((current) =>
        current.filter((item) => item.id !== lead.id)
      );

      setNotice("Заявка окончательно удалена");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Ошибка удаления"
      );
    } finally {
      setBusy(null);
    }
  }

  async function analyze(lead: Lead) {
    setBusy(lead.id);
    setNotice("");

    try {
      const response = await fetch("/api/ai/analyze-lead", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: lead.name,
          company: lead.company ?? "",
          contact: lead.contact,
          niche: lead.niche,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error || "AI-анализ не выполнен"
        );
      }

      const analysis = data.analysis;

      const save = await fetch(
        `/api/admin/leads/${lead.id}/ai`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            score: analysis.score,
            temperature: analysis.temperature,
            summary: analysis.summary,
            needs: analysis.needs,
            recommendedAction:
              analysis.recommendedAction,
            firstReply: analysis.firstReply,
          }),
        }
      );

      const saved = await save.json();

      if (!save.ok || !saved.ok) {
        throw new Error(
          saved.error ||
            "AI-анализ получен, но не сохранён"
        );
      }

      setDataLeads((current) =>
        current.map((item) =>
          item.id === lead.id
            ? {
                ...item,
                aiScore: Number(analysis.score),
                aiTemperature: analysis.temperature,
                aiSummary: analysis.summary ?? null,
                aiNeeds: analysis.needs ?? null,
                aiRecommendedAction:
                  analysis.recommendedAction ?? null,
                aiFirstReply:
                  analysis.firstReply ?? null,
              }
            : item
        )
      );

      setNotice("AI-анализ сохранён");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Ошибка AI-анализа"
      );
    } finally {
      setBusy(null);
    }
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setNotice("Ответ скопирован");
  }

  const nav: { id: Tab; name: string }[] = [
    { id: "overview", name: "Обзор" },
    { id: "leads", name: "Заявки" },
    { id: "funnel", name: "Воронка" },
    { id: "finance", name: "Финансы" },
    { id: "analytics", name: "Аналитика" },
    { id: "ai", name: "AI" },
    { id: "archive", name: "Архив" },
  ];

  function Stat({
    label,
    value,
    hint,
  }: {
    label: string;
    value: string | number;
    hint: string;
  }) {
    return (
      <div className="stat">
        <div className="statLabel">{label}</div>
        <div className="statValue">{value}</div>
        <div className="statHint">{hint}</div>
      </div>
    );
  }

  function renderLeadCard(lead: Lead) {
    const initials =
      lead.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((x) => x[0])
        .join("")
        .toUpperCase() || "К";

    return (
      <article className="lead" key={lead.id}>
        <div className="leadHeader">
          <div className="person">
            <div className="avatar">{initials}</div>

            <div>
              <div className="name">{lead.name}</div>

              {lead.company && (
                <div className="company">
                  {lead.company}
                </div>
              )}

              <div className="meta">
                {lead.contact} ·{" "}
                {lead.niche || "Ниша не указана"} ·{" "}
                {date(lead.createdAt)} · {sourceLabel(lead)}
              </div>

              {lead.nextActionAt && (
                <div className="nextAction">
                  Следующее действие: {date(lead.nextActionAt)}
                </div>
              )}
            </div>
          </div>

          <div className="badges">
            <span className="badge">
              {statusNames[lead.status]}
            </span>

            {lead.contactResult && (
              <span className="badge">
                {contactNames[lead.contactResult] ||
                  lead.contactResult}
              </span>
            )}

            {lead.aiTemperature && (
              <span
                className={`badge ${lead.aiTemperature}`}
              >
                {lead.aiTemperature === "hot"
                  ? "Горячая"
                  : lead.aiTemperature === "warm"
                    ? "Тёплая"
                    : "Холодная"}
              </span>
            )}

            {lead.aiScore !== null && (
              <span className="badge">
                AI {lead.aiScore}/100
              </span>
            )}
          </div>
        </div>

        <div className="content">
          <div className="panel">
            <div className="label">AI-рекомендация</div>

            <div className="text">
              {lead.aiRecommendedAction ||
                "AI-анализ ещё не выполнен."}
            </div>

            {lead.aiScore !== null && (
              <div className="aiGrid">
                <div className="ai">
                  <div className="label">Резюме</div>
                  <div className="text">
                    {lead.aiSummary || "Нет данных"}
                  </div>
                </div>

                <div className="ai">
                  <div className="label">
                    Потребность
                  </div>
                  <div className="text">
                    {lead.aiNeeds || "Нет данных"}
                  </div>
                </div>

                <div className="ai">
                  <div className="label">
                    Следующий шаг
                  </div>
                  <div className="text">
                    {lead.aiRecommendedAction ||
                      "Нет данных"}
                  </div>
                </div>

                {lead.aiFirstReply && (
                  <div className="ai reply">
                    <div className="label">
                      Готовый ответ клиенту
                    </div>

                    <div className="text">
                      {lead.aiFirstReply}
                    </div>

                    <button
                      className="button"
                      onClick={() =>
                        copy(lead.aiFirstReply!)
                      }
                    >
                      Скопировать
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <aside className="panel">
            <div className="controls">
              <div className="control">
                <label>Статус</label>

                <select
                  value={lead.status}
                  disabled={busy === lead.id}
                  onChange={(e) =>
                    patchLead(lead.id, {
                      status: e.target.value,
                    })
                  }
                >
                  <option value="new">Новая</option>
                  <option value="in_progress">
                    В работе
                  </option>
                  <option value="won">Успешная</option>
                  <option value="archived">
                    Архив
                  </option>
                </select>
              </div>

              <div className="control">
                <label>Результат контакта</label>

                <select
                  value={
                    lead.contactResult ??
                    "not_contacted"
                  }
                  disabled={busy === lead.id}
                  onChange={(e) =>
                    patchLead(lead.id, {
                      contact_result: e.target.value,
                    })
                  }
                >
                  <option value="not_contacted">
                    Не связывались
                  </option>
                  <option value="contacted">
                    Связались
                  </option>
                  <option value="thinking">
                    Думает
                  </option>
                  <option value="won">Сделка</option>
                  <option value="lost">
                    Потеряна
                  </option>
                </select>
              </div>

              <div className="control">
                <label>Сумма сделки, ₽</label>

                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={lead.dealAmount}
                  disabled={busy === lead.id}
                  onChange={(e) => {
                    const value = Number(
                      e.target.value
                    );

                    setDataLeads((current) =>
                      current.map((item) =>
                        item.id === lead.id
                          ? {
                              ...item,
                              dealAmount: value,
                            }
                          : item
                      )
                    );
                  }}
                  onBlur={(e) => {
                    patchLead(lead.id, {
                      deal_amount: Number(
                        e.target.value
                      ),
                    });
                  }}
                />
              </div>

              <div className="contactMoment">
                <div className="label">ПЕРВЫЙ КОНТАКТ</div>
                <strong>{date(lead.firstContactedAt)}</strong>
              </div>

              <div className="control">
                <label>Следующее действие</label>

                <input
                  type="datetime-local"
                  value={dateTimeLocal(lead.nextActionAt)}
                  disabled={busy === lead.id}
                  onChange={(e) => {
                    const nextActionAt = e.target.value
                      ? new Date(e.target.value).toISOString()
                      : null;

                    setDataLeads((current) =>
                      current.map((item) =>
                        item.id === lead.id
                          ? { ...item, nextActionAt }
                          : item
                      )
                    );
                  }}
                  onBlur={(e) =>
                    patchLead(lead.id, {
                      next_action_at: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : null,
                    })
                  }
                />
              </div>

              <div className="control">
                <label>Причина потери</label>

                <input
                  value={lead.lostReason ?? ""}
                  disabled={busy === lead.id}
                  placeholder="Например: нет бюджета"
                  onChange={(e) => {
                    const lostReason = e.target.value;

                    setDataLeads((current) =>
                      current.map((item) =>
                        item.id === lead.id
                          ? { ...item, lostReason }
                          : item
                      )
                    );
                  }}
                  onBlur={(e) =>
                    patchLead(lead.id, {
                      lost_reason: e.target.value || null,
                    })
                  }
                />
              </div>

              <div className="control">
                <label>Заметка менеджера</label>

                <textarea
                  value={lead.managerNote ?? ""}
                  disabled={busy === lead.id}
                  placeholder="Что договорились сделать дальше"
                  onChange={(e) => {
                    const managerNote = e.target.value;

                    setDataLeads((current) =>
                      current.map((item) =>
                        item.id === lead.id
                          ? { ...item, managerNote }
                          : item
                      )
                    );
                  }}
                  onBlur={(e) =>
                    patchLead(lead.id, {
                      manager_note: e.target.value || null,
                    })
                  }
                />
              </div>

              {lead.status !== "archived" && (
                <button
                  className="button"
                  disabled={busy === lead.id}
                  onClick={() =>
                    archiveLead(lead)
                  }
                >
                  В архив
                </button>
              )}

              <button
                className="button danger"
                disabled={busy === lead.id}
                onClick={() =>
                  deleteLead(lead)
                }
              >
                Удалить
              </button>

              <button
                className="button primary"
                disabled={busy === lead.id}
                onClick={() => analyze(lead)}
              >
                {busy === lead.id
                  ? "AI работает..."
                  : lead.aiScore === null
                    ? "Запустить AI-анализ"
                    : "Повторить AI-анализ"}
              </button>

              {lead.dealAmount > 0 && (
                <div className="dealTotal">
                  <div className="label">
                    Сумма сделки
                  </div>
                  <strong>
                    {money(lead.dealAmount)} ₽
                  </strong>
                </div>
              )}
            </div>
          </aside>
        </div>
      </article>
    );
  }

  return (
    <main className="crm">
      <style jsx>{`
        .crm {
          min-height: 100vh;
          background: #070a0f;
          color: #f4f6f8;
          padding: 18px 24px 50px;
          font-family: Inter, Arial, sans-serif;
        }

        * {
          box-sizing: border-box;
        }

        button,
        input,
        select,
        textarea {
          font: inherit;
        }

        button {
          cursor: pointer;
        }

        .wrap {
          max-width: 1560px;
          margin: 0 auto;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 18px;
        }

        .brand {
          display: flex;
          gap: 14px;
          align-items: center;
        }

        .logo {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: #fff;
          color: #080a0f;
          display: grid;
          place-items: center;
          font-weight: 900;
        }

        .overline,
        .label {
          color: #687486;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        h1 {
          margin: 3px 0 0;
          font-size: 24px;
        }

        .subtitle {
          color: #7e8898;
          font-size: 13px;
          margin-top: 4px;
        }

        .button {
          border: 1px solid #2a3342;
          background: #111620;
          color: #eef1f5;
          border-radius: 9px;
          padding: 9px 12px;
          font-size: 12px;
          font-weight: 750;
        }

        .button:hover {
          background: #1a202b;
        }

        .button.primary {
          background: #fff;
          color: #080a0f;
          border-color: #fff;
        }

        .button.danger {
          color: #ffb8bf;
          border-color: #603039;
          background: #211216;
        }

        .button:disabled {
          opacity: .55;
          cursor: default;
        }

        .nav {
          display: flex;
          gap: 7px;
          overflow-x: auto;
          margin-bottom: 18px;
          padding-bottom: 2px;
        }

        .navButton {
          white-space: nowrap;
          border: 1px solid #202735;
          background: #0e131b;
          color: #8d98a9;
          border-radius: 9px;
          padding: 9px 13px;
          font-size: 12px;
          font-weight: 750;
        }

        .navButton.active {
          background: #fff;
          color: #080a0f;
          border-color: #fff;
        }

        .notice {
          background: #111822;
          border: 1px solid #283243;
          color: #bac3d0;
          border-radius: 10px;
          padding: 11px 13px;
          margin-bottom: 15px;
          font-size: 12px;
        }

        .notice.error {
          color: #ffb5bd;
          background: #241216;
          border-color: #5d3038;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 9px;
          margin-bottom: 18px;
        }

        .stat {
          background: #10141c;
          border: 1px solid #202735;
          border-radius: 15px;
          padding: 13px 15px;
        }

        .statLabel {
          color: #788294;
          font-size: 10px;
          margin-bottom: 8px;
        }

        .statValue {
          font-size: 22px;
          font-weight: 850;
        }

        .statHint {
          color: #596475;
          font-size: 10px;
          margin-top: 5px;
        }

        .section {
          background: #10141c;
          border: 1px solid #202735;
          border-radius: 14px;
          padding: 16px;
          margin-bottom: 14px;
        }

        .sectionTitle {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
        }

        .sectionTitle h2 {
          margin: 0;
          font-size: 18px;
        }

        .sectionTitle span {
          color: #697486;
          font-size: 12px;
        }

        .toolbar {
          display: grid;
          grid-template-columns: 1fr 190px 120px;
          gap: 10px;
          margin-bottom: 18px;
        }

        .input,
        .select {
          width: 100%;
          border: 1px solid #283141;
          border-radius: 10px;
          background: #10151e;
          color: #edf0f5;
          padding: 11px 13px;
          outline: none;
        }

        .select option {
          background: #10151e;
        }

        .leads {
          display: grid;
          gap: 9px;
        }

        .lead {
          background: #10141c;
          border: 1px solid #202735;
          border-radius: 13px;
          padding: 14px 16px;
        }

        .leadHeader {
          display: flex;
          justify-content: space-between;
          gap: 15px;
        }

        .person {
          display: flex;
          gap: 9px;
        }

        .avatar {
          width: 42px;
          height: 42px;
          flex: 0 0 42px;
          border-radius: 12px;
          background: #1b222e;
          display: grid;
          place-items: center;
          font-weight: 800;
        }

        .name {
          font-size: 17px;
          font-weight: 800;
        }

        .company {
          color: #a2abb9;
          font-size: 12px;
          margin-top: 3px;
        }

        .meta {
          color: #6e798a;
          font-size: 12px;
          margin-top: 6px;
        }

        .nextAction {
          color: #c7d7ec;
          font-size: 11px;
          margin-top: 7px;
        }

        .badges {
          display: flex;
          gap: 6px;
          align-items: flex-start;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .badge {
          border: 1px solid #303949;
          background: #161c26;
          border-radius: 999px;
          padding: 6px 9px;
          font-size: 10px;
          font-weight: 750;
          color: #bac3cf;
        }

        .hot {
          color: #ffb4bd;
          border-color: #713c45;
          background: #28151a;
        }

        .warm {
          color: #e5c47e;
          border-color: #66532d;
          background: #211c12;
        }

        .cold {
          color: #a5c5ee;
          border-color: #354c68;
          background: #121c2a;
        }

        .content {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 270px;
          gap: 9px;
          margin-top: 15px;
        }

        .panel {
          background: #0c1017;
          border: 1px solid #202836;
          border-radius: 12px;
          padding: 12px;
        }

        .label {
          margin-bottom: 6px;
        }

        .text {
          color: #cbd2dc;
          font-size: 12px;
          line-height: 1.55;
        }

        .aiGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
          margin-top: 10px;
        }

        .ai {
          background: #111620;
          border: 1px solid #222b39;
          border-radius: 10px;
          padding: 10px;
        }

        .reply {
          grid-column: 1 / -1;
        }

        .reply .button {
          margin-top: 10px;
        }

        .controls {
          display: grid;
          gap: 9px;
        }

        .control label {
          display: block;
          color: #687486;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          margin-bottom: 5px;
        }

        .control select,
        .control input,
        .control textarea {
          width: 100%;
          border: 1px solid #293343;
          background: #151b25;
          color: #e8edf3;
          border-radius: 8px;
          padding: 9px;
          font-size: 12px;
        }

        .control textarea {
          min-height: 68px;
          resize: vertical;
        }

        .contactMoment {
          padding: 10px;
          border-radius: 8px;
          background: #111720;
        }

        .contactMoment strong {
          display: block;
          color: #cbd4df;
          font-size: 12px;
        }

        .dealTotal {
          border-top: 1px solid #202836;
          padding-top: 12px;
          margin-top: 2px;
        }

        .dealTotal strong {
          display: block;
          font-size: 22px;
          margin-top: 4px;
        }

        .funnel {
          display: grid;
          gap: 10px;
        }

        .funnelRow {
          display: grid;
          grid-template-columns: 150px 1fr 80px 130px;
          gap: 10px;
          align-items: center;
        }

        .funnelName {
          font-weight: 750;
          font-size: 12px;
        }

        .bar {
          height: 12px;
          background: #1b222e;
          border-radius: 99px;
          overflow: hidden;
        }

        .barFill {
          height: 100%;
          background: #8f99a8;
          border-radius: 99px;
        }

        .funnelCount {
          text-align: right;
          font-weight: 800;
        }

        .funnelMoney {
          color: #9ca7b7;
          text-align: right;
          font-size: 12px;
        }

        .financeGrid,
        .analyticsGrid,
        .aiQueue {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .bigCard {
          background: #0c1017;
          border: 1px solid #202836;
          border-radius: 12px;
          padding: 16px;
        }

        .bigCard .number {
          font-size: 26px;
          font-weight: 850;
          margin-top: 8px;
        }

        .bigCard .small {
          color: #697486;
          font-size: 11px;
          margin-top: 5px;
        }

        .aiPriority {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
        }

        .priorityName {
          font-weight: 800;
        }

        .priorityAction {
          color: #a9b2c0;
          font-size: 11px;
          margin-top: 4px;
        }

        .sourceList {
          display: grid;
          gap: 9px;
          margin-top: 16px;
        }

        .sourceRow {
          display: grid;
          grid-template-columns: 1fr 90px 90px 120px;
          gap: 10px;
          align-items: center;
          padding: 12px;
          border-radius: 10px;
          background: #0c1017;
          border: 1px solid #202836;
          font-size: 12px;
        }

        .sourceRow strong {
          font-size: 13px;
        }

        .sourceRow span {
          color: #9da8b8;
          text-align: right;
        }

        .score {
          font-size: 20px;
          font-weight: 850;
        }

        .empty {
          padding: 55px;
          text-align: center;
          color: #687487;
          border: 1px dashed #293342;
          border-radius: 14px;
        }

        @media (max-width: 1000px) {
          .stats {
            grid-template-columns: repeat(3, 1fr);
          }

          .content {
            grid-template-columns: 1fr;
          }

          .financeGrid,
          .analyticsGrid,
          .aiQueue {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 650px) {
          .crm {
            padding: 15px;
          }

          .stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .toolbar {
            grid-template-columns: 1fr;
          }

          .leadHeader {
            flex-direction: column;
          }

          .badges {
            justify-content: flex-start;
          }

          .aiGrid {
            grid-template-columns: 1fr;
          }

          .reply {
            grid-column: auto;
          }

          .funnelRow {
            grid-template-columns: 1fr;
            gap: 5px;
          }

          .sourceRow {
            grid-template-columns: 1fr 1fr;
          }

          .sourceRow span {
            text-align: left;
          }

          .funnelCount,
          .funnelMoney {
            text-align: left;
          }

          .financeGrid,
          .analyticsGrid,
          .aiQueue {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="wrap">
        <header className="header">
          <div className="brand">
            <div className="logo">AI</div>

            <div>
              <div className="overline">
                AI Factory
              </div>

              <h1>Центр продаж</h1>

              <div className="subtitle">
                CRM · продажи · финансы · AI
              </div>
            </div>
          </div>

          <button
            className="button"
            onClick={() => router.refresh()}
          >
            Обновить
          </button>
        </header>

        <nav className="nav">
          {nav.map((item) => (
            <button
              key={item.id}
              className={`navButton ${
                tab === item.id ? "active" : ""
              }`}
              onClick={() => setTab(item.id)}
            >
              {item.name}
            </button>
          ))}
        </nav>

        {initialError && (
          <div className="notice error">
            Ошибка загрузки: {initialError}
          </div>
        )}

        {notice && (
          <div className="notice">{notice}</div>
        )}

        {(tab === "overview" ||
          tab === "funnel" ||
          tab === "finance" ||
          tab === "analytics" ||
          tab === "ai") && (
          <section className="stats">
            <Stat
              label="АКТИВНЫЕ ЗАЯВКИ"
              value={stats.total}
              hint="Без архива"
            />
            <Stat
              label="НОВЫЕ"
              value={stats.fresh}
              hint="Требуют обработки"
            />
            <Stat
              label="В РАБОТЕ"
              value={stats.working}
              hint="Активные"
            />
            <Stat
              label="СДЕЛКИ"
              value={stats.won}
              hint={`Конверсия ${stats.conversion}%`}
            />
            <Stat
              label="ГОРЯЧИЕ AI"
              value={stats.hot}
              hint="Высокий приоритет"
            />
            <Stat
              label="ВЫРУЧКА"
              value={`${money(stats.revenue)} ₽`}
              hint={`Воронка ${money(stats.pipeline)} ₽`}
            />
          </section>
        )}

        {tab === "overview" && (
          <>
            <section className="section">
              <div className="sectionTitle">
                <h2>Главное сейчас</h2>
                <span>
                  {stats.fresh} новых · {stats.hot} горячих
                </span>
              </div>

              <div className="analyticsGrid">
                <div className="bigCard">
                  <div className="label">
                    НУЖНО ОБРАБОТАТЬ
                  </div>
                  <div className="number">
                    {stats.fresh}
                  </div>
                  <div className="small">
                    Новые заявки
                  </div>
                </div>

                <div className="bigCard">
                  <div className="label">
                    КОНТАКТ СОСТОЯЛСЯ
                  </div>
                  <div className="number">
                    {stats.contacted}
                  </div>
                  <div className="small">
                    Конверсия контакта{" "}
                    {stats.contactConversion}%
                  </div>
                </div>

                <div className="bigCard">
                  <div className="label">
                    ОЖИДАЕТ РЕШЕНИЯ
                  </div>
                  <div className="number">
                    {stats.thinking}
                  </div>
                  <div className="small">
                    Клиенты думают
                  </div>
                </div>

                <div className="bigCard">
                  <div className="label">
                    НУЖНО ВЕРНУТЬСЯ
                  </div>
                  <div className="number">
                    {stats.overdue}
                  </div>
                  <div className="small">
                    Просроченные следующие действия
                  </div>
                </div>
              </div>
            </section>

            <section className="section">
              <div className="sectionTitle">
                <h2>Последние заявки</h2>
                <button
                  className="button"
                  onClick={() => setTab("leads")}
                >
                  Все заявки
                </button>
              </div>

              <div className="leads">
                {activeLeads
                  .slice(0, 5)
                  .map(renderLeadCard)}

                {activeLeads.length === 0 && (
                  <div className="empty">
                    Активных заявок пока нет
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {tab === "leads" && (
          <section className="section">
            <div className="sectionTitle">
              <h2>Заявки</h2>
              <span>
                {filteredLeads.length} из{" "}
                {dataLeads.length}
              </span>
            </div>

            <div className="toolbar">
              <input
                className="input"
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Имя, компания, контакт или ниша"
              />

              <select
                className="select"
                value={filter}
                onChange={(e) =>
                  setFilter(e.target.value)
                }
              >
                <option value="all">
                  Все заявки
                </option>
                <option value="new">Новые</option>
                <option value="in_progress">
                  В работе
                </option>
                <option value="won">Успешные</option>
                <option value="hot">Горячие AI</option>
                <option value="warm">Тёплые AI</option>
                <option value="cold">
                  Холодные AI
                </option>
                <option value="thinking">
                  Думают
                </option>
                <option value="lost">
                  Потеряны
                </option>
              </select>

              <button
                className="button"
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
              >
                Сбросить
              </button>
            </div>

            <div className="leads">
              {filteredLeads
                .filter(
                  (lead) => lead.status !== "archived"
                )
                .map(renderLeadCard)}

              {filteredLeads.filter(
                (lead) => lead.status !== "archived"
              ).length === 0 && (
                <div className="empty">
                  Заявок не найдено
                </div>
              )}
            </div>
          </section>
        )}

        {tab === "funnel" && (
          <section className="section">
            <div className="sectionTitle">
              <h2>Воронка продаж</h2>
              <span>
                {stats.total} активных заявок
              </span>
            </div>

            <div className="funnel">
              {[
                {
                  name: "Новые",
                  count: stats.fresh,
                  money: activeLeads
                    .filter((x) => x.status === "new")
                    .reduce(
                      (s, x) =>
                        s + Number(x.dealAmount || 0),
                      0
                    ),
                },
                {
                  name: "В работе",
                  count: stats.working,
                  money: activeLeads
                    .filter(
                      (x) =>
                        x.status === "in_progress"
                    )
                    .reduce(
                      (s, x) =>
                        s + Number(x.dealAmount || 0),
                      0
                    ),
                },
                {
                  name: "Связались",
                  count: activeLeads.filter(
                    (x) =>
                      x.contactResult ===
                        "contacted" ||
                      x.contactResult === "thinking"
                  ).length,
                  money: activeLeads
                    .filter(
                      (x) =>
                        x.contactResult ===
                          "contacted" ||
                        x.contactResult ===
                          "thinking"
                    )
                    .reduce(
                      (s, x) =>
                        s + Number(x.dealAmount || 0),
                      0
                    ),
                },
                {
                  name: "Думают",
                  count: stats.thinking,
                  money: activeLeads
                    .filter(
                      (x) =>
                        x.contactResult ===
                        "thinking"
                    )
                    .reduce(
                      (s, x) =>
                        s + Number(x.dealAmount || 0),
                      0
                    ),
                },
                {
                  name: "Сделка",
                  count: stats.won,
                  money: stats.revenue,
                },
              ].map((stage) => {
                const max = Math.max(
                  stats.total,
                  1
                );

                return (
                  <div
                    className="funnelRow"
                    key={stage.name}
                  >
                    <div className="funnelName">
                      {stage.name}
                    </div>

                    <div className="bar">
                      <div
                        className="barFill"
                        style={{
                          width: `${Math.min(
                            100,
                            (stage.count / max) *
                              100
                          )}%`,
                        }}
                      />
                    </div>

                    <div className="funnelCount">
                      {stage.count}
                    </div>

                    <div className="funnelMoney">
                      {money(stage.money)} ₽
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {tab === "finance" && (
          <section className="section">
            <div className="sectionTitle">
              <h2>Финансы</h2>
              <span>На основе заявок CRM</span>
            </div>

            <div className="financeGrid">
              <div className="bigCard">
                <div className="label">
                  ВЫРУЧКА
                </div>
                <div className="number">
                  {money(stats.revenue)} ₽
                </div>
                <div className="small">
                  Реализованные сделки
                </div>
              </div>

              <div className="bigCard">
                <div className="label">
                  ПОТЕНЦИАЛ ВОРОНКИ
                </div>
                <div className="number">
                  {money(stats.pipeline)} ₽
                </div>
                <div className="small">
                  Открытые сделки
                </div>
              </div>

              <div className="bigCard">
                <div className="label">
                  СРЕДНИЙ ЧЕК
                </div>
                <div className="number">
                  {stats.won
                    ? money(
                        Math.round(
                          stats.revenue /
                            stats.won
                        )
                      )
                    : "0"}{" "}
                  ₽
                </div>
                <div className="small">
                  По выигранным сделкам
                </div>
              </div>
            </div>
          </section>
        )}

        {tab === "analytics" && (
          <section className="section">
            <div className="sectionTitle">
              <h2>Аналитика</h2>
              <span>Текущая CRM</span>
            </div>

            <div className="analyticsGrid">
              <div className="bigCard">
                <div className="label">
                  КОНВЕРСИЯ В СДЕЛКУ
                </div>
                <div className="number">
                  {stats.conversion}%
                </div>
                <div className="small">
                  Сделки / активные заявки
                </div>
              </div>

              <div className="bigCard">
                <div className="label">
                  КОНВЕРСИЯ В КОНТАКТ
                </div>
                <div className="number">
                  {stats.contactConversion}%
                </div>
                <div className="small">
                  Заявки, с которыми связались
                </div>
              </div>

              <div className="bigCard">
                <div className="label">
                  ПОТЕРЯННЫЕ
                </div>
                <div className="number">
                  {
                    activeLeads.filter(
                      (x) =>
                        x.contactResult ===
                        "lost"
                    ).length
                  }
                </div>
                <div className="small">
                  Результат контакта
                </div>
              </div>
            </div>

            <div className="sourceList">
              <div className="sectionTitle">
                <h2>Источники заявок</h2>
                <span>Отслеживаем с этого запуска</span>
              </div>

              {sourceStats.map((source) => (
                <div className="sourceRow" key={source.source}>
                  <strong>{source.source}</strong>
                  <span>{source.leads} заявок</span>
                  <span>{source.won} сделок</span>
                  <span>{money(source.revenue)} ₽</span>
                </div>
              ))}

              {sourceStats.length === 0 && (
                <div className="empty">
                  Источники появятся после первых заявок.
                </div>
              )}
            </div>
          </section>
        )}

        {tab === "ai" && (
          <section className="section">
            <div className="sectionTitle">
              <h2>AI-диспетчер</h2>
              <span>
                Приоритетные заявки
              </span>
            </div>

            <div className="aiQueue">
              {activeLeads
                .filter(
                  (lead) =>
                    lead.aiScore !== null
                )
                .sort(
                  (a, b) =>
                    Number(b.aiScore || 0) -
                    Number(a.aiScore || 0)
                )
                .slice(0, 12)
                .map((lead) => (
                  <div
                    className="bigCard"
                    key={lead.id}
                  >
                    <div className="aiPriority">
                      <div>
                        <div className="priorityName">
                          {lead.name}
                        </div>

                        <div className="priorityAction">
                          {lead.aiRecommendedAction ||
                            "Нет рекомендации"}
                        </div>
                      </div>

                      <div className="score">
                        {lead.aiScore}/100
                      </div>
                    </div>

                    <button
                      className="button primary"
                      style={{
                        marginTop: 12,
                        width: "100%",
                      }}
                      disabled={
                        busy === lead.id
                      }
                      onClick={() =>
                        analyze(lead)
                      }
                    >
                      AI-анализ
                    </button>
                  </div>
                ))}

              {activeLeads.filter(
                (lead) =>
                  lead.aiScore !== null
              ).length === 0 && (
                <div className="empty">
                  AI ещё не анализировал заявки.
                  Запусти анализ из раздела
                  «Заявки».
                </div>
              )}
            </div>
          </section>
        )}

        {tab === "archive" && (
          <section className="section">
            <div className="sectionTitle">
              <h2>Архив</h2>
              <span>
                {archivedLeads.length} заявок
              </span>
            </div>

            <div className="leads">
              {archivedLeads.map(renderLeadCard)}

              {archivedLeads.length === 0 && (
                <div className="empty">
                  Архив пуст
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
