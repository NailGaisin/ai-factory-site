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
      <style jsx>{`
        .crm {
          min-height: 100vh;
          background: #070a0f;
          color: #f4f6f8;
          padding: 18px 24px 40px;
          font-family:
            Inter, Arial, sans-serif;
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

        .overline {
          color: #737d8d;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .15em;
          text-transform: uppercase;
        }

        h1 {
          margin: 3px 0 0;
          font-size: 24px;
          letter-spacing: -.04em;
        }

        .subtitle {
          color: #7e8898;
          font-size: 14px;
          margin-top: 4px;
        }

        button,
        input,
        select {
          font: inherit;
        }

        button {
          cursor: pointer;
        }

        .button {
          border: 1px solid #2a3342;
          background: #111620;
          color: #eef1f5;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 12px;
          font-weight: 750;
        }

        .button:hover {
          background: #181f2b;
        }

        .button.primary {
          background: #fff;
          color: #080a0f;
          border-color: #fff;
        }

        .stats {
          display: grid;
          grid-template-columns:
            repeat(6, 1fr);
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
          font-size: 12px;
          margin-bottom: 8px;
        }

        .statValue {
          font-size: 22px;
          font-weight: 850;
          letter-spacing: -.03em;
        }

        .statHint {
          color: #596475;
          font-size: 10px;
          margin-top: 5px;
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

        .toolbar {
          display: grid;
          grid-template-columns: 1fr 190px 120px;
          gap: 10px;
          margin-bottom: 22px;
        }

        .input,
        .select {
          box-sizing: border-box;
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

        .heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 11px;
        }

        .heading h2 {
          margin: 0;
          font-size: 18px;
        }

        .heading span {
          color: #697486;
          font-size: 12px;
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
          color: #dfe4eb;
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
          color: #687486;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .08em;
          text-transform: uppercase;
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
        .control input {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #293343;
          background: #151b25;
          color: #e8edf3;
          border-radius: 8px;
          padding: 9px;
          font-size: 12px;
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

        <section className="leads">
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
                            ?
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









