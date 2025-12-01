/**
 * Futures Market Hours Utility
 * MNQ/NQ trading hours: Sunday 6:00 PM ET - Friday 5:00 PM ET
 * Daily maintenance break: 5:00 PM - 6:00 PM ET (Mon-Thu)
 */

// CME holidays for 2024-2025 (markets closed all day)
const CME_HOLIDAYS = [
  // 2024
  '2024-01-01', // New Year's Day
  '2024-01-15', // MLK Day
  '2024-02-19', // Presidents Day
  '2024-03-29', // Good Friday
  '2024-05-27', // Memorial Day
  '2024-06-19', // Juneteenth
  '2024-07-04', // Independence Day
  '2024-09-02', // Labor Day
  '2024-11-28', // Thanksgiving
  '2024-12-25', // Christmas
  // 2025
  '2025-01-01', // New Year's Day
  '2025-01-20', // MLK Day
  '2025-02-17', // Presidents Day
  '2025-04-18', // Good Friday
  '2025-05-26', // Memorial Day
  '2025-06-19', // Juneteenth
  '2025-07-04', // Independence Day
  '2025-09-01', // Labor Day
  '2025-11-27', // Thanksgiving
  '2025-12-25', // Christmas
  // 2026
  '2026-01-01', // New Year's Day
  '2026-01-19', // MLK Day
  '2026-02-16', // Presidents Day
  '2026-04-03', // Good Friday
  '2026-05-25', // Memorial Day
  '2026-06-19', // Juneteenth
  '2026-07-03', // Independence Day (observed)
  '2026-09-07', // Labor Day
  '2026-11-26', // Thanksgiving
  '2026-12-25', // Christmas
];

// Early close days (1:00 PM ET close) - day before major holidays
const EARLY_CLOSE_DAYS = [
  '2024-07-03', // Day before July 4th
  '2024-11-29', // Day after Thanksgiving
  '2024-12-24', // Christmas Eve
  '2024-12-31', // New Year's Eve
  '2025-07-03', // Day before July 4th
  '2025-11-28', // Day after Thanksgiving
  '2025-12-24', // Christmas Eve
  '2025-12-31', // New Year's Eve
];

/**
 * Get current time in ET timezone
 */
function getETTime() {
  const now = new Date();
  const etString = now.toLocaleString('en-US', {
    timeZone: 'America/New_York',
  });
  return new Date(etString);
}

/**
 * Get date string in YYYY-MM-DD format for ET timezone
 */
