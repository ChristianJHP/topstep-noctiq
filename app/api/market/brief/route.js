/**
 * AI Market Brief Endpoint
 * Endpoint: GET /api/market/brief
 *
 * Generates a daily market brief using Vercel AI SDK
 * Cached for 4 hours to minimize API calls
 */

import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

// In-memory cache for the market brief
let briefCache = {
  content: null,
  generatedAt: null,
  expiresAt: null,
};

const CACHE_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours

/**
 * GET handler for market brief
 */
export async function GET() {
  const now = Date.now();

  // Return cached brief if still valid
  if (briefCache.content && briefCache.expiresAt && now < briefCache.expiresAt) {
    console.log('[MarketBrief] Returning cached brief');
    return Response.json({
      brief: briefCache.content,
      generatedAt: briefCache.generatedAt,
      cached: true,
      expiresIn: Math.round((briefCache.expiresAt - now) / 1000 / 60), // minutes
    });
  }

  // Check if API key is configured - prefer OPENAI_API_KEY for direct access
  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    console.error('[MarketBrief] No API key configured (OPENAI_API_KEY or AI_GATEWAY_API_KEY)');
    return Response.json({
      brief: 'Market brief not configured.',
      error: 'API key missing',
    }, { status: 500 });
  }

  console.log('[MarketBrief] Generating new brief...');

  try {
    // Get current date info
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

    const dayOfWeek = new Date().toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long',
    });

    // Don't generate on weekends
    if (dayOfWeek === 'Saturday' || dayOfWeek === 'Sunday') {
      return Response.json({
        brief: 'Markets closed for the weekend. Brief will update Monday morning.',
        generatedAt: new Date().toISOString(),
        weekend: true,
      });
    }

    const prompt = `You are a concise market analyst. Generate a brief market update for a day trader trading MNQ (Micro Nasdaq-100 futures).

Today is ${etDate}, ${etTime} ET.

Provide a brief (4-5 bullet points max) covering:
- Overnight/pre-market sentiment for Nasdaq
- Any key economic events or data releases today
- General market conditions (risk-on/risk-off)
- One tactical observation for MNQ traders

Keep it under 150 words total. Be direct, no fluff. Use plain text with bullet points (use - for bullets).`;

    // Create OpenAI client using Vercel AI SDK
    const openai = createOpenAI({
      apiKey: apiKey,
    });

    // Generate text using Vercel AI SDK
    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      prompt,
      maxTokens: 300,
    });

    // Cache the result
    briefCache = {
      content: text.trim(),
      generatedAt: new Date().toISOString(),
      expiresAt: now + CACHE_DURATION_MS,
    };

    console.log('[MarketBrief] Brief generated successfully');

    return Response.json({
      brief: briefCache.content,
      generatedAt: briefCache.generatedAt,
      cached: false,
    });

  } catch (error) {
    console.error('[MarketBrief] Error generating brief:', error);

    // Return cached content if available, even if expired
    if (briefCache.content) {
      return Response.json({
        brief: briefCache.content,
        generatedAt: briefCache.generatedAt,
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
