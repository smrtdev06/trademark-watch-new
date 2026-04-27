import { db } from "@workspace/db";
import { socialKeywordsTable, socialResultsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";

/** Same as Laravel `env('SCALESERP_APIKEY')` in `App\Services\Scaleserp\Scaleserp`. */
const SERPER_IMAGES_URL = "https://google.serper.dev/images";

function getSerperApiKey(): string {
  return (
    process.env.SCALESERP_APIKEY ||
    process.env.SCALE_SERP_API_KEY ||
    ""
  );
}

function generateSubKeywords(keyword: string): string[] {
  const words: string[] = [keyword];
  const lower = keyword.toLowerCase();
  for (let i = 1; i < lower.length; i++) {
    words.push(lower.substring(0, i) + " " + lower.substring(i));
  }
  return [...new Set(words)];
}

/** Serper image rows — PHP uses `link`, `imageUrl`, `title`; newer payloads may differ slightly. */
type SerperImageRow = {
  link?: string;
  imageUrl?: string;
  title?: string;
  referrer_url?: string;
  original_image_url?: string;
  thumbnail_url?: string;
  text?: string;
  site_title?: string;
};

function normalizeSerperImage(r: SerperImageRow): {
  pageUrl: string;
  imageUrl: string;
  title: string;
} {
  const pageUrl =
    (typeof r.link === "string" && r.link) ||
    (typeof r.referrer_url === "string" && r.referrer_url) ||
    "";
  const imageUrl =
    (typeof r.imageUrl === "string" && r.imageUrl) ||
    (typeof r.original_image_url === "string" && r.original_image_url) ||
    (typeof r.thumbnail_url === "string" && r.thumbnail_url) ||
    "";
  const title =
    (typeof r.title === "string" && r.title) ||
    (typeof r.text === "string" && r.text) ||
    (typeof r.site_title === "string" && r.site_title) ||
    "";
  return { pageUrl, imageUrl, title };
}

/**
 * Mirrors `App\Services\Scaleserp\Scaleserp::search` — POST JSON to Serper Images.
 */
async function serperImageSearch(q: string, page = 1): Promise<SerperImageRow[]> {
  const apiKey = getSerperApiKey();
  if (!apiKey) {
    return [];
  }

  const response = await fetch(SERPER_IMAGES_URL, {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q,
      num: 10,
      autocorrect: false,
      page,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    logger.warn(
      { status: response.status, q, body: text.slice(0, 500) },
      "Serper images HTTP error",
    );
    return [];
  }

  const data = (await response.json()) as { images?: SerperImageRow[] };
  return Array.isArray(data.images) ? data.images : [];
}

export async function scaleSerpRun() {
  const today = new Date().toISOString().split("T")[0];

  /** Manual runs: `SOCIAL_WATCH_CRON_FORCE=1 pnpm social-watch:cron` processes all keywords, ignoring next-run date. */
  const force =
    process.env.SOCIAL_WATCH_CRON_FORCE === "1" ||
    process.env.FORCE_SOCIAL_WATCH_RUN === "1";

  const keywords = force
    ? await db.select().from(socialKeywordsTable)
    : await db
        .select()
        .from(socialKeywordsTable)
        .where(sql`trigger_at IS NULL OR trigger_at = ${today}::date`);

  if (!keywords.length) {
    logger.info("No social watch keywords to process");
    return;
  }

  if (force) {
    logger.info({ count: keywords.length }, "Social watch cron: force mode (all keywords)");
  }

  if (!getSerperApiKey()) {
    logger.info(
      "SCALESERP_APIKEY (or SCALE_SERP_API_KEY) not set — skipping Serper searches (same as Laravel without SCALESERP_APIKEY)",
    );
  }

  for (const keyword of keywords) {
    let subKeywords: string[];

    if (keyword.mode === "variation") {
      subKeywords = generateSubKeywords(keyword.keyword);
    } else {
      subKeywords = [keyword.keyword];
    }

    const chunks: string[][] = [];
    for (let i = 0; i < subKeywords.length; i += 6) {
      chunks.push(subKeywords.slice(i, i + 6));
    }

    for (const chunk of chunks) {
      try {
        // Align with PHP: site:domain "kw1 OR kw2 OR ..."
        const searchQuery = `site:${keyword.site} "${chunk.join(" OR ")}"`;

        if (!getSerperApiKey()) {
          continue;
        }

        const images = await serperImageSearch(searchQuery, 1);

        for (const raw of images) {
          const img = normalizeSerperImage(raw);
          if (!img.pageUrl && !img.imageUrl) continue;

          const pageKey = img.pageUrl || img.imageUrl;

          const existing = await db
            .select()
            .from(socialResultsTable)
            .where(
              and(
                eq(socialResultsTable.userId, keyword.userId),
                eq(socialResultsTable.pageUrl, pageKey),
              ),
            )
            .limit(1);

          if (existing.length > 0) continue;

          await db.insert(socialResultsTable).values({
            scaleSerpId: keyword.id,
            userId: keyword.userId,
            pageUrl: pageKey,
            title: img.title,
            imageUrl: img.imageUrl,
            imageFile: "",
          });
        }
      } catch (err) {
        logger.error({ err, keyword: keyword.keyword }, "Social watch Serper search failed");
      }
    }

    const nextTrigger = new Date();
    nextTrigger.setDate(nextTrigger.getDate() + keyword.freq);
    await db
      .update(socialKeywordsTable)
      .set({ triggerAt: nextTrigger.toISOString().split("T")[0] })
      .where(eq(socialKeywordsTable.id, keyword.id));
  }
}
