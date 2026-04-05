/**
 * AI Market Brief Endpoint
 * Endpoint: GET /api/market/brief
 *
 * Generates a daily market brief using Vercel AI Gateway
 * Fetches real-time NQ futures data for accuracy
 * Cached for 1 hour to balance freshness with API costs
 */

import { generateText } from 'ai';

// In-memory cache for the market brief
let briefCache = {
  content: null,
  generatedAt: null,
  expiresAt: null,
  marketData: null,
};

const CACHE_DURATION_MS = 1 * 60 * 60 * 1000; // 1 hour

/**
 * Fetch NQ data from internal /api/market-data endpoint (Databento)
 */
async function fetchNQData() {
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const res  = await fetch(`${base}/api/market-data?schema=1d`)
    if (!res.ok) throw new Error(`market-data ${res.status}`)
    const json = await res.json()

    // Find NQ.c.0 bars
    const bars = json.data?.['NQ.c.0'] ?? []
    if (!bars.length) return null

    const prev    = bars[bars.length - 2] ?? bars[bars.length - 1]
    const current = bars[bars.length - 1]
    const change  = current.close - prev.close
    const changePct = ((change / prev.close) * 100).toFixed(2)

    return {
      symbol:        'NQ',
      price:         current.close.toFixed(2),
      change:        change.toFixed(2),
      changePercent: changePct,
      dayHigh:       current.high.toFixed(2),
      dayLow:        current.low.toFixed(2),
      previousClose: prev.close.toFixed(2),
    }
  } catch (err) {
    console.error('[MarketBrief] Databento fetch failed, no NQ data:', err.message)
    return null
  }
}

/**
 * GET handler for market brief
 * Query params:
 *   - refresh=true: Force regenerate the brief, bypassing cache
 */
export async function GET(request) {
  const now = Date.now();
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get('refresh') === 'true';

  // Return cached brief if still valid (unless force refresh requested)
  if (!forceRefresh && briefCache.content && briefCache.expiresAt && now < briefCache.expiresAt) {
    console.log('[MarketBrief] Returning cached brief');
    return Response.json({
      brief: briefCache.content,
      generatedAt: briefCache.generatedAt,
      marketData: briefCache.marketData,
      cached: true,
      expiresIn: Math.round((briefCache.expiresAt - now) / 1000 / 60),
    });
  }

  if (forceRefresh) {
    console.log('[MarketBrief] Force refresh requested');
  }

  // Check if AI Gateway API key is configured
  if (!process.env.AI_GATEWAY_API_KEY) {
    console.error('[MarketBrief] AI_GATEWAY_API_KEY not configured');
    return Response.json({
      brief: 'Market brief not configured.',
      error: 'API key missing',
    }, { status: 500 });
  }

  console.log('[MarketBrief] Generating new brief...');

  try {
    // Get current date info in ET
    const etDate = new Date().toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    const etTime = new Date().toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    // Fetch real-time NQ data
    const nqData = await fetchNQData();
    console.log('[MarketBrief] NQ data:', nqData);

    // Build market context for the AI
    let marketContext = '';
    if (nqData) {
      const direction = parseFloat(nqData.change) >= 0 ? 'up' : 'down';
      marketContext = `
CURRENT MARKET DATA (LIVE):
- NQ Futures: ${nqData.price} (${direction} ${Math.abs(parseFloat(nqData.change))} / ${nqData.changePercent}%)
- Day Range: ${nqData.dayLow} - ${nqData.dayHigh}
- Previous Close: ${nqData.previousClose}
Note: MNQ trades at the same price level as NQ (micro contract = 1/10th value)`;
    } else {
      marketContext = 'Note: Unable to fetch live prices. Do NOT mention specific price levels.';
    }

    const prompt = `You are a concise futures trader assistant. Generate a brief market update.

Today: ${etDate}, ${etTime} ET
${marketContext}

Write 3-4 short bullet points covering:
- Current NQ/MNQ price action and trend direction
- Any notable market drivers today
- Key levels to watch (only if live data available)

FORMATTING RULES:
- Use simple dashes (-) for bullets
- NO markdown formatting (no **, no ##, no bold)
- NO labels like "Sentiment:" or "Observation:" - just state the info
- Keep each bullet to 1-2 sentences max
- Total under 100 words
- Be specific with numbers when data is provided`;

    // Generate text using Vercel AI Gateway
    const { text } = await generateText({
      model: 'openai/gpt-4o-mini',
      prompt,
      maxTokens: 250,
    });

    // Clean up any markdown that slipped through
    const cleanedText = text
      .replace(/\*\*/g, '')
      .replace(/##/g, '')
      .replace(/\n\n+/g, '\n')
      .trim();

    // Cache the result
    briefCache = {
      content: cleanedText,
      generatedAt: new Date().toISOString(),
      expiresAt: now + CACHE_DURATION_MS,
      marketData: nqData,
    };

    console.log('[MarketBrief] Brief generated successfully');

    return Response.json({
      brief: briefCache.content,
      generatedAt: briefCache.generatedAt,
      marketData: nqData,
      cached: false,
    });

  } catch (error) {
    console.error('[MarketBrief] Error generating brief:', error);

    // Return cached content if available, even if expired
    if (briefCache.content) {
      return Response.json({
        brief: briefCache.content,
        generatedAt: briefCache.generatedAt,
        marketData: briefCache.marketData,
        cached: true,
        stale: true,
        error: 'Failed to refresh, showing cached version',
      });
    }

    return Response.json({
      brief: 'Market brief temporarily unavailable.',
      error: error.message,
    }, { status: 500 });
  }
}
