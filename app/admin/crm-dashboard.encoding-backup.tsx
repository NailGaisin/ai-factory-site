"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AiDispatcher from "./ai-dispatcher";

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
};

type Props = {
  initialLeads: Lead[];
  initialError: string | null;
};

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
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export default function CrmDashboard({
  initialLeads,
  initialError,
}: Props) {
  const router = useRouter();

  const [dataLeads, setDataLeads] =
    useState<Lead[]>(initialLeads);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const stats = useMemo(() => {
    const total = dataLeads.length;
    const fresh = dataLeads.filter(
      (x) => x.status === "new"
    ).length;
    const working = dataLeads.filter(
      (x) => x.status === "in_progress"
    ).length;
    const won = dataLeads.filter(
      (x) => x.status === "won"
    ).length;
    const hot = dataLeads.filter(
      (x) => x.aiTemperature === "hot"
    ).length;
    const revenue = dataLeads
      .filter((x) => x.status === "won")
      .reduce((sum, x) => sum + x.dealAmount, 0);

    return {
      total,
      fresh,
      working,
      won,
      hot,
      revenue,
      conversion: total
        ? Math.round((won / total) * 100)
        : 0,
    };
  }, [dataLeads]);

  const leads = useMemo(() => {
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
        filter === lead.aiTemperature;

      return searchOk && filterOk;
    });
  }, [dataLeads, search, filter]);

  async function patchLead(
    id: string,
    body: Record<string, unknown>
  ) {
    setBusy(id);
    setNotice("");

    try {
      const response = await fetch(
        `/api/admin/leads/${id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error || "Не удалось сохранить"
        );
      }

      setDataLeads((current) =>
        current.map((lead) => {
          if (lead.id !== id) {
            return lead;
          }

          return {
            ...lead,
            ...(body.status !== undefined
              ? {
                  status:
                    body.status as Lead["status"],
                }
              : {}),
            ...(body.contact_result !== undefined
              ? {
                  contactResult:
                    body.contact_result as string,
                }
              : {}),
            ...(body.deal_amount !== undefined
              ? {
                  dealAmount:
                    Number(body.deal_amount),
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

  async function deleteLead(lead: Lead) {
    if (!window.confirm("далить заявку окончательно?")) {
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
        throw new Error(
          data.error || "шибка удаления"
        );
      }

      setDataLeads((current) =>
        current.filter((item) => item.id !== lead.id)
      );

      setNotice("аявка удалена");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "шибка удаления"
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
  async function analyze(lead: Lead) {
    setBusy(lead.id);
    setNotice("");

    try {
      const response = await fetch(
        "/api/ai/analyze-lead",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            lead: {
              id: lead.id,
              name: lead.name,
              company: lead.company,
              contact: lead.contact,
              niche: lead.niche,
            },
          }),
        }
      );

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
                aiTemperature:
                  analysis.temperature,
                aiSummary:
                  analysis.summary ?? null,
                aiNeeds:
                  analysis.needs ?? null,
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

  return (
    <main className="crm">
      

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
                Управление заявками и AI-аналитика
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

        {initialError && (
          <div className="notice error">
            Ошибка загрузки: {initialError}
          </div>
        )}

        {notice && (
          <div className="notice">
            {notice}
          </div>
        )}

        <section className="stats">
          <div className="stat">
            <div className="statLabel">
              ВСЕГО ЗАЯВОК
            </div>
            <div className="statValue">
              {stats.total}
            </div>
            <div className="statHint">
              В CRM
            </div>
          </div>

          <div className="stat">
            <div className="statLabel">
              НОВЫЕ
            </div>
            <div className="statValue">
              {stats.fresh}
            </div>
            <div className="statHint">
              Требуют обработки
            </div>
          </div>

          <div className="stat">
            <div className="statLabel">
              В РАБОТЕ
            </div>
            <div className="statValue">
              {stats.working}
            </div>
            <div className="statHint">
              Активные
            </div>
          </div>

          <div className="stat">
            <div className="statLabel">
              УСПЕШНЫЕ
            </div>
            <div className="statValue">
              {stats.won}
            </div>
            <div className="statHint">
              Конверсия {stats.conversion}%
            </div>
          </div>

          <div className="stat">
            <div className="statLabel">
              ГОРЯЧИЕ
            </div>
            <div className="statValue">
              {stats.hot}
            </div>
            <div className="statHint">
              По оценке AI
            </div>
          </div>

          <div className="stat">
            <div className="statLabel">
              ВЫРУЧКА
            </div>
            <div className="statValue">
              {money(stats.revenue)}
            </div>
            <div className="statHint">
              Рубли
            </div>
          </div>
        </section>

        <div className="toolbar">
          <input
            className="input"
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Поиск по имени, компании, контакту или нише"
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
            <option value="new">
              Новые
            </option>
            <option value="in_progress">
              В работе
            </option>
            <option value="won">
              Успешные
            </option>
            <option value="archived">
              Архив
            </option>
            <option value="hot">
              Горячие AI
            </option>
            <option value="warm">
              Тёплые AI
            </option>
            <option value="cold">
              Холодные AI
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

        <div className="heading">
          <h2>Заявки</h2>
          <span>
            {leads.length} из {dataLeads.length}
          </span>
        </div>

        <AiDispatcher />`r`n`r`n        <section className="leads">
          {leads.length === 0 && (
            <div className="empty">
              Заявок не найдено
            </div>
          )}

          {leads.map((lead) => {
            const initials =
              lead.name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((x) => x[0])
                .join("")
                .toUpperCase() || "К";

            const temperatureClass =
              lead.aiTemperature || "";

            return (
              <article
                className="lead"
                key={lead.id}
              >
                <div className="leadHeader">
                  <div className="person">
                    <div className="avatar">
                      {initials}
                    </div>

                    <div>
                      <div className="name">
                        {lead.name}
                      </div>

                      {lead.company && (
                        <div className="company">
                          {lead.company}
                        </div>
                      )}

                      <div className="meta">
                        {lead.contact}
                        {" · "}
                        {lead.niche ||
                          "Ниша не указана"}
                        {" · "}
                        {date(lead.createdAt)}
                      </div>
                    </div>
                  </div>

                  <div className="badges">
                    <span className="badge">
                      {statusNames[lead.status]}
                    </span>

                    {lead.aiTemperature && (
                      <span
                        className={`badge ${temperatureClass}`}
                      >
                        {lead.aiTemperature ===
                        "hot"
                          ? "Горячая"
                          : lead.aiTemperature ===
                              "warm"
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
                  <div>
                    <div className="panel">
                      <div className="label">
                        AI-рекомендация
                      </div>

                      <div className="text">
                        {lead.aiRecommendedAction ||
                          "AI-анализ ещё не выполнен."}
                      </div>

                      {lead.aiScore !== null && (
                        <div className="aiGrid">
                          <div className="ai">
                            <div className="label">
                              Резюме
                            </div>
                            <div className="text">
                              {lead.aiSummary ||
                                "Нет данных"}
                            </div>
                          </div>

                          <div className="ai">
                            <div className="label">
                              Потребность
                            </div>
                            <div className="text">
                              {lead.aiNeeds ||
                                "Нет данных"}
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

                          <div className="ai">
                            <div className="label">
                              Контакт
                            </div>
                            <div className="text">
                              {lead.contactResult
                                ? contactNames[
                                    lead
                                      .contactResult
                                  ] ||
                                  lead.contactResult
                                : "Не указан"}
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
                                style={{
                                  marginTop: 10,
                                }}
                                onClick={() =>
                                  copy(
                                    lead.aiFirstReply!
                                  )
                                }
                              >
                                Скопировать
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <aside className="panel">
                    <div className="controls">
                      <div className="control">
                        <label>
                          Статус
                        </label>

                        <select
                          value={lead.status}
                          disabled={
                            busy === lead.id
                          }
                          onChange={(e) =>
                            patchLead(
                              lead.id,
                              {
                                status:
                                  e.target.value,
                              }
                            )
                          }
                        >
                          <option value="new">
                            Новая
                          </option>
                          <option value="in_progress">
                            В работе
                          </option>
                          <option value="won">
                            Успешная
                          </option>
                          <option value="archived">
                            Архив
                          </option>
                        </select>
                      </div>

                      <div className="control">
                        <label>
                          Результат контакта
                        </label>

                        <select
                          value={
                            lead.contactResult ??
                            "not_contacted"
                          }
                          disabled={
                            busy === lead.id
                          }
                          onChange={(e) =>
                            patchLead(
                              lead.id,
                              {
                                contact_result:
                                  e.target.value,
                              }
                            )
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
                          <option value="won">
                            Сделка
                          </option>
                          <option value="lost">
                            Потеряна
                          </option>
                        </select>
                      </div>

                      <div className="control">
                        <label>
                          Сумма сделки
                        </label>

                        <input
                          type="number"
                          min="0"
                          step="1000"
                          defaultValue={
                            lead.dealAmount
                          }
                          onBlur={(e) => {
                            const value =
                              Number(
                                e.target.value
                              );

                            if (
                              Number.isFinite(
                                value
                              ) &&
                              value !==
                                lead.dealAmount
                            ) {
                              patchLead(
                                lead.id,
                                {
                                  deal_amount:
                                    value,
                                }
                              );
                            }
                          }}
                        />
                      </div>

                      <button
                        className="button primary"
                        disabled={
                          busy === lead.id
                        }
                        onClick={() =>
                          analyze(lead)
                        }
                      >
                        {busy === lead.id
                          ? "AI работает..."
                          : lead.aiScore === null
                            ? "Запустить AI-анализ"
                            : "Повторить AI-анализ"}
                      </button>

                      {lead.dealAmount > 0 && (
                        <div
                          style={{
                            marginTop: 5,
                            paddingTop: 12,
                            borderTop:
                              "1px solid #202836",
                          }}
                        >
                          <div className="label">
                            Сумма сделки
                          </div>
                          <div
                            style={{
                              fontSize: 22,
                              fontWeight: 850,
                            }}
                          >
                            {money(
                              lead.dealAmount
                            )}{" "}
                            ₽
                          </div>
                        </div>
                      )}
                    </div>
                  </aside>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}











