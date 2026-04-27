/**
 * Exact mirror of `App\Classes\CountryList::ALL` (PHP associative array order preserved).
 * Laravel `UserController::allowedCountries` returns this for admins; TM Watch / limits
 * modals use the same list (`add-keywords.blade.php`, `limits-modal.blade.php`).
 *
 * PHP source has two `'MOR'` keys; the second (`Morocco`) wins at runtime — we expose one.
 */
export const COUNTRY_LIST_ALL: Record<string, string> = {
  IN: "India",
  GEO: "Georgia",
  ISR: "Israel",
  RUS: "Russian Federation",
  CZE: "Czech Republic",
  ZHN: "China",
  MON: "Monaco",
  MOR: "Morocco",
  PAK: "Pakistan",
  LIT: "Lithuania",
  SLK: "Sri Lanka",
  KEN: "Kenya",
  IRE: "Ireland",
  EST: "Estonia",
  HKG: "Hong Kong",
  CYP: "Cyprus",
  BHU: "Bhutan",
  AST: "Austria",
  CAM: "Cambodia",
  EUROPE: "Europe",
  CHILE: "Chile",
  CRO: "Croatia",
  FIN: "Finland",
  CAN: "Canada",
  AUS: "Australia",
  VTM: "Vietnam",
  SPN: "Spain",
  USA: "USA",
  GBR: "UK",
  DEU: "Germany",
};

/** Same as PHP `CountryList::getCountryName` — only `ALL`, not `LIST`. */
export function getCountryName(code: string): string | undefined {
  return COUNTRY_LIST_ALL[code];
}
