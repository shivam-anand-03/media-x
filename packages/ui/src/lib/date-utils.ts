import { format } from "date-fns";

/**
 * Parse a possibly empty / malformed date value into a valid `Date`.
 * Returns `undefined` for empty values or unparseable strings (e.g. "Present"),
 * so callers never pass an Invalid Date to date-fns (which throws a RangeError).
 */
export const toValidDate = (value: unknown): Date | undefined => {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value as string);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

/**
 * Safely format a date-picker value for display.
 * - valid date  → formatted with `dateFormat` (default "PPP")
 * - non-empty, non-date string (e.g. "Present") → shown as-is
 * - empty / nullish → `fallback`
 */
export const formatDisplayDate = (
  value: unknown,
  fallback = "Select date",
  dateFormat = "PPP",
): string => {
  const date = toValidDate(value);
  if (date) return format(date, dateFormat);
  return typeof value === "string" && value.trim() ? value : fallback;
};