function getETDateString(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

/**
 * Check if a given date is a CME holiday
 */
function isHoliday(date = new Date()) {
  const dateStr = getETDateString(date);
  return CME_HOLIDAYS.includes(dateStr);
}

/**
 * Check if a given date is an early close day
 */
function isEarlyClose(date = new Date()) {
  const dateStr = getETDateString(date);
  return EARLY_CLOSE_DAYS.includes(dateStr);
}

/**
 * Check if futures market is currently open
 * MNQ/NQ: Sunday 6PM ET - Friday 5PM ET, with 5-6PM ET break Mon-Thu
 */
function isFuturesOpen() {
  const et = getETTime();
  const day = et.getDay(); // 0 = Sunday, 6 = Saturday
  const hour = et.getHours();
  const minute = et.getMinutes();
  const currentMinutes = hour * 60 + minute;

  // Check if today is a holiday
  if (isHoliday()) {
    return { open: false, reason: 'CME Holiday' };
  }

  // Saturday - always closed
  if (day === 6) {
    return { open: false, reason: 'Weekend (Saturday)' };
  }

  // Sunday - opens at 6:00 PM ET
  if (day === 0) {
    if (currentMinutes >= 18 * 60) { // 6:00 PM or later
      return { open: true, reason: 'Regular session' };
    }
    return { open: false, reason: 'Weekend (Sunday before 6PM ET)' };
  }

  // Friday - closes at 5:00 PM ET
  if (day === 5) {
    if (currentMinutes < 17 * 60) { // Before 5:00 PM
      // Check for early close
      if (isEarlyClose() && currentMinutes >= 13 * 60) {
        return { open: false, reason: 'Early close day' };
      }
      return { open: true, reason: 'Regular session' };
    }
    return { open: false, reason: 'Weekend (Friday after 5PM ET)' };
  }

  // Monday - Thursday
  // Daily maintenance break: 5:00 PM - 6:00 PM ET
  if (currentMinutes >= 17 * 60 && currentMinutes < 18 * 60) {
    return { open: false, reason: 'Daily maintenance break (5-6PM ET)' };
  }

  // Check for early close
  if (isEarlyClose() && currentMinutes >= 13 * 60) {
    return { open: false, reason: 'Early close day' };
  }

  return { open: true, reason: 'Regular session' };
}

/**
 * Calculate time until futures market opens
 * Returns object with hours, minutes, and next open time
 */
function getTimeUntilOpen() {
  const status = isFuturesOpen();

  if (status.open) {
    return {
      isOpen: true,
      hoursUntilOpen: 0,
      minutesUntilOpen: 0,
      nextOpenTime: null,
      nextOpenFormatted: null,
    };
  }

  const et = getETTime();
  const day = et.getDay();
  const hour = et.getHours();
  const minute = et.getMinutes();
  const currentMinutes = hour * 60 + minute;

  let nextOpen = new Date(et);

  // During daily maintenance break (5-6 PM Mon-Thu)
  if (day >= 1 && day <= 4 && currentMinutes >= 17 * 60 && currentMinutes < 18 * 60) {
    // Opens at 6 PM today
    nextOpen.setHours(18, 0, 0, 0);
  }
  // Friday after 5 PM - opens Sunday 6 PM
  else if (day === 5 && currentMinutes >= 17 * 60) {
    nextOpen.setDate(nextOpen.getDate() + 2); // Sunday
    nextOpen.setHours(18, 0, 0, 0);
  }
  // Saturday - opens Sunday 6 PM
  else if (day === 6) {
    nextOpen.setDate(nextOpen.getDate() + 1); // Sunday
    nextOpen.setHours(18, 0, 0, 0);
  }
  // Sunday before 6 PM - opens at 6 PM today
  else if (day === 0 && currentMinutes < 18 * 60) {
    nextOpen.setHours(18, 0, 0, 0);
  }
  // Holiday - find next non-holiday trading day
  else if (isHoliday()) {
    // Move to next day and check
    nextOpen.setDate(nextOpen.getDate() + 1);
    nextOpen.setHours(18, 0, 0, 0);

    // Keep moving forward until we find a trading day
    while (isHoliday(nextOpen) || nextOpen.getDay() === 6) {
      nextOpen.setDate(nextOpen.getDate() + 1);
    }

    // If it's Sunday, market opens at 6 PM
    if (nextOpen.getDay() === 0) {
      nextOpen.setHours(18, 0, 0, 0);
    } else {
      // Otherwise it's a weekday, opens at 6 PM the day before
      // Actually for weekdays after holiday, it continues from previous session
      // So if Monday is after holiday, it opens Monday 6 PM (after maintenance)
      nextOpen.setHours(18, 0, 0, 0);
    }
  }
  // Early close - opens at 6 PM same day
  else if (isEarlyClose() && currentMinutes >= 13 * 60) {
    nextOpen.setHours(18, 0, 0, 0);
  }

  // Check if nextOpen lands on a holiday, if so skip
  while (isHoliday(nextOpen)) {
    nextOpen.setDate(nextOpen.getDate() + 1);
    if (nextOpen.getDay() === 0) {
      nextOpen.setHours(18, 0, 0, 0);
    }
  }

  // Calculate difference
  const now = new Date();
  const diffMs = nextOpen.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMins / 60);
  const minutes = diffMins % 60;

  return {
    isOpen: false,
    hoursUntilOpen: Math.max(0, hours),
    minutesUntilOpen: Math.max(0, minutes),
    nextOpenTime: nextOpen.toISOString(),
    nextOpenFormatted: nextOpen.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }),
    closedReason: status.reason,
  };
}

/**
 * Calculate time until futures market closes
 * Returns object with hours, minutes until close
 */
function getTimeUntilClose() {
  const status = isFuturesOpen();

  if (!status.open) {
    return {
      isOpen: false,
      hoursUntilClose: 0,
      minutesUntilClose: 0,
      nextCloseTime: null,
    };
  }

  const et = getETTime();
  const day = et.getDay();
  const hour = et.getHours();
  const minute = et.getMinutes();

  let nextClose = new Date(et);

  // Friday - closes at 5:00 PM ET (or 1:00 PM if early close)
  if (day === 5) {
    if (isEarlyClose()) {
      nextClose.setHours(13, 0, 0, 0);
    } else {
      nextClose.setHours(17, 0, 0, 0);
    }
  }
  // Monday - Thursday: next close is maintenance at 5:00 PM ET
  else if (day >= 1 && day <= 4) {
    if (isEarlyClose()) {
      nextClose.setHours(13, 0, 0, 0);
    } else {
      nextClose.setHours(17, 0, 0, 0);
    }
  }
  // Sunday after 6 PM - next close is Monday 5 PM maintenance
  else if (day === 0) {
    nextClose.setDate(nextClose.getDate() + 1); // Monday
    nextClose.setHours(17, 0, 0, 0);
  }

  // Calculate difference
  const now = new Date();
  const diffMs = nextClose.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMins / 60);
  const minutes = diffMins % 60;

  return {
    isOpen: true,
    hoursUntilClose: Math.max(0, hours),
    minutesUntilClose: Math.max(0, minutes),
    nextCloseTime: nextClose.toISOString(),
    nextCloseFormatted: nextClose.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }),
  };
}

module.exports = {
  isFuturesOpen,
  getTimeUntilOpen,
  getTimeUntilClose,
  isHoliday,
  isEarlyClose,
  getETTime,
  CME_HOLIDAYS,
};
