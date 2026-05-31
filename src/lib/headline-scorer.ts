import type { Headline } from "@/lib/headlines";

export type ScoredHeadline = Headline & {
  score: number;
  category: string;
};

const IGNORE_PATTERNS = [
  /stock is a buy/i,
  /price target/i,
  /\betf\b/i,
  /passive income/i,
  /cathie wood/i,
  /hedge fund added/i,
  /shares to its/i,
  /could this stock/i,
  /become \$1t/i,
  /analyst resets/i,
  /motley fool/i,
  /zacks/i,
  /penny stock/i,
  /dividend stock/i,
  /best stock/i,
  /top stock/i,
  /dow jones futures/i,
  /here'?s what/i,
  /3 things to know/i,
];

type ScoreRule = { patterns: RegExp[]; base: number; category: string };

const SCORE_RULES: ScoreRule[] = [
  {
    base: 100,
    category: "Trump / White House",
    patterns: [
      /\btrump\b/i,
      /white house/i,
      /\btariffs?\b/i,
      /trade deal/i,
      /press conference/i,
      /\bspeech\b/i,
    ],
  },
  {
    base: 90,
    category: "Geopolitical",
    patterns: [
      /\biran\b/i,
      /\bisrael\b/i,
      /\bgaza\b/i,
      /\brussia\b/i,
      /\bukraine\b/i,
      /\bchina\b/i,
      /\btaiwan\b/i,
      /\bmissile/i,
      /\battack/i,
      /\bstrike/i,
      /\bwar\b/i,
      /\bceasefire/i,
      /red sea/i,
      /\bhouthi/i,
    ],
  },
  {
    base: 85,
    category: "Fed / Rates",
    patterns: [
      /\bfed\b/i,
      /\bpowell\b/i,
      /\bfomc\b/i,
      /\brates?\b/i,
      /\byields?\b/i,
    ],
  },
  {
    base: 80,
    category: "Inflation / Jobs",
    patterns: [
      /\bcpi\b/i,
      /\bppi\b/i,
      /\bpce\b/i,
      /\bnfp\b/i,
      /nonfarm/i,
      /employment report/i,
      /jobs report/i,
      /\binflation\b/i,
      /\bjobs\b/i,
    ],
  },
  {
    base: 70,
    category: "Oil / Sanctions",
    patterns: [/\boil\b/i, /\bopec\b/i, /crude/i, /\bsanctions?\b/i, /nuclear/i],
  },
  {
    base: 40,
    category: "Mega-cap shock",
    patterns: [/\bnvda\b/i, /\btesla\b/i, /\baapl\b/i, /\bmsft\b/i],
  },
];

function recencyBonus(publishedAt: string, now = Date.now()): number {
  const ageMs = now - new Date(publishedAt).getTime();
  const ageMin = ageMs / 60_000;
  if (ageMin <= 30) return 20;
  if (ageMin <= 120) return 10;
  if (ageMin > 12 * 60) return -30;
  return 0;
}

function isTooOld(publishedAt: string, now = Date.now()): boolean {
  return now - new Date(publishedAt).getTime() > 24 * 60 * 60 * 1000;
}

export function scoreHeadline(
  headline: Headline,
  now = Date.now()
): ScoredHeadline | null {
  const title = headline.title;
  if (!title.trim()) return null;

  if (IGNORE_PATTERNS.some((p) => p.test(title))) return null;

  let bestBase = 0;
  let category = "";

  for (const rule of SCORE_RULES) {
    if (rule.patterns.some((p) => p.test(title)) && rule.base > bestBase) {
      bestBase = rule.base;
      category = rule.category;
    }
  }

  if (bestBase === 0) return null;

  const score = bestBase + recencyBonus(headline.publishedAt, now);
  return { ...headline, score, category };
}

export function pickTopHeadline(
  headlines: Headline[],
  now = Date.now()
): ScoredHeadline | null {
  const scored = headlines
    .map((h) => scoreHeadline(h, now))
    .filter((h): h is ScoredHeadline => h !== null);

  if (!scored.length) return null;

  const fresh = scored.filter((h) => !isTooOld(h.publishedAt, now));
  const pool = fresh.length ? fresh : scored;

  return pool.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  })[0];
}
