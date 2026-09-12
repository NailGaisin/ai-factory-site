export type LeadInput = {
  name: string;
  company: string;
  contact: string;
  niche: string;
};

export const leadStatuses = ["new", "in_progress", "won", "archived"] as const;
export type LeadStatus = (typeof leadStatuses)[number];

export function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && leadStatuses.includes(value as LeadStatus);
}

export type Lead = LeadInput & {
  id: string;
  createdAt: string;
  status: LeadStatus;
};

export function validateLead(input: unknown): LeadInput | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  const fields = ["name", "company", "contact", "niche"] as const;
  if (fields.some((field) => typeof value[field] !== "string")) return null;

  const lead = Object.fromEntries(
    fields.map((field) => [field, (value[field] as string).trim()])
  ) as LeadInput;

  if (fields.some((field) => !lead[field] || lead[field].length > 500)) return null;
  return lead;
}
