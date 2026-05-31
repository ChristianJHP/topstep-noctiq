/**
 * AI Trading Summary Endpoint
 * Endpoint: GET /api/trading/summary
 *
 * Generates an AI analysis of trading stats and daily performance
 * Cached for 30 minutes to balance freshness with API costs
 */

import { generateText } from 'ai';

// In-memory cache
let summaryCache = {
  content: null,
  generatedAt: null,
  expiresAt: null,
  stats: null,
};

const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Fetch trading stats from internal P&L API
 */
async function fetchTradingStats(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/api/trading/pnl?days=30`, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      console.error('[TradingSummary] P&L API error:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('[TradingSummary] Error fetching stats:', error);
    return null;
  }
}

/**
 * GET handler for trading summary
 * Query params:
 *   - refresh=true: Force regenerate the summary
 */
export async function GET(request) {
  const now = Date.now();
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get('refresh') === 'true';

  // Return cached summary if still valid
  if (!forceRefresh && summaryCache.content && summaryCache.expiresAt && now < summaryCache.expiresAt) {
    console.log('[TradingSummary] Returning cached summary');
    return Response.json({
      summary: summaryCache.content,
      generatedAt: summaryCache.generatedAt,
      stats: summaryCache.stats,
      cached: true,
      expiresIn: Math.round((summaryCache.expiresAt - now) / 1000 / 60),
    });
  }

  if (!process.env.AI_GATEWAY_API_KEY) {
    console.error('[TradingSummary] AI_GATEWAY_API_KEY not configured');
    return Response.json({
      summary: 'Trading summary not configured.',
      error: 'API key missing',
    }, { status: 500 });
  }

  console.log('[TradingSummary] Generating new summary...');

  try {
    // Get base URL for internal API calls
    const baseUrl = request.url.split('/api/')[0];

    // Fetch trading data
    const pnlData = await fetchTradingStats(baseUrl);
    const tsx = pnlData?.brokers?.tsx;

    if (!tsx?.connected) {
      return Response.json({
        summary: 'No trading data available. Connect your account to see AI insights.',
        error: 'No data',
      });
    }

    const stats = tsx.stats;
    const today = tsx.today;
    const period = tsx.period;
    const daily = tsx.daily || [];
    const target = 3000;
    const remaining = target - (period?.pnl || 0);

    // Get recent trading days for context
    const recentDays = daily.slice(-7);
    const streak = calculateStreak(daily);
    const bestDay = daily.length > 0 ? daily.reduce((best, d) => d.pnl > best.pnl ? d : best, daily[0]) : null;
    const worstDay = daily.length > 0 ? daily.reduce((worst, d) => d.pnl < worst.pnl ? d : worst, daily[0]) : null;

    // Build context for AI
    const tradingContext = `
TRADING STATS (Last 30 Days):
- Total P&L: $${(period?.pnl || 0).toFixed(0)} (${period?.trades || 0} trades)
- Win Rate: ${(stats?.winRate || 0).toFixed(1)}% (${stats?.winningTrades || 0} wins / ${stats?.losingTrades || 0} losses)
- Profit Factor: ${stats?.profitFactor?.toFixed(2) || 'N/A'}
- Sharpe Ratio: ${stats?.sharpeRatio?.toFixed(2) || 'N/A'}
- Avg Daily P&L: $${(stats?.avgDailyPnl || 0).toFixed(0)}
- Avg Win: $${(stats?.avgWin || 0).toFixed(0)}
- Avg Loss: $${(stats?.avgLoss || 0).toFixed(0)}
- Trading Days: ${stats?.tradingDays || 0}
${streak.type !== 'none' ? `- Current Streak: ${streak.count} ${streak.type} day(s)` : ''}
${bestDay ? `- Best Day: $${bestDay.pnl.toFixed(0)} on ${bestDay.date}` : ''}
${worstDay ? `- Worst Day: $${worstDay.pnl.toFixed(0)} on ${worstDay.date}` : ''}

TODAY'S PERFORMANCE:
- P&L: $${(today?.pnl || 0).toFixed(0)}
- Trades: ${today?.trades || 0}

TARGET PROGRESS:
- Target: $${target}
- Current: $${(period?.pnl || 0).toFixed(0)} (${((period?.pnl || 0) / target * 100).toFixed(0)}%)
- Remaining: $${remaining.toFixed(0)}
${stats?.avgDailyPnl > 0 ? `- Days to target at current avg: ${Math.ceil(remaining / stats.avgDailyPnl)}` : ''}

RECENT DAILY P&L:
${recentDays.map(d => `- ${d.date}: $${d.pnl.toFixed(0)} (${d.trades} trades)`).join('\n')}`;

    const etDate = new Date().toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

    const prompt = `You are a trading coach analyzing a futures trader's performance on MNQ (Micro Nasdaq futures).

${tradingContext}

Today is ${etDate}. Write a brief, actionable trading summary covering:

1. Overall assessment (1 sentence on current performance)
2. Key strength or pattern you notice
3. Area for improvement or risk to watch
4. Specific actionable advice for today/tomorrow

RULES:
- Be direct and specific, not generic
- Use actual numbers from the data
- NO markdown (no **, ##, etc)
- Use simple dashes for bullets
- Keep under 120 words total
- Be encouraging but honest about areas to improve
- If win rate is low, mention it directly
- If on a losing streak, acknowledge it`;

    const { text } = await generateText({
      model: 'openai/gpt-4o-mini',
      prompt,
      maxTokens: 300,
    });

    // Clean up markdown
    const cleanedText = text
      .replace(/\*\*/g, '')
      .replace(/##/g, '')
      .replace(/\n\n+/g, '\n')
      .trim();

    // Cache the result
    summaryCache = {
      content: cleanedText,
      generatedAt: new Date().toISOString(),
      expiresAt: now + CACHE_DURATION_MS,
      stats: {
        winRate: stats?.winRate,
        profitFactor: stats?.profitFactor,
        periodPnl: period?.pnl,
        todayPnl: today?.pnl,
      },
    };

    console.log('[TradingSummary] Summary generated successfully');

    return Response.json({
      summary: summaryCache.content,
      generatedAt: summaryCache.generatedAt,
      stats: summaryCache.stats,
      cached: false,
    });

  } catch (error) {
    console.error('[TradingSummary] Error generating summary:', error);

    if (summaryCache.content) {
      return Response.json({
        summary: summaryCache.content,
        generatedAt: summaryCache.generatedAt,
        stats: summaryCache.stats,
        cached: true,
        stale: true,
        error: 'Failed to refresh, showing cached version',
      });
    }

    return Response.json({
      summary: 'Trading summary temporarily unavailable.',
      error: error.message,
    }, { status: 500 });
  }
}

/**
 * Calculate current win/loss streak
 */
function calculateStreak(daily) {
  if (!daily || daily.length === 0) return { type: 'none', count: 0 };

  const sorted = [...daily].sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  let type = sorted[0].pnl >= 0 ? 'winning' : 'losing';

  for (const day of sorted) {
    if (day.trades === 0) continue;
    const isWin = day.pnl >= 0;
    if ((type === 'winning' && isWin) || (type === 'losing' && !isWin)) {
      streak++;
    } else {
      break;
    }
  }

  return { type, count: streak };
}
