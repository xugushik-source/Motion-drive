/**
 * One record, every language: `title` is Russian (the admin panel is Russian only) and
 * `title_en`, `title_ka`, `title_hy` are optional translations kept in the same record.
 * A missing translation falls back to the Russian text for names and captions.
 */
export const pick = (
  record: Record<string, any>,
  field: string,
  locale: string,
): string =>
  String(
    (locale !== "ru" && record[`${field}_${locale}`]) || record[field] || "",
  );
/** Free texts are shown in a language only when that language was written (or the site is Russian). */
export const pickText = (
  record: Record<string, any>,
  field: string,
  locale: string,
): string =>
  String(
    (locale !== "ru" ? record[`${field}_${locale}`] : record[field]) || "",
  );
