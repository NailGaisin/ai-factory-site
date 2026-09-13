import { NextResponse } from "next/server";
import { after } from "next/server";
import { validateLead } from "@/lib/leads";
import {
  createAutomaticSalesAnalysis,
  type LeadAnalysis,
} from "@/lib/lead-analysis";
import { getAdminSupabase, publicSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const requestLimits = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientId =
    forwardedFor?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (clientId === "unknown") {
    return false;
  }

  const now = Date.now();
  const current = requestLimits.get(clientId);

  if (!current || current.resetAt <= now) {
    requestLimits.set(clientId, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return false;
  }

  current.count += 1;
  return current.count > RATE_LIMIT_MAX_REQUESTS;
}

type AiAnalysis = LeadAnalysis;

type LeadAttribution = {
  leadSource: "direct" | "referral" | "utm";
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
};

function shouldUseAutomaticAnalysis() {
  // Local Ollama is only reachable during development. A production deploy
  // must be given an explicit remote model URL; otherwise use the built-in,
  // immediate and deterministic qualification instead of waiting for a port
  // that does not exist on Netlify.
  return (
    process.env.AI_ANALYSIS_ENABLED === "false" ||
    (process.env.NODE_ENV === "production" && !process.env.OLLAMA_BASE_URL)
  );
}

function isAIAnalysisEnabled() {
  return !shouldUseAutomaticAnalysis();
}

function trackingValue(value: unknown) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim().slice(0, 120);
  return trimmed || null;
}

function getLeadAttribution(
  body: unknown,
  request: Request
): LeadAttribution {
  const value = body && typeof body === "object"
    ? (body as Record<string, unknown>)
    : {};
  const utmSource = trackingValue(value.utmSource);
  const requestedSource = trackingValue(value.leadSource);
  const leadSource =
    requestedSource === "utm" ||
    requestedSource === "referral" ||
    requestedSource === "direct"
      ? requestedSource
      : utmSource
        ? "utm"
        : request.headers.get("referer")
          ? "referral"
          : "direct";

  return {
    leadSource,
    utmSource,
    utmMedium: trackingValue(value.utmMedium),
    utmCampaign: trackingValue(value.utmCampaign),
  };
}

