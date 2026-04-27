/**
 * Parity with Laravel {@link new-monitoring/app/Models/Monitoring/Monitoring.php}
 * and {@link new-monitoring/app/Classes/MonitoringScoreForHumans.php} display helpers.
 */

const JOURNAL_COPY_URL_IN =
  "https://cdn.tmpilot.com/file/journalcopy/__JOURNAL_DATE__/__APPNO__-j.pdf";
const JOURNAL_COPY_URL =
  "https://cdn.tmpilot.com/file/wtmpilot/__COUNTRY_CODE__/__JOURNAL_DATE__/pdf/__APPNO__.pdf";

/** PHP Monitoring::getJournalCopyUrl — journalDate on row is typically DD/MM/YYYY; Node may store ISO. */
export function buildJournalCopyUrl(
  countryCode: string | null | undefined,
  appno: string | null | undefined,
  journalDate: string | null | undefined,
): string | null {
  if (!journalDate?.trim() || !appno?.trim()) return null;
  const dmy = journalDateToUrlDdMmYyyy(journalDate.trim());
  if (!dmy) return null;
  const cc = String(countryCode ?? "").trim().toLowerCase();
  if (cc === "in") {
    return JOURNAL_COPY_URL_IN.replace("__JOURNAL_DATE__", dmy).replace("__APPNO__", String(appno).trim());
  }
  return JOURNAL_COPY_URL.replace("__COUNTRY_CODE__", cc || "xx")
    .replace("__JOURNAL_DATE__", dmy)
    .replace("__APPNO__", String(appno).trim());
}

/** `dd-mm-yyyy` for CDN path (PHP Carbon d/m/Y → d-m-Y). */
function journalDateToUrlDdMmYyyy(raw: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) {
    const [, y, mo, d] = iso;
    return `${d}-${mo}-${y}`;
  }
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(raw);
  if (slash) {
    const dd = slash[1].padStart(2, "0");
    const mm = slash[2].padStart(2, "0");
    return `${dd}-${mm}-${slash[3]}`;
  }
  return null;
}

/** PHP Column Class — `str_replace('|', ', ', trim($row->conflictClass, '|'))` */
export function formatConflictClassDisplay(conflictClass: string | null | undefined): string {
  if (conflictClass == null || typeof conflictClass !== "string") return "";
  const t = conflictClass.trim();
  if (!t) return "";
  const inner = t.replace(/^\|+|\|+$/g, "");
  if (!inner) return "";
  return inner.split("|").map((p) => p.trim()).filter(Boolean).join(", ");
}

/**
 * PHP MonitoringScoreForHumans::toHumanRead — table stores 100/90/80/70 buckets.
 * Node stores continuous fuzzy 0–100; map to same four labels for display.
 */
export function monitoringScoreToHumanRead(score: number | null | undefined): string {
  if (score == null || Number.isNaN(Number(score))) return "";
  const s = Number(score);
  if (s >= 95) return "Very High";
  if (s >= 85) return "High";
  if (s >= 75) return "Medium";
  if (s >= 65) return "Low";
  return "Low";
}
