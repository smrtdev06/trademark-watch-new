/**
 * Must match `getAllMenuKeys()` in [artifacts/monitoring/src/lib/menuDef.ts](../../monitoring/src/lib/menuDef.ts).
 * Used to return full allow permissions for admin users on auth responses.
 */
const MENU_GROUP_KEYS = [
  "home",
  "alerts",
  "alerts.add",
  "alerts.list",
  "alerts.results",
  "search",
  "search.assessment",
  "search.pdf_reports",
  "search.license",
  "search.opposition",
  "search.proprietor",
  "search.b2b",
  "social_watch",
  "social_watch.list",
  "social_watch.results",
  "domain_monitoring",
  "domain_monitoring.list",
  "domain_monitoring.results",
  "tm_watch",
  "tm_watch.add",
  "tm_watch.import",
  "tm_watch.import_failed",
  "tm_watch.list",
  "tm_watch.view",
  "tm_watch.export",
  "logo_search",
  "logo_search.view",
  "logo_search.add",
  "logo_search.results",
  "image_watch",
  "image_watch.view",
  "image_watch.import",
  "files",
  "contacts",
] as const;

/** Every known menu key set to `true` (default grant for admin). */
export function getDefaultAllMenuPermissions(): Record<string, boolean> {
  return Object.fromEntries(MENU_GROUP_KEYS.map((k) => [k, true])) as Record<string, boolean>;
}

/** Same rule as [lib/auth requireAdmin] (strict `admin` string). */
export function isAppAdminRole(role: string | null | undefined): boolean {
  return role === "admin";
}
