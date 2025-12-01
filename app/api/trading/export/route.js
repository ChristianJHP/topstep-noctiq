/**
 * Trade Journal CSV Export API
 * Endpoint: GET /api/trading/export?format=csv&days=30&account=all
 *
 * Exports trade history and alerts as CSV for journaling
 */

import { NextResponse } from 'next/server';

const alertStorage = require('../../../../lib/alertStorage');
const riskManager = require('../../../../lib/riskManager');

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';
    const days = parseInt(searchParams.get('days') || '30', 10);
    const accountFilter = searchParams.get('account');

    // Get alerts from storage
    const alerts = await alertStorage.getAlerts(500); // Get up to 500 alerts

    // Filter by date range
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    let filteredAlerts = alerts.filter(alert => {
      const alertDate = new Date(alert.timestamp);
      return alertDate >= cutoffDate;
    });

    // Filter by account if specified
    if (accountFilter && accountFilter !== 'all') {
      filteredAlerts = filteredAlerts.filter(alert =>
        alert.account === accountFilter ||
        (accountFilter === 'default' && !alert.account)
      );
    }

    // Get P&L history
    const pnlHistory = await alertStorage.getAllHistoricalPnL(days);

    if (format === 'json') {
      return NextResponse.json({
        success: true,
        alerts: filteredAlerts,
        pnlHistory,
        exportedAt: new Date().toISOString(),
      });
    }

    // Generate CSV
    const csvRows = [];

    // Header row
    csvRows.push([
      'Date',
      'Time',
      'Account',
      'Action',
      'Symbol',
      'Stop',
      'Take Profit',
      'Status',
      'Error',
    ].join(','));

    // Data rows
    filteredAlerts.forEach(alert => {
      const date = new Date(alert.timestamp);
      const dateStr = date.toISOString().split('T')[0];
      const timeStr = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'America/New_York',
      });

      const row = [
        dateStr,
        timeStr,
        alert.account || 'default',
        alert.action || '',
        alert.symbol || 'MNQ',
        alert.stop || '',
        alert.tp || '',
        alert.status || '',
        `"${(alert.error || '').replace(/"/g, '""')}"`,
      ];

      csvRows.push(row.join(','));
    });

    // Add separator and P&L summary section
    csvRows.push('');
    csvRows.push('');
    csvRows.push('Daily P&L Summary');
    csvRows.push('Date,Account,P&L,Balance,Trade Count');

    pnlHistory.forEach(entry => {
      csvRows.push([
        entry.date,
        entry.accountId,
        entry.pnl,
        entry.balance || '',
        entry.tradeCount || 0,
      ].join(','));
    });

    const csvContent = csvRows.join('\n');

    // Return CSV file
    const filename = `noctiq-trades-${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('[Export] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
