/**
 * Date helpers aligned with PHP {@link new-monitoring/app/Services/Monitoring/DomainMonitoringService.php}
 * (`Carbon::today()->subDays(2)` / `Carbon::today()` in app timezone — we use the Node process local TZ).
 */

export function localCalendarYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Default `from` / `to` for the WHOIS search API (PHP constructor defaults). */
export function defaultDomainMonitoringDateRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 2);
  return { from: localCalendarYmd(from), to: localCalendarYmd(now) };
}
