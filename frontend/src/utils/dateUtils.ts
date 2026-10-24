/**
 * Shared date formatting utilities for Orbi.
 * Consistently displays all user-facing dates in DD/MM/YYYY format.
 * Prevents timezone off-by-one errors by parsing calendar date components safely.
 */

const MONTH_NAMES: { [key: string]: string } = {
  january: '01', feb: '02', february: '02', mar: '03', march: '03',
  apr: '04', april: '04', may: '05', jun: '06', june: '06',
  jul: '07', july: '07', aug: '08', august: '08', sep: '09', september: '09',
  oct: '10', october: '10', nov: '11', november: '11', dec: '12', december: '12'
};

/**
 * Format any date input into DD/MM/YYYY.
 * e.g., "2026-10-24" -> "24/10/2026"
 * e.g., "October 24, 2026" -> "24/10/2026"
 */
export function formatDateDMY(
  dateInput?: string | number | Date | null,
  timezone?: string
): string {
  if (!dateInput) return '';

  const str = String(dateInput).trim();

  // 1. Check for standard ISO date "YYYY-MM-DD" (avoids timezone off-by-one errors)
  const ymdMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }

  // 2. Check if already DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }

  // 3. Check for words like "October 24, 2026" or "24 October 2026"
  const wordMatch1 = str.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (wordMatch1) {
    const [, monthStr, d, y] = wordMatch1;
    const m = MONTH_NAMES[monthStr.toLowerCase()];
    if (m) {
      return `${d.padStart(2, '0')}/${m}/${y}`;
    }
  }

  const wordMatch2 = str.match(/^(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})/);
  if (wordMatch2) {
    const [, d, monthStr, y] = wordMatch2;
    const m = MONTH_NAMES[monthStr.toLowerCase()];
    if (m) {
      return `${d.padStart(2, '0')}/${m}/${y}`;
    }
  }

  // 4. Fallback to Intl.DateTimeFormat for Date instances or timestamps
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return str;

    const options: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    };
    if (timezone) {
      try {
        options.timeZone = timezone;
      } catch {
        // Fallback to local if invalid timezone string
      }
    }

    return new Intl.DateTimeFormat('en-GB', options).format(d);
  } catch {
    return str;
  }
}

/**
 * Format date and time in DD/MM/YYYY HH:MM
 */
export function formatDateTimeDMY(
  dateInput?: string | number | Date | null,
  timezone?: string
): string {
  if (!dateInput) return '';

  const str = String(dateInput).trim();
  const datePart = formatDateDMY(str, timezone);

  // Extract time if present (e.g. "T14:30:00" or " 14:30")
  const timeMatch = str.match(/[T\s](\d{1,2}:\d{2})/);
  if (timeMatch) {
    return `${datePart} ${timeMatch[1]}`;
  }

  return datePart;
}

/**
 * Returns today's date formatted as DD/MM/YYYY in the user's timezone.
 */
export function getTodayDMY(timezone?: string): string {
  const options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  };
  if (timezone) {
    try {
      options.timeZone = timezone;
    } catch {}
  }
  return new Intl.DateTimeFormat('en-GB', options).format(new Date());
}

/**
 * Returns the non-time-based greeting: "Welcome, [User Name]."
 */
export function formatGreeting(fullName?: string): string {
  const name = fullName && fullName.trim() ? fullName.trim() : 'User';
  return `Welcome, ${name}.`;
}
