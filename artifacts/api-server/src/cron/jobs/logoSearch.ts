import { db } from "@workspace/db";
import { logoSearchesTable, logoResultsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger";

const LOGO_SEARCH_API = "http://logo-search-api.example.com";

export async function logoSearch() {
  const images = await db.select().from(logoSearchesTable);

  if (!images.length) {
    logger.info("No logo search images to process");
    return;
  }

  for (const image of images) {
    try {
      const fileUrl = image.fileUrl || `storage/logo_watch/${image.userId}/${image.file}`;

      logger.info({
        logoSearchId: image.id,
        file: image.file,
        userId: image.userId,
      }, "Processing logo search (external logo comparison API required)");

    } catch (err) {
      logger.error({ err, logoSearchId: image.id }, "Logo search check failed");
    }
  }
}
