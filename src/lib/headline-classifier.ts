export type NewsPriority = "critical" | "important" | "ignore";

const IGNORE_KEYWORDS = [
  "stock is a buy",
  "price target",
  "etf",
  "passive income",
  "millionaire",
  "hedge fund",
  "cathie wood",
  "vanguard",
  "motley fool",
  "zacks",
  "analyst resets",
  "could it make you",
  "prediction:",
  "underperforming",
  "is a buy",
  "near buy",
  "buy points",
  "buy point",
  "added over",
  "shares to its",
  "megacap",
  "top stock",
  "best stock",
  "penny stock",
  "dividend stock",
  "stock has surged",
  "stock surged",
  "dow jones futures",
  "futures:",
  "nvidia",
  "tesla",
  "bitcoin",
  "warren buffett",
  "buffett says",
  "buffett",
  "stock market metric",
  "alarming new record",
  "3 things",
  "things to know",
  "hits highs",
  "near highs",
  "lead 5",
  "titans",
  "ftse 100",
  "us stocks dive",
  "us stocks rally",
  "stocks rally",
  "stocks dive",
  "market hits",
  "in view",
  "jitters",
  "swings amid",
  "rally with",
  "here's what",
  "here is what",
  "could come next",
  "windows pc",
  "excise duty",
  "petrol",
  "diesel",
];

/** Headlines must match at least one — no bare "war" / "iran" in roundups */
const CRITICAL_PATTERNS: RegExp[] = [
  /\btrump\b/i,
  /\bpowell\b/i,
  /\bfomc\b/i,
  /\bcpi\b/i,
  /\bnfp\b/i,
  /nonfarm payroll/i,
  /employment report/i,
  /jobs report/i,
  /\btariffs?\b/i,
  /rate cut/i,
  /rate hike/i,
  /iran.{0,50}(attack|strike|missile|sanction|nuclear|deal|conflict|war)/i,
  /(attack|strike|missile|sanction|nuclear).{0,50}iran/i,
  /israel.{0,40}(attack|strike|missile|war|ceasefire)/i,
  /russia.{0,40}(attack|strike|missile|war|ukraine)/i,
  /ukraine.{0,40}(attack|strike|missile|war)/i,
  /china.{0,40}(tariff|sanction|taiwan|trade war)/i,
  /taiwan/i,
  /ceasefire/i,
  /opec/i,
  /houthi/i,
  /red sea/i,
];

const IMPORTANT_PATTERNS: RegExp[] = [
  /\bfed\b/i,
  /treasury auction/i,
  /treasury yields?/i,
  /\byields\b/i,
  /\binflation\b/i,
  /\bppi\b/i,
  /\bpce\b/i,
  /white house/i,
  /executive order/i,
  /press conference/i,
  /truth social/i,
  /oil price/i,
  /crude oil/i,
  /sanctions on/i,
  /geopolitical/i,
];

export function classifyHeadline(title: string): NewsPriority {
  const text = title.toLowerCase();

  if (IGNORE_KEYWORDS.some((k) => text.includes(k))) {
    return "ignore";
  }

  if (CRITICAL_PATTERNS.some((p) => p.test(title))) {
    return "critical";
  }

  if (IMPORTANT_PATTERNS.some((p) => p.test(title))) {
    return "important";
  }

  return "ignore";
}

export interface MarketMovingHeadline {
  title: string;
  link: string;
  publishedAt: string;
  priority: "critical" | "important";
}

const PRIORITY_RANK = { critical: 0, important: 1 } as const;

export function filterMarketMovingHeadlines(
  headlines: { title: string; link: string; publishedAt: string }[],
  limit = 5
): MarketMovingHeadline[] {
  const matched: MarketMovingHeadline[] = [];

  for (const h of headlines) {
    const priority = classifyHeadline(h.title);
    if (priority === "ignore") continue;
    matched.push({ ...h, priority });
  }

  return matched
    .sort((a, b) => {
      const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (pr !== 0) return pr;
      return (
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
    })
    .slice(0, limit);
}
