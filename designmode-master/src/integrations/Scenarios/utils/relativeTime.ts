/**
 * Formats an ISO 8601 timestamp as relative time.
 * - Today's timestamps: "Today, 2:33 PM" (locale-aware time)
 * - Other dates: "2/8/2026, 2:33 PM" (locale-aware date and time)
 * - Invalid/missing: ""
 *
 * @param isoTimestamp - ISO 8601 timestamp string (e.g., "2026-02-09T14:33:12.326Z")
 * @param todayLabel - Translated string for "Today" (e.g., "Today", "Heute", "今日")
 * @param locale - BCP 47 locale code (e.g., "en-US", "fr-FR", "ja-JP")
 * @returns Formatted time string or empty string for invalid input
 */
export function formatRelativeTime(isoTimestamp: string | undefined, todayLabel: string, locale: string): string {
  // Validate input
  if (!isoTimestamp) {
    return ""
  }

  try {
    const date = new Date(isoTimestamp)

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return ""
    }

    const now = new Date()

    // Compare only the date portion (ignore time) in local timezone
    const isToday =
      date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()

    if (isToday) {
      // Format as "Today, 2:33 PM"
      const timeString = new Intl.DateTimeFormat(locale, {
        hour: "numeric",
        minute: "2-digit",
      }).format(date)

      return `${todayLabel}, ${timeString}`
    } else {
      // Format as full date and time
      return new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(date)
    }
  } catch (error) {
    console.warn("Could not parse timestamp: ", error)
    return ""
  }
}
