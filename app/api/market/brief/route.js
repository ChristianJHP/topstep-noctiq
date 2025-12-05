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
 * Fetch real-time NQ futures data from Yahoo Finance
 */
async function fetchNQData() {
  try {
    // NQ=F is Nasdaq 100 E-mini futures on Yahoo Finance
    const response = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/NQ=F?interval=1d&range=5d',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      }
    );

    if (!response.ok) {
      console.error('[MarketBrief] Yahoo Finance API error:', response.status);
      return null;
    }

    const data = await response.json();
    const result = data?.chart?.result?.[0];

    if (!result) return null;

    const meta = result.meta;
    const quote = result.indicators?.quote?.[0];
    const closes = quote?.close?.filter(c => c !== null) || [];

    // Get current price and previous close
    const currentPrice = meta?.regularMarketPrice || closes[closes.length - 1];
    const previousClose = meta?.previousClose || closes[closes.length - 2];

    // Calculate change
    const change = currentPrice - previousClose;
    const changePercent = ((change / previousClose) * 100).toFixed(2);

    // Get high/low for context
    const dayHigh = meta?.regularMarketDayHigh || Math.max(...(quote?.high?.filter(h => h) || [currentPrice]));
    const dayLow = meta?.regularMarketDayLow || Math.min(...(quote?.low?.filter(l => l) || [currentPrice]));

    return {
      symbol: 'NQ',
      price: currentPrice?.toFixed(2),
      change: change?.toFixed(2),
      changePercent,
      dayHigh: dayHigh?.toFixed(2),
      dayLow: dayLow?.toFixed(2),
      previousClose: previousClose?.toFixed(2),
    };
  } catch (error) {
    console.error('[MarketBrief] Error fetching NQ data:', error);
    return null;
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