async function analyzeLeadWithAI(input: {
  name: string;
  company: string;
  contact: string;
  niche: string;
}): Promise<AiAnalysis> {
  if (shouldUseAutomaticAnalysis()) {
    return createAutomaticSalesAnalysis(input);
  }

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 90_000);

  try {
    const ollamaBaseUrl =
      process.env.OLLAMA_BASE_URL?.replace(/\/+$/, "") ||
      "http://localhost:11434";
    const response = await fetch(
      `${ollamaBaseUrl}/api/generate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: process.env.OLLAMA_MODEL || "qwen3:1.7b",
          stream: false,
          think: false,
          format: "json",
          options: {
            num_predict: 220,
            temperature: 0.2,
          },
          prompt: `
Ты AI-аналитик отдела продаж.

Проанализируй новую заявку клиента.

Данные клиента:
Имя: ${input.name}
Компания: ${input.company}
Контакт: ${input.contact}
Ниша: ${input.niche}

Верни только JSON:

{
  "score": 0,
  "temperature": "hot",
  "summary": "краткое резюме клиента",
  "needs": "что клиенту может быть нужно",
  "recommendedAction": "следующий шаг менеджера",
  "firstReply": "готовый первый ответ клиенту"
}

Правила:
1. Весь текст должен быть только на русском языке.
2. Не используй китайские, корейские, японские и другие иероглифы.
3. Не придумывай факты, которых нет в заявке.
4. Не придумывай товары, цены, скидки или условия.
5. Если данных недостаточно, firstReply должен содержать короткий уточняющий вопрос.
6. firstReply должен быть готов для отправки клиенту.
7. Не добавляй текст вне JSON.

score:
0-39 = cold
40-74 = warm
75-100 = hot
`,
        }),
      }
    );

    if (!response.ok) {
      console.error(
        "Ollama error:",
        response.status
      );
      return createAutomaticSalesAnalysis(input);
    }

    const data = await response.json();

    if (!data.response) {
      return createAutomaticSalesAnalysis(input);
    }

    const parsed = JSON.parse(data.response);

    const score = Number(parsed.score);

    if (
      !Number.isFinite(score) ||
      score < 0 ||
      score > 100 ||
      !["hot", "warm", "cold"].includes(
        parsed.temperature
      )
    ) {
      return createAutomaticSalesAnalysis(input);
    }

    return {
      score: Math.round(score),
      temperature: parsed.temperature,
      summary: String(parsed.summary ?? ""),
      needs: String(parsed.needs ?? ""),
      recommendedAction: String(
        parsed.recommendedAction ?? ""
      ),
      firstReply: String(
        parsed.firstReply ?? ""
      ),
    };
  } catch (error) {
    console.error(
      "AI analysis error:",
      error
    );
    // Netlify cannot reach a model running on the developer's computer.
    // A lead must still receive a useful, saved analysis when that happens.
    return createAutomaticSalesAnalysis(input);
  } finally {
    clearTimeout(timeout);
  }
}

async function sendTelegram(
  input: {
    name: string;
    company: string;
    contact: string;
    niche: string;
  },
  ai: AiAnalysis | null,
  attribution: LeadAttribution
): Promise<boolean> {
  const token =
    process.env.TELEGRAM_BOT_TOKEN;

  const chatId =
    process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.error("Telegram is not configured.");
    return false;
  }

  let message =
    `🔥 НОВАЯ ЗАЯВКА\n\n` +
    `Имя: ${input.name}\n` +
    `Компания: ${input.company}\n` +
    `Контакт: ${input.contact}\n` +
    `Ниша: ${input.niche}\n` +
    `Источник: ${attribution.leadSource}\n`;

  if (ai) {
    message +=
      `\n📊 ОЦЕНКА: ${ai.temperature.toUpperCase()}\n` +
      `Оценка: ${ai.score}/100\n\n` +
      `Резюме: ${ai.summary}\n` +
      `Потребность: ${ai.needs}\n` +
      `Следующий шаг: ${ai.recommendedAction}\n\n` +
      `Первый ответ:\n${ai.firstReply}`;
  } else if (isAIAnalysisEnabled()) {
    message +=
      "\n🤖 AI-анализ запускается. Результат придёт следующим сообщением.";
  } else {
    message +=
      "\n📊 Автоматическая оценка будет сохранена в CRM.";
  }

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 3000);

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
        }),
      }
    );

    if (!response.ok) {
      console.error(
        "Telegram notification error:",
        response.status,
        await response.text()
      );
      return false;
    }

    const result = await response.json().catch(() => null);
    return result?.ok === true;
  } catch (error) {
    console.error(
      "Telegram notification error:",
      error
    );
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function processAI(
  leadId: string,
  input: {
    name: string;
    company: string;
    contact: string;
    niche: string;
  },
  attribution: LeadAttribution
) {
  const ai =
    await analyzeLeadWithAI(input);

  if (!ai) {
    return;
  }

  const writeClient = getAdminSupabase() ?? publicSupabase;

  if (!writeClient) {
    await sendTelegram(input, ai, attribution);
    return;
  }

  const { error } =
    await writeClient
      .from("leads")
      .update({
        ai_score: ai.score,
        ai_temperature: ai.temperature,
        ai_summary: ai.summary,
        ai_needs: ai.needs,
        ai_recommended_action:
          ai.recommendedAction,
        ai_first_reply: ai.firstReply,
      })
      .eq("id", leadId);

  if (error) {
    console.error(
      "AI save error:",
      error
    );
  }

  await sendTelegram(input, ai, attribution);
}

export async function POST(request: Request) {
  if (isRateLimited(request)) {
    return NextResponse.json(
      {
        error: "Слишком много заявок. Попробуйте через несколько минут.",
      },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const input = validateLead(body);

  if (!input) {
    return NextResponse.json(
      {
        error: "Заполните все поля корректно.",
      },
      { status: 400 }
    );
  }

  const attribution = getLeadAttribution(body, request);

  if (!publicSupabase) {
    return NextResponse.json(
      {
        error: "Supabase ещё не настроен.",
      },
      { status: 503 }
    );
  }

  const leadId = crypto.randomUUID();

  const { error } = await publicSupabase
    .from("leads")
    .insert({
      id: leadId,
      ...input,
      lead_source: attribution.leadSource,
      utm_source: attribution.utmSource,
      utm_medium: attribution.utmMedium,
      utm_campaign: attribution.utmCampaign,
    });

  if (error) {
    console.error(
      "Supabase addLead error:",
      error
    );

    return NextResponse.json(
      {
        error: "Не удалось сохранить заявку.",
      },
      { status: 500 }
    );
  }

  // Сначала гарантированно отправляем уведомление о новой заявке.
  // AI-результат придёт следующим сообщением, когда будет готов.
  const notificationSent = await sendTelegram(input, null, attribution);

  after(() => processAI(leadId, input, attribution));

  return NextResponse.json(
    {
      ok: true,
      leadId,
      ai: null,
      notificationSent,
      message: "Заявка успешно отправлена.",
    },
    { status: 201 }
  );
}
