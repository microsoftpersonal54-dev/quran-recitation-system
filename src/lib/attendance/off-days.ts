// Weekly off days for the Quran schedule.
// 0 = Sunday, 1 = Monday, ..., 6 = Saturday.
//
// Sundays are treated as an automatic weekly off. Nothing needs to be
// marked for these days. Recording on an off day is still allowed and
// counts as an extra session.

export const WEEKLY_OFF_DAYS: number[] = [0]; // Sunday

export function isWeeklyOff(date: Date): boolean {
  return WEEKLY_OFF_DAYS.includes(date.getDay());
}

/**
 * Returns the display label for a weekly off day, or null.
 */
export function weeklyOffLabel(date: Date): string | null {
  if (!isWeeklyOff(date)) return null;
  const names = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return `Weekly off (${names[date.getDay()]})`;
}