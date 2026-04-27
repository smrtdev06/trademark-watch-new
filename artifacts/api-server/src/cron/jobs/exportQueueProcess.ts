import { db } from "@workspace/db";
import { exportQueueTable } from "@workspace/db";
import { isNull, eq } from "drizzle-orm";
import { logger } from "../../lib/logger";

export async function exportQueueProcess() {
  const queue = await db.select().from(exportQueueTable)
    .where(isNull(exportQueueTable.status))
    .limit(5);

  if (!queue.length) return;

  for (const item of queue) {
    await db.update(exportQueueTable)
      .set({ status: 10 })
      .where(eq(exportQueueTable.id, item.id));

    try {
      const params = item.params as Record<string, any> || {};
      const isPdf = params.type === "pdf";
      const ext = isPdf ? ".pdf" : ".xlsx";
      const typeSafe = (item.type || "export").replace(/[\s\/]/g, "_").toLowerCase();
      const fileName = `${typeSafe}_${item.userId}_${Date.now()}${ext}`;

      logger.info({
        exportId: item.id,
        type: item.type,
        fileName,
        format: isPdf ? "pdf" : "xlsx",
      }, "Export queue item processed (file generation requires export class implementation)");

      await db.update(exportQueueTable)
        .set({ status: 30, file: fileName })
        .where(eq(exportQueueTable.id, item.id));

    } catch (err) {
      logger.error({ err, exportId: item.id }, "Export queue processing failed");
      await db.update(exportQueueTable)
        .set({ status: 20 })
        .where(eq(exportQueueTable.id, item.id));
    }
  }
}
