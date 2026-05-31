const USERNAME = process.env.TRUTH_SOCIAL_USERNAME || "realDonaldTrump";

export type TrumpPost = {
  id: string;
  text: string;
  url: string;
  publishedAt: string;
};

function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchRecentTrumpPosts(limit = 8): Promise<TrumpPost[]> {
  try {
    const lookupRes = await fetch(
      `https://truthsocial.com/api/v1/accounts/lookup?acct=${USERNAME}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; JHPTrades/1.0)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10_000),
        next: { revalidate: 900 },
      }
    );

    if (!lookupRes.ok) return [];

    const account = (await lookupRes.json()) as { id?: string };
    if (!account.id) return [];

    const statusRes = await fetch(
      `https://truthsocial.com/api/v1/accounts/${account.id}/statuses?exclude_replies=true&only_media=false&limit=${limit}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; JHPTrades/1.0)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10_000),
        next: { revalidate: 900 },
      }
    );

    if (!statusRes.ok) return [];

    const posts = (await statusRes.json()) as Array<{
      id: string | number;
      content?: string;
      url?: string;
      created_at?: string;
    }>;

    if (!Array.isArray(posts)) return [];

    return posts
      .map((post) => {
        const text = stripHtml(post.content ?? "");
        if (!text) return null;
        const id = String(post.id);
        return {
          id,
          text,
          url: post.url ?? `https://truthsocial.com/@${USERNAME}/posts/${id}`,
          publishedAt: post.created_at ?? new Date().toISOString(),
        };
      })
      .filter((p): p is TrumpPost => p != null);
  } catch (e) {
    console.warn("[truthsocial-fetch]", (e as Error).message);
    return [];
  }
}
