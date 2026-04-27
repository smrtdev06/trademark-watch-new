/**
 * Node API returns a flat `Record<countryCode, name>`.
 * Laravel `BaseController::sendResponse` wraps payload as `{ success, data, message }`.
 * Normalize so the TM Watch pages always get the country map.
 */
export function normalizeAllowedCountriesPayload(
  payload: unknown,
): Record<string, string> {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }
  const o = payload as Record<string, unknown>;
  const inner = o["data"];
  if (
    o["success"] === true &&
    inner != null &&
    typeof inner === "object" &&
    !Array.isArray(inner)
  ) {
    return inner as Record<string, string>;
  }
  return o as Record<string, string>;
}
