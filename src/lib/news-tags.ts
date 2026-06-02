import { classifyHeadline } from "@/lib/headline-classifier";

export type NewsLabel =
  | "MUST KNOW"
  | "HIGH IMPACT"
  | "MACRO"
  | "GEO"
  | "EARNINGS"
  | "DATA"
  | "WATCH";

export type ContextFeedCategory = "GEO" | "POLICY" | "DATA" | "WATCH";

export type NewsTagResult = {
  label: NewsLabel;
  topics: string[];
  /** Higher = more likely to earn MUST KNOW (top 1–2 only). */
  impactScore: number;
  contextCategory: ContextFeedCategory | null;
};

const TOPIC_RULES: { pattern: RegExp; topic: string }[] = [
  { pattern: /oil|refinery|opec|crude|energy|pipeline/i, topic: "ENERGY" },
  { pattern: /taiwan|china|cny|yuan|beijing|wechat|tencent/i, topic: "CHINA" },
  {
    pattern: /semiconductor|chip|nvidia|tsmc|computex|hyperion/i,
    topic: "SEMIS",
  },
  {
    pattern: /hang seng|hong kong|asia|japan|kospi|sydney|shanghai/i,
    topic: "ASIA RISK",
  },
  {
    pattern: /australia|aud |australian|rba|building approvals/i,
    topic: "AUD",
  },
  { pattern: /euro|ecb|germany|france|uk |boe/i, topic: "EUR" },
  { pattern: /iran|israel|gaza|hamas|houthi|centcom|ukraine|kyiv|russia/i, topic: "GEO" },
  { pattern: /tariff|white house|executive order|trump/i, topic: "POLICY" },
  { pattern: /fed|fomc|powell|treasury|yields|inflation|cpi|nfp|employment/i, topic: "MACRO" },
];

const DATA_PATTERNS: RegExp[] = [
  /\bactual\b/i,
  /\bforecast\b/i,
  /\bprevious\b/i,
  /\bgdp\b/i,
  /\bcpi\b/i,
  /\bnfp\b/i,
  /employment report/i,
  /jobs report/i,
  /payroll/i,
  /current account/i,
  /building approvals/i,
  /inventories/i,
  /trade balance/i,
  /pmi\b/i,
  /ism\b/i,
];

const GEO_PATTERNS: RegExp[] = [
  /\bwar\b/i,
  /strike|missile|drone|airstrike|attack|conflict|sanction/i,
  /iran|israel|ukraine|russia|kyiv|gaza|hamas|centcom|houthi|taiwan/i,
  /ceasefire|pentagon|military|troops/i,
];

const POLICY_PATTERNS: RegExp[] = [
  /tariff|white house|executive order|proclamation|trade deal/i,
  /truth social/i,
];

const EARNINGS_PATTERNS: RegExp[] = [
  /earnings|eps|revenue beat|guidance|quarterly results/i,
];

function extractTopics(title: string): string[] {
  const topics = new Set<string>();
  for (const { pattern, topic } of TOPIC_RULES) {
    if (pattern.test(title)) topics.add(topic);
  }
  return [...topics].slice(0, 3);
}

function baseLabel(title: string): NewsLabel {
  if (EARNINGS_PATTERNS.some((p) => p.test(title))) return "EARNINGS";
  if (DATA_PATTERNS.some((p) => p.test(title))) return "DATA";
  if (GEO_PATTERNS.some((p) => p.test(title))) return "GEO";
  if (POLICY_PATTERNS.some((p) => p.test(title))) return "MACRO";

  const priority = classifyHeadline(title);
  if (priority === "critical") return "HIGH IMPACT";
  if (priority === "important") return "MACRO";

  if (/watch|upcoming|ahead of|due|scheduled|minutes until/i.test(title)) {
    return "WATCH";
  }

  return "WATCH";
}

function contextCategoryFor(title: string): ContextFeedCategory | null {
  if (GEO_PATTERNS.some((p) => p.test(title))) return "GEO";
  if (POLICY_PATTERNS.some((p) => p.test(title))) return "POLICY";
  if (DATA_PATTERNS.some((p) => p.test(title))) return "DATA";
  if (/watch|upcoming|ahead of|due/i.test(title)) return "WATCH";
  return null;
}

function impactScore(title: string, label: NewsLabel): number {
  let score = 0;
  const priority = classifyHeadline(title);
  if (priority === "critical") score += 40;
  else if (priority === "important") score += 20;

  if (label === "GEO") score += 35;
  else if (label === "HIGH IMPACT") score += 30;
  else if (label === "DATA") score += 15;
  else if (label === "MACRO") score += 10;

  if (/strike|missile|war|iran|fed|cpi|nfp|employment report/i.test(title)) {
    score += 15;
  }

  return score;
}

export function classifyNewsHeadline(title: string): NewsTagResult {
  const label = baseLabel(title);
  return {
    label,
    topics: extractTopics(title),
    impactScore: impactScore(title, label),
    contextCategory: contextCategoryFor(title),
  };
}

export function assignMustKnowLabels<T extends { label: NewsLabel; impactScore: number }>(
  items: T[],
  max = 2
): T[] {
  if (items.length === 0) return items;

  const ranked = [...items]
    .map((item, index) => ({ item, index, score: item.impactScore }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const mustKnowIndices = new Set<number>();
  for (const row of ranked) {
    if (mustKnowIndices.size >= max) break;
    if (row.score < 25) continue;
    mustKnowIndices.add(row.index);
  }

  return items.map((item, index) =>
    mustKnowIndices.has(index) ? { ...item, label: "MUST KNOW" as NewsLabel } : item
  );
}

export function shortHeadline(title: string, max = 48): string {
  const t = title.replace(/^FinancialJuice:\s*/i, "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}
