export type LeadAnalysis = {
  score: number;
  temperature: "hot" | "warm" | "cold";
  summary: string;
  needs: string;
  recommendedAction: string;
  firstReply: string;
};

export type LeadAnalysisInput = {
  name: string;
  company: string;
  contact: string;
  niche: string;
  message?: string;
};

function customerName(name: string) {
  const firstName = name.trim().split(/\s+/)[0];
  return firstName || "Здравствуйте";
}

/**
 * A no-cost fallback for the cloud deployment. It deliberately only uses
 * information supplied in the lead and never invents a budget or a need.
 */
export function createAutomaticSalesAnalysis(
  input: LeadAnalysisInput
): LeadAnalysis {
  const name = input.name.trim();
  const company = input.company.trim();
  const contact = input.contact.trim();
  const niche = input.niche.trim();
  const message = input.message?.trim() ?? "";

  let score = 20;
  if (name) score += 10;
  if (contact) score += 15;
  if (company) score += 20;
  if (niche) score += 20;
  if (message.length >= 20) score += 15;

  score = Math.min(score, 100);

  const temperature =
    score >= 75 ? "hot" : score >= 50 ? "warm" : "cold";

  const knownDetails = [
    company && `компания: ${company}`,
    niche && `ниша: ${niche}`,
    contact && "контакт указан",
  ].filter(Boolean);

  const summary = knownDetails.length
    ? `В заявке указаны ${knownDetails.join(", ")}.`
    : "В заявке недостаточно данных для приоритизации.";

  const needs = niche
    ? `Нужно уточнить задачу бизнеса в нише «${niche}» и ожидаемый результат.`
    : "Нужно уточнить нишу, задачу бизнеса и ожидаемый результат.";

  const recommendedAction =
    company || niche
      ? "Связаться в течение рабочего дня, уточнить текущий процесс продаж, объём обращений и главную задачу."
      : "Сначала уточнить сферу бизнеса, текущую задачу и удобный способ связи.";

  const firstReply = `Здравствуйте${
    name ? `, ${customerName(name)}` : ""
  }! Спасибо за заявку. Чтобы предложить подходящее решение, подскажите, какую задачу в продажах вы хотите решить в первую очередь и сколько обращений получаете в месяц?`;

  return {
    score,
    temperature,
    summary,
    needs,
    recommendedAction,
    firstReply,
  };
}
