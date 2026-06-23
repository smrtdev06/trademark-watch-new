import { Router, type IRouter } from "express";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { requireAuth, parseId } from "../lib/auth";
import {
  createGenfilesPdfTask,
  getGenfilesTaskForUser,
  handleGenfilesPdfWebhook,
  listGenfilesTasksForUser,
  serializeGenfilesTask,
} from "../lib/genfilesClient";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/** Webhook from Genfiles Cron Task Scheduler when PDF is ready (no auth — optional secret). */
router.post("/pdf-ready", async (req, res): Promise<void> => {
  const secret = process.env.GENFILES_WEBHOOK_SECRET;
  if (secret) {
    const header = req.headers["x-webhook-secret"] ?? req.query.secret;
    if (header !== secret) {
      res.status(401).json({ received: false, message: "Invalid webhook secret" });
      return;
    }
  }

  res.status(200).json({ received: true });

  const { task_id, pdf_urls } = req.body as { task_id?: string; pdf_urls?: string[] };
  void handleGenfilesPdfWebhook({ task_id, pdf_urls }).catch((err) => {
    logger.error({ err }, "Genfiles webhook handler failed");
  });
});

/** Create a Genfiles PDF task from application numbers (phonetic search follow-up). */
router.post("/genfiles/tasks", requireAuth, async (req, res): Promise<void> => {
  const { appnos, keyword } = req.body as { appnos?: number[]; keyword?: string };
  if (!Array.isArray(appnos) || appnos.length === 0) {
    res.status(400).json({ status: 400, message: "appnos array is required" });
    return;
  }

  const task = await createGenfilesPdfTask({
    userId: req.user!.id,
    appnos,
    keyword,
  });

  if (!task) {
    res.status(502).json({ status: 502, message: "Could not create Genfiles task" });
    return;
  }

  res.json({
    status: 200,
    genfilesTask: {
      id: task.localId,
      externalTaskId: task.externalTaskId,
      appnoCount: task.appnoCount,
      status: task.status,
    },
  });
});

router.get("/genfiles/tasks", requireAuth, async (req, res): Promise<void> => {
  const status = typeof req.query.status === "string" ? req.query.status : "all";
  const limit = parseInt(String(req.query.limit ?? "50"), 10) || 50;
  const offset = parseInt(String(req.query.offset ?? "0"), 10) || 0;

  const result = await listGenfilesTasksForUser(req.user!.id, { status, limit, offset });
  res.json({ status: 200, ...result });
});

router.get("/genfiles/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const row = await getGenfilesTaskForUser(id, req.user!.id);
  if (!row) {
    res.status(404).json({ status: 404, message: "Task not found" });
    return;
  }

  res.json(serializeGenfilesTask(row));
});

router.get("/genfiles/tasks/:id/download", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const index = parseInt(String(req.query.index ?? "0"), 10) || 0;
  const row = await getGenfilesTaskForUser(id, req.user!.id);
  if (!row) {
    res.status(404).json({ status: 404, message: "Task not found" });
    return;
  }

  const paths = row.local_paths ?? [];
  const filePath = paths[index];
  if (!filePath || !existsSync(filePath)) {
    res.status(404).json({ status: 404, message: "PDF not ready yet" });
    return;
  }

  const filename = path.basename(filePath);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  createReadStream(filePath).pipe(res);
});

export default router;
