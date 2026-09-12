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
  new: "РќРѕРІР°??",
  in_progress: "Р’ СЂР°Р±РѕС‚Рµ",
  won: "РЈСЃРїРµС€РЅР°СЏ",
  archived: "РђСЂС…РёРІ",
};

const contactNames: Record<string, string> = {
  not_contacted: "РќРµ СЃРІСЏР·С‹РІР°Р»РёСЃСЊ",
  contacted: "РЎРІСЏР·Р°Р»РёСЃСЊ",
  thinking: "Р”СѓРјР°РµС‚",
  won: "РЎРґРµР»РєР°",
  lost: "РџРѕС‚РµСЂСЏРЅР°",
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

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [selectedLeadHistory, setSelectedLeadHistory] = useState<any[]>([]);
  const [leadCardLoading, setLeadCardLoading] = useState(false);
  const [aiCardLoading, setAiCardLoading] = useState(false);

  useEffect(() => {
    function focusLead(event: Event) {
      const leadId = (event as CustomEvent<string>).detail;
      if (!leadId) return;

      setSelectedLeadId(leadId);

      const element = document.querySelector(
        `[data-lead-id="${leadId}"]`
      );

      if (!element) return;

      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      element.classList.add("crm-lead-focus");

      window.setTimeout(() => {
        element.classList.remove("crm-lead-focus");
      }, 2200);
    }

    window.addEventListener("crm-focus-lead", focusLead);

    return () => {
      window.removeEventListener("crm-focus-lead", focusLead);
    };
  }, []);

  useEffect(() => {
    if (!selectedLeadId) {
      setSelectedLead(null);
      setSelectedLeadHistory([]);
      return;
    }

    let cancelled = false;

    async function loadLeadCard() {
      setLeadCardLoading(true);

      try {
        const response = await fetch(
          `/api/admin/leads/${selectedLeadId}`,
          { cache: "no-store" }
        );

        const result = await response.json();

        if (cancelled) return;

        if (!response.ok || !result.ok) {
          setNotice(result.error || "Рµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РєР°СЂС‚РѕС‡РєСѓ РєР»РёРµРЅС‚Р°");
          return;
        }

        setSelectedLead(result.lead ?? null);
        setSelectedLeadHistory(result.history ?? []);
      } catch (error) {
        if (!cancelled) {
          setNotice(
            error instanceof Error
              ? error.message
              : "С€РёР±РєР° Р·Р°РіСЂСѓР·РєРё РєР°СЂС‚РѕС‡РєРё РєР»РёРµРЅС‚Р°"
          );
        }
      } finally {
        if (!cancelled) {
          setLeadCardLoading(false);
        }
      }
    }

    loadLeadCard();

    return () => {
      cancelled = true;
    };
  }, [selectedLeadId]);

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
          data.error || "РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ"
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

      setNotice("РР·РјРµРЅРµРЅРё?? СЃРѕС…СЂР°РЅРµРЅС‹");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ"
      );
    } finally {
      setBusy(null);
    }
  }

  async function deleteLead(lead: Lead) {
    if (!window.confirm("РґР°Р»РёС‚СЊ Р·Р°Срочно?? РѕРєРѕРЅС‡Р°С‚РµР»СЊРЅРѕ?")) {
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
          data.error || "С€РёР±РєР° СѓРґР°Р»РµРЅРёСЏ"
        );
      }

      setDataLeads((current) =>
        current.filter((item) => item.id !== lead.id)
      );

      setNotice("Р°СЏРІРєР° СѓРґР°Р»РµРЅР°");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "С€РёР±РєР° СѓРґР°Р»РµРЅРёСЏ"
      );
    } finally {
      setBusy(null);
    }
  }

  async function analyzeClientCard() {
  if (!selectedLeadId || !selectedLead) {
    setNotice("ожалуйста, выберите заявку.");
    return;
  }

  setAiCardLoading(true);
  setNotice("");

  try {
    const response = await fetch("/api/ai/analyze-lead", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(selectedLead),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.ok) {
      throw new Error(
        result?.details ||
        result?.error ||
        `AI API error: ${response.status}`
      );
    }

    const ai = result.analysis;

    if (!ai) {
      throw new Error("AI не вернул результат анализа.");
    }

    const saveResponse = await fetch(
      `/api/admin/leads/${selectedLeadId}/ai`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          score: Number(ai.score ?? 0),
          temperature: ai.temperature ?? "warm",
          summary: ai.summary ?? null,
          needs: ai.needs ?? null,
          recommendedAction: ai.recommendedAction ?? null,
          firstReply: ai.firstReply ?? null,
        }),
      }
    );

    const saveResult = await saveResponse.json().catch(() => null);

    if (!saveResponse.ok || !saveResult?.ok) {
      throw new Error(
        saveResult?.error ||
        saveResult?.details ||
        `шибка сохранения AI: ${saveResponse.status}`
      );
    }

    setSelectedLead((current: typeof selectedLead) =>
      current
        ? {
            ...current,
            ai_score: Number(ai.score ?? 0),
            ai_temperature: ai.temperature ?? "warm",
            ai_summary: ai.summary ?? null,
            ai_needs: ai.needs ?? null,
            ai_recommended_action: ai.recommendedAction ?? null,
            ai_first_reply: ai.firstReply ?? null,
          }
        : current
    );

    setNotice("AI-анализ завершён и сохранён.");
  } catch (error) {
    console.error("[AI ANALYSIS]", error);

    setNotice(
      error instanceof Error
        ? `AI-анализ: ${error.message}`
        : "AI-анализ не выполнен."
    );
  } finally {
    setAiCardLoading(false);
  }
}
async function clientAction(
    action: "in_progress" | "contacted" | "thinking" | "won" | "lost"
  ) {
    if (!selectedLeadId) return;

    if (action === "in_progress") {
      await patchLead(selectedLeadId, {
        status: "in_progress",
      });
      return;
    }

    if (action === "contacted") {
      await patchLead(selectedLeadId, {
        contact_result: "contacted",
        status: "in_progress",
      });
      return;
    }

    if (action === "thinking") {
      await patchLead(selectedLeadId, {
        contact_result: "thinking",
        status: "in_progress",
      });
      return;
    }

    if (action === "won") {
      await patchLead(selectedLeadId, {
        contact_result: "won",
        status: "won",
      });
      return;
    }

    await patchLead(selectedLeadId, {
      contact_result: "lost",
    });
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
          data.error || "AI-Р°РЅР°Р»РёР· РЅРµ РІС‹РїРѕР»РЅРµРЅ"
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
            "AI-Р°РЅР°Р»РёР· РїРѕР»СѓС‡РµРЅ, РЅРѕ РЅРµ СЃРѕС…СЂР°РЅС‘РЅ"
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

      setNotice("AI-Р°РЅР°Р»РёР· СЃРѕС…СЂР°РЅС‘РЅ");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "РћС€РёР±РєР° AI-Р°РЅР°Р»РёР·Р°"
      );
    } finally {
      setBusy(null);
    }
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setNotice("РћС‚РІРµС‚ СЃРєРѕРїРёСЂРѕРІР°РЅ");
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
              <h1>Р¦РµРЅС‚СЂ РїСЂРѕРґР°Р¶</h1>
              <div className="subtitle">
                РЈРїСЂР°РІР»РµРЅРёРµ Р·Р°СЏРІРєР°РјРё Рё AI-Р°РЅР°Р»РёС‚РёРєР°
              </div>
            </div>
          </div>

          <button
            className="button"
            onClick={() => router.refresh()}
          >
            РћР±РЅРѕРІРёС‚СЊ
          </button>
        </header>

        {initialError && (
          <div className="notice error">
            РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё: {initialError}
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
              Р’РЎР•Р“Рћ Р—РђРЇР’РћРљ
            </div>
            <div className="statValue">
              {stats.total}
            </div>
            <div className="statHint">
              Р’ CRM
            </div>
          </div>

          <div className="stat">
            <div className="statLabel">
              РќРћР’Р«Р•
            </div>
            <div className="statValue">
              {stats.fresh}
            </div>
            <div className="statHint">
              РўСЂРµР±СѓСЋС‚ РѕР±СЂР°Р±РѕС‚РєРё
            </div>
          </div>

          <div className="stat">
            <div className="statLabel">
              Р’ Р РђР‘РћРўР•
            </div>
            <div className="statValue">
              {stats.working}
            </div>
            <div className="statHint">
              РђРєС‚РёРІРЅС‹Рµ
            </div>
          </div>

          <div className="stat">
            <div className="statLabel">
              РЈРЎРџР•РЁРќР«Р•
            </div>
            <div className="statValue">
              {stats.won}
            </div>
            <div className="statHint">
              РљРѕРЅРІРµСрочно?? {stats.conversion}%
            </div>
          </div>

          <div className="stat">
            <div className="statLabel">
              Р“РћР РЇР§РР•
            </div>
            <div className="statValue">
              {stats.hot}
            </div>
            <div className="statHint">
              РџРѕ РѕС†РµРЅРєРµ AI
            </div>
          </div>

          <div className="stat">
            <div className="statLabel">
              Р’Р«Р РЈР§РљРђ
            </div>
            <div className="statValue">
              {money(stats.revenue)}
            </div>
            <div className="statHint">
              Р СѓР±Р»Рё
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
            placeholder="РџРѕРё???? РїРѕ РёРјРµРЅРё, РєРѕРјРїР°РЅРёРё, РєРѕРЅС‚Р°РєС‚Сѓ РёР»Рё РЅРёС€Рµ"
          />

          <select
            className="select"
            value={filter}
            onChange={(e) =>
              setFilter(e.target.value)
            }
          >
            <option value="all">
              Р’СЃРµ Р·Р°Срочно??
            </option>
            <option value="new">
              РќРѕРІС‹Рµ
            </option>
            <option value="in_progress">
              Р’ СЂР°Р±РѕС‚Рµ
            </option>
            <option value="won">
              РЈСЃРїРµС€РЅС‹Рµ
            </option>
            <option value="archived">
              РђСЂС…РёРІ
            </option>
            <option value="hot">
              Р“РѕСЂСЏС‡РёРµ AI
            </option>
            <option value="warm">
              РўС‘РїР»С‹Рµ AI
            </option>
            <option value="cold">
              РҐРѕР»РѕРґРЅС‹Рµ AI
            </option>
          </select>

          <button
            className="button"
            onClick={() => {
              setSearch("");
              setFilter("all");
            }}
          >
            РЎР±СЂРѕСЃРёС‚СЊ
          </button>
        </div>

        <div className="heading">
          <h2>Р—Р°Срочно??</h2>
          <span>
            {leads.length} РёР· {dataLeads.length}
          </span>
        </div>

        <AiDispatcher />

        {selectedLeadId && (
         <section className="clientCard">
           {leadCardLoading ? (
             <div className="clientCardLoading">
               Р°РіСЂСѓР·РєР° РєР°СЂС‚РѕС‡РєРё РєР»РёРµРЅС‚Р°...
             </div>
           ) : selectedLead ? (
             <>
               <div className="clientCardHeader">
                 <div>
                   <div className="clientCardEyebrow">Рў</div>
                   <h2>{selectedLead.name}</h2>
                   <p>
                     {selectedLead.company || "РµР· РєРѕРјРїР°РЅРёРё"} В·{" "}
                     {selectedLead.niche || "РёС€Р° РЅРµ СѓРєР°Р·Р°РЅР°"}
                   </p>
                 </div>

                 <button
                   type="button"
                   className="clientCardClose"
                   onClick={() => {
                     setSelectedLeadId(null);
                     setSelectedLead(null);
                     setSelectedLeadHistory([]);
                   }}
                 >
                   Р°РєСЂС‹С‚СЊ
                 </button>
               </div>

               <div className="clientCardGrid">
                 <div className="clientCardItem">
                   <span>РѕРЅС‚Р°РєС‚</span>
                   <strong>{selectedLead.contact || "—"}</strong>
                 </div>

                 <div className="clientCardItem">
                   <span>РЎС‚Р°С‚СѓСЃ</span>
                   <strong>{selectedLead.status || "—"}</strong>
                 </div>

                 <div className="clientCardItem">
                   <span>РµР·СѓР»СЊС‚Р°С‚ РєРѕРЅС‚Р°РєС‚Р°</span>
                   <strong>{selectedLead.contact_result || "—"}</strong>
                 </div>

                 <div className="clientCardItem">
                   <span>РЎСѓРјРјР° СЃРґРµР»РєРё</span>
                   <strong>
                     {Number(selectedLead.deal_amount || 0).toLocaleString(
                       "ru-RU"
                     )}{" "}
                     
                   </strong>
                 </div>

                 <div className="clientCardItem">
                   <span>РЎРѕР·РґР°РЅ</span>
                   <strong>
                     {selectedLead.created_at
                       ? new Date(selectedLead.created_at).toLocaleString(
                           "ru-RU"
                         )
                       : "—"}
                   </strong>
                 </div>
               </div>

               <div className="clientCardActions">
                <button
                  type="button"
                  onClick={() => clientAction("in_progress")}
                  disabled={busy === selectedLeadId}
                >
                   СЂР°Р±РѕС‚Сѓ
                </button>

                <button
                  type="button"
                  onClick={() => clientAction("contacted")}
                  disabled={busy === selectedLeadId}
                >
                  РЎРІСЏР·Р°Р»РёСЃСЊ
                </button>

                <button
                  type="button"
                  onClick={() => clientAction("thinking")}
                  disabled={busy === selectedLeadId}
                >
                  СѓРјР°РµС‚
                </button>

                <button
                  type="button"
                  onClick={() => clientAction("won")}
                  disabled={busy === selectedLeadId}
                >
                  РЎРґРµР»РєР°
                </button>

                <button
                  type="button"
                  onClick={() => clientAction("lost")}
                  disabled={busy === selectedLeadId}
                >
                  РѕС‚РµСЂСЏРЅР°
                </button>
              </div>
              <div className="clientCardSection">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"12px"}}>
                  <h3>AI-Р°РЅР°Р»РёР·</h3>
                  <button
                    type="button"
                    className="button primary"
                    onClick={analyzeClientCard}
                    disabled={aiCardLoading}
                  >
                    {aiCardLoading ? "AI Р°РЅР°Р»РёР·РёСЂСѓРµС‚..." : "Р°РїСѓСЃС‚РёС‚СЊ AI-Р°РЅР°Р»РёР·"}
                  </button>
                </div>

                <div className="clientCardGrid">
                  <div className="clientCardItem">
                    <span>С†РµРЅРєР°</span>
                    <strong>{selectedLead.ai_score ?? "—"}/100</strong>
                  </div>

                  <div className="clientCardItem">
                    <span>РўРµРјРїРµСЂР°С‚СѓСЂР°</span>
                    <strong>{selectedLead.ai_temperature || "—"}</strong>
                  </div>

                  <div className="clientCardItem">
                    <span>СЂР°С‚РєРёР№ Р°РЅР°Р»РёР·</span>
                    <strong>{selectedLead.ai_summary || "—"}</strong>
                  </div>

                  <div className="clientCardItem">
                    <span>РѕС‚СЂРµР±РЅРѕСЃС‚Рё</span>
                    <strong>{selectedLead.ai_needs || "—"}</strong>
                  </div>

                  <div className="clientCardItem">
                    <span>РµРєРѕРјРµРЅРґР°С†РёСЏ</span>
                    <strong>{selectedLead.ai_recommended_action || "—"}</strong>
                  </div>

                  <div className="clientCardItem">
                    <span>РµСЂРІС‹Р№ РѕС‚РІРµС‚</span>
                    <strong>{selectedLead.ai_first_reply || "—"}</strong>
                  </div>
                </div>
              </div>
              <div className="clientCardSection">
                 <h3>СЃС‚РѕСЂРёСЏ</h3>

                 {selectedLeadHistory.length === 0 ? (
                   <div className="clientCardEmpty">
                     СЃС‚РѕСЂРёСЏ РёР·РјРµРЅРµРЅРёР№ РїРѕРєР° РїСѓСЃС‚Р°.
                   </div>
                 ) : (
                   <div className="clientHistory">
                     {selectedLeadHistory.map((item) => (
                       <div className="clientHistoryRow" key={item.id}>
                         <div>
                           <strong>{item.action}</strong>
                           <div>
                             {item.old_value || "—"} в†’{" "}
                             {item.new_value || "—"}
                           </div>
                         </div>

                         <time>
                           {item.created_at
                             ? new Date(item.created_at).toLocaleString(
                                 "ru-RU"
                               )
                             : "—"}
                         </time>
                       </div>
                     ))}
                   </div>
                 )}
               </div>
             </>
           ) : (
             <div className="clientCardEmpty">
               Рµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РєР»РёРµРЅС‚Р°.
             </div>
           )}
         </section>
       )}
       <section className="leads">
          {leads.length === 0 && (
            <div className="empty">
              Р—Р°Срочно?? РЅРµ РЅР°Р№РґРµРЅРѕ
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
                .toUpperCase() || "Рљ";

            const temperatureClass =
              lead.aiTemperature || "";

            return (
              <article
                className="lead"
                key={lead.id}
                data-lead-id={lead.id}
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
                        {" В· "}
                        {lead.niche ||
                          "РќРёС€Р° РЅРµ СѓРєР°Р·Р°РЅР°"}
                        {" В· "}
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
                          ? "Р“РѕСЂСЏС‡Р°СЏ"
                          : lead.aiTemperature ===
                              "warm"
                            ? "РўС‘РїР»Р°СЏ"
                            : "РҐРѕР»РѕРґРЅР°??"}
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
                        AI-СЂРµРєРѕРјРµРЅРґР°С†РёСЏ
                      </div>

                      <div className="text">
                        {lead.aiRecommendedAction ||
                          "AI-Р°РЅР°Р»РёР· РµС‰С‘ РЅРµ РІС‹РїРѕР»РЅРµРЅ."}
                      </div>

                      {lead.aiScore !== null && (
                        <div className="aiGrid">
                          <div className="ai">
                            <div className="label">
                              Р РµР·СЋРјРµ
                            </div>
                            <div className="text">
                              {lead.aiSummary ||
                                "РќРµС‚ РґР°РЅРЅС‹С…"}
                            </div>
                          </div>

                          <div className="ai">
                            <div className="label">
                              РџРѕС‚СЂРµР±РЅРѕСЃС‚СЊ
                            </div>
                            <div className="text">
                              {lead.aiNeeds ||
                                "РќРµС‚ РґР°РЅРЅС‹С…"}
                            </div>
                          </div>

                          <div className="ai">
                            <div className="label">
                              РЎР»РµРґСѓСЋС‰РёР№ С€Р°Рі
                            </div>
                            <div className="text">
                              {lead.aiRecommendedAction ||
                                "РќРµС‚ РґР°РЅРЅС‹С…"}
                            </div>
                          </div>

                          <div className="ai">
                            <div className="label">
                              РљРѕРЅС‚Р°РєС‚
                            </div>
                            <div className="text">
                              {lead.contactResult
                                ? contactNames[
                                    lead
                                      .contactResult
                                  ] ||
                                  lead.contactResult
                                : "РќРµ СѓРєР°Р·Р°РЅ"}
                            </div>
                          </div>

                          {lead.aiFirstReply && (
                            <div className="ai reply">
                              <div className="label">
                                Р“РѕС‚РѕРІС‹Р№ РѕС‚РІРµС‚ РєР»РёРµРЅС‚Сѓ
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
                                РЎРєРѕРїРёСЂРѕРІР°С‚СЊ
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
                          РЎС‚Р°С‚СѓСЃ
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
                            РќРѕРІР°??
                          </option>
                          <option value="in_progress">
                            Р’ СЂР°Р±РѕС‚Рµ
                          </option>
                          <option value="won">
                            РЈСЃРїРµС€РЅР°СЏ
                          </option>
                          <option value="archived">
                            РђСЂС…РёРІ
                          </option>
                        </select>
                      </div>

                      <div className="control">
                        <label>
                          Р РµР·СѓР»СЊС‚Р°С‚ РєРѕРЅС‚Р°РєС‚Р°
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
                            РќРµ СЃРІСЏР·С‹РІР°Р»РёСЃСЊ
                          </option>
                          <option value="contacted">
                            РЎРІСЏР·Р°Р»РёСЃСЊ
                          </option>
                          <option value="thinking">
                            Р”СѓРјР°РµС‚
                          </option>
                          <option value="won">
                            РЎРґРµР»РєР°
                          </option>
                          <option value="lost">
                            РџРѕС‚РµСЂСЏРЅР°
                          </option>
                        </select>
                      </div>

                      <div className="control">
                        <label>
                          РЎСѓРјРјР° СЃРґРµР»РєРё
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
                          ? "AI СЂР°Р±РѕС‚Р°РµС‚..."
                          : lead.aiScore === null
                            ? "Р—Р°РїСѓСЃС‚РёС‚СЊ AI-Р°РЅР°Р»РёР·"
                            : "РџРѕРІС‚РѕСЂРёС‚СЊ AI-Р°РЅР°Р»РёР·"}
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
                            РЎСѓРјРјР° СЃРґРµР»РєРё
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













