/**
 * Ports core matching metrics from Laravel {@link ../new-monitoring/app/Services/Similarity/Similarity.php}
 * and gate logic referenced in {@link ../new-monitoring/app/Services/Monitoring/Monitoring.php} processScope().
 *
 * Stop-word CSV / Settings lists (findInStopList) are not ported — PHP uses public/stop-list.csv + settings.
 */

function levenshteinRatioRaw(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  const dist = dp[m][n];
  const maxLen = Math.max(m, n);
  if (maxLen === 0) return 100;
  return Math.round(((maxLen - dist) / maxLen) * 100);
}

/**
 * PHP FuzzyWuzzy uses max(ratio, partial_ratio, token_sort, token_set). Full-string Levenshtein % alone
 * rejects short keywords (e.g. "india") vs long tm names — this approximates partial/token behaviour.
 */
export function highestFuzzyLikePhp(wordToCompare: string, monitoringTmAppliedFor: string): number {
  const a0 = wordToCompare.toLowerCase().trim();
  const b0 = monitoringTmAppliedFor.toLowerCase().trim();
  if (!a0 || !b0) return 0;
  let best = levenshteinRatioRaw(a0, b0);
  const bWords = b0.split(/\s+/).filter(Boolean);
  for (const w of bWords) {
    best = Math.max(best, levenshteinRatioRaw(a0, w));
  }
  const aWords = a0.split(/\s+/).filter(Boolean);
  for (const wa of aWords) {
    for (const wb of bWords) {
      best = Math.max(best, levenshteinRatioRaw(wa, wb));
    }
  }
  if (a0.length >= 3 && b0.includes(a0)) {
    best = Math.max(best, 92);
  }
  const tokenSort = (s: string) =>
    s
      .split(/\s+/)
      .filter(Boolean)
      .sort()
      .join(" ");
  best = Math.max(best, levenshteinRatioRaw(tokenSort(a0), tokenSort(b0)));
  return best;
}

/** PHP Similarity::checkWord — normalize trademark text before comparison. */
export function checkWordPhp(word: string): string {
  let w = word.replace(/\./g, "").replace(/,/g, "");
  const arr = w.split(/\s+/);
  for (const val of arr) {
    if (val.length > 1) {
      return w;
    }
  }
  return w.replace(/\s+/g, "");
}

/**
 * PHP similar_text(): returns count of matching chars; percent = count * 200 / (len1 + len2).
 * Algorithm matches phpjs `similar_text` (recursive longest common substring).
 */
function similarTextCount(firstStr: string, secondStr: string): number {
  let pos1 = 0;
  let pos2 = 0;
  let max = 0;

  for (let p = 0; p < firstStr.length; p++) {
    for (let q = 0; q < secondStr.length; q++) {
      let l = 0;
      for (
        ;
        p + l < firstStr.length &&
        q + l < secondStr.length &&
        firstStr.charAt(p + l) === secondStr.charAt(q + l);
        l++
      ) {
        /* grow match */
      }
      if (l > max) {
        max = l;
        pos1 = p;
        pos2 = q;
      }
    }
  }

  let sum = max;

  if (sum > 0) {
    if (pos1 && pos2) {
      sum += similarTextCount(firstStr.substring(0, pos1), secondStr.substring(0, pos2));
    }

    if (pos1 + max < firstStr.length && pos2 + max < secondStr.length) {
      sum += similarTextCount(
        firstStr.substring(pos1 + max),
        secondStr.substring(pos2 + max),
      );
    }
  }

  return sum;
}

/** PHP similar_text(..., $percent) — percentage. */
export function phpSimilarTextPercent(a: string, b: string): number {
  const firstStr = a;
  const secondStr = b;
  if (firstStr.length + secondStr.length === 0) {
    return 100;
  }
  const sum = similarTextCount(firstStr, secondStr);
  return (sum * 200) / (firstStr.length + secondStr.length);
}

/** PHP Similarity::similarityScore — similar_text percent only. */
export function similarityScorePhp(a: string, b: string): number {
  return phpSimilarTextPercent(a.toLowerCase().trim(), b.toLowerCase().trim());
}

/**
 * PHP Similarity::similarityScoreBulk (class-based stop words omitted).
 */
export function similarityScoreBulkPhp(wordToCompare: string, monitoringTmAppliedFor: string): number {
  const string1 = wordToCompare.toLowerCase().trim();
  const string2 = monitoringTmAppliedFor.toLowerCase().trim();
  const strings = string2.split(/\s+/).filter(Boolean).slice(0, 2);
  const sourceStrings = string1.split(/\s+/).filter(Boolean);

  let max = 0;
  for (const sourceString of sourceStrings) {
    for (const str of strings) {
      const score = similarityScorePhp(sourceString, str.trim());
      if (score >= max) max = score;
    }
  }
  return max;
}

function levenshteinRaw(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * PHP Similarity::similarityScoreLevenshteinBulk(..., $inPercents = false, ..., $chunk = 2)
 * returns minimum raw Levenshtein distance across word pairs.
 */
export function similarityScoreLevenshteinBulkRawMin(
  wordToCompare: string,
  monitoringTmAppliedFor: string,
  chunk: number,
): number {
  const string1 = wordToCompare.toLowerCase().trim();
  const string2 = monitoringTmAppliedFor.toLowerCase().trim();
  const strings = string2.split(/\s+/).filter(Boolean).slice(0, chunk || 2);
  const sourceStrings = string1.split(/\s+/).filter(Boolean);

  let min = 1_000_000;
  for (const sourceString of sourceStrings) {
    for (const str of strings) {
      const d = levenshteinRaw(sourceString, str.trim());
      if (d < min) min = d;
    }
  }
  return min === 1_000_000 ? 0 : min;
}

/** PHP Monitoring::checkSameClass — true => skip insert (same PHP continue). */
export function checkSameClassPhp(
  appClass: string[],
  sourceClasses: string[],
  lds: number,
  fuzzy: number,
): boolean {
  const same = appClass.filter((c) => sourceClasses.includes(c)).length;
  return same === 0 && lds > 3 && fuzzy < 74;
}
