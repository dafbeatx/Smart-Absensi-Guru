/**
 * Helper utility for formatting and sanitizing time values for HTML5 <input type="time">
 */

/**
 * Normalizes any time or date-time value (ISO string, HH:mm:ss, HH:mm)
 * into standard 24-hour "HH:mm" format required by HTML5 <input type="time">.
 * 
 * Examples:
 * - "1899-12-29T22:52:48.000Z" -> "06:00"
 * - "1899-12-30T00:07:48.000Z" -> "07:15"
 * - "07:15:00"                -> "07:15"
 * - "7:5"                     -> "07:05"
 */
export function formatTimeForInput(value: unknown, defaultValue: string = ''): string {
  if (value === null || value === undefined) return defaultValue;

  const str = String(value).trim();
  if (!str) return defaultValue;

  // 1. Handle ISO date-time strings (e.g. from Google Sheets / Google Apps Script ISO serialization)
  if (str.includes('T')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      // Calculate total seconds from local midnight to account for sub-minute LMT offsets (e.g., 1899 dates)
      const totalSeconds = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
      const roundedMinutes = Math.round(totalSeconds / 60);
      const hours = String(Math.floor(roundedMinutes / 60) % 24).padStart(2, '0');
      const minutes = String(roundedMinutes % 60).padStart(2, '0');
      return `${hours}:${minutes}`;
    }
  }

  // 2. Handle HH:mm or HH:mm:ss strings
  const timeMatch = str.match(/(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    const hours = String(timeMatch[1]).padStart(2, '0');
    const minutes = String(timeMatch[2]).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  return defaultValue;
}
