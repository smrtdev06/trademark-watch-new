import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pool } from "@workspace/db";
import { logger } from "./logger";

export function getGenfilesApiUrl(): string {
  return (process.env.GENFILES_API_URL ?? "https://genfiles.tmpilot.com").replace(/\/$/, "");
}

/** Public URL Genfiles calls when the PDF is ready. Must be reachable from their server. */
export function getGenfilesWebhookUrl(): string {
  if (process.env.GENFILES_WEBHOOK_URL) {
    return process.env.GENFILES_WEBHOOK_URL.replace(/\/$/, "");
  }
  const base =
    process.env.API_PUBLIC_URL ??
    process.env.APP_URL ??
    `http://127.0.0.1:${process.env.PORT ?? "5002"}`;
  return `${base.replace(/\/$/, "")}/api/pdf-ready`;
}

export function getReportsDir(): string {
  return process.env.GENFILES_REPORTS_DIR ?? path.resolve(process.cwd(), "data", "reports");
}

export async function ensureGenfilesTasksTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS genfiles_tasks (
      id               SERIAL PRIMARY KEY,
      external_task_id TEXT NOT NULL UNIQUE,
      user_id          INTEGER NOT NULL REFERENCES users(id),
      keyword          TEXT,
      appnos           JSONB NOT NULL,
      status           TEXT NOT NULL DEFAULT 'pending',
      pdf_urls         JSONB,
      local_paths      JSONB,
      created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
}

export function extractAppnosFromRiskGroups(riskGroups: Record<string, unknown[]>): number[] {
  const ids = new Set<number>();
  for (const items of Object.values(riskGroups)) {
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const raw = (item as { appno?: unknown }).appno;
      if (raw == null || raw === "") continue;
      const n = parseInt(String(raw).replace(/[^\d]/g, ""), 10);
      if (Number.isFinite(n) && n > 0) ids.add(n);
    }
  }
  return [...ids];
}

export async function createGenfilesPdfTask(opts: {
  userId: number;
  appnos: number[];
  keyword?: string;
}): Promise<{ externalTaskId: string; localId: number; appnoCount: number; status: string } | null> {
  if (process.env.GENFILES_DISABLED === "1") {
    logger.info("Genfiles integration disabled (GENFILES_DISABLED=1)");
    return null;
  }

  const unique = [...new Set(opts.appnos.filter((n) => Number.isFinite(n) && n > 0))];
  if (unique.length === 0) return null;

  await ensureGenfilesTasksTable();

  const placeholderId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const insert = await pool.query<{ id: number }>(
    `INSERT INTO genfiles_tasks (external_task_id, user_id, keyword, appnos, status)
     VALUES ($1, $2, $3, $4::jsonb, 'scheduled')
     RETURNING id`,
    [placeholderId, opts.userId, opts.keyword ?? null, JSON.stringify(unique)],
  );
  const localId = Number(insert.rows[0]?.id ?? 0);
  if (!localId) return null;

  const webhookUrl = getGenfilesWebhookUrl();
  const apiUrl = `${getGenfilesApiUrl()}/api/tasks`;

  const body = {
    schedule_type: "once",
    cron_expression: "",
    payload: { appnos: unique },
    webhook_url: webhookUrl,
  };

  let externalTaskId: string;
  try {
    const resp = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });

    const text = await resp.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      logger.error({ status: resp.status, preview: text.slice(0, 300) }, "Genfiles task: non-JSON response");
      await pool.query(`UPDATE genfiles_tasks SET status = 'failed', updated_at = NOW() WHERE id = $1`, [localId]);
      return null;
    }

    if (!resp.ok || !json?.success || !json?.data?.id) {
      logger.error({ status: resp.status, json }, "Genfiles task creation failed");
      await pool.query(`UPDATE genfiles_tasks SET status = 'failed', updated_at = NOW() WHERE id = $1`, [localId]);
      return null;
    }

    externalTaskId = String(json.data.id);
  } catch (err) {
    logger.error({ err, apiUrl }, "Genfiles task request failed");
    await pool.query(`UPDATE genfiles_tasks SET status = 'failed', updated_at = NOW() WHERE id = $1`, [localId]);
    return null;
  }

  await pool.query(
    `UPDATE genfiles_tasks
     SET external_task_id = $2, status = 'pending', updated_at = NOW()
     WHERE id = $1`,
    [localId, externalTaskId],
  );

  logger.info(
    { externalTaskId, localId, appnoCount: unique.length, webhookUrl },
    "Genfiles PDF task created",
  );

  return { externalTaskId, localId, appnoCount: unique.length, status: "pending" };
}

export async function handleGenfilesPdfWebhook(body: {
  task_id?: string;
  pdf_urls?: string[];
}): Promise<void> {
  const taskId = body.task_id;
  const pdfUrls = body.pdf_urls ?? [];
  if (!taskId) return;

  await ensureGenfilesTasksTable();

  const found = await pool.query<{ id: number; user_id: number }>(
    `SELECT id, user_id FROM genfiles_tasks WHERE external_task_id = $1 LIMIT 1`,
    [taskId],
  );

  const row = found.rows[0];
  if (!row) {
    logger.warn({ taskId }, "Genfiles webhook: unknown task_id");
    return;
  }

  const reportsDir = getReportsDir();
  await mkdir(reportsDir, { recursive: true });

  const localPaths: string[] = [];
  for (let i = 0; i < pdfUrls.length; i++) {
    const url = pdfUrls[i];
    if (!url) continue;
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(120_000) });
      if (!resp.ok) continue;
      const buffer = Buffer.from(await resp.arrayBuffer());
      const filename = `${taskId}${pdfUrls.length > 1 ? `-${i + 1}` : ""}.pdf`;
      const filePath = path.join(reportsDir, filename);
      await writeFile(filePath, buffer);
      localPaths.push(filePath);
    } catch (err) {
      logger.error({ err, url }, "Failed to download Genfiles PDF");
    }
  }

  await pool.query(
    `UPDATE genfiles_tasks
     SET status = $2, pdf_urls = $3::jsonb, local_paths = $4::jsonb, updated_at = NOW()
     WHERE id = $1`,
    [
      row.id,
      localPaths.length > 0 ? "completed" : "failed",
      JSON.stringify(pdfUrls),
      JSON.stringify(localPaths),
    ],
  );

  logger.info({ taskId, localPaths }, "Genfiles webhook processed");
}

export async function getGenfilesTaskForUser(localId: number, userId: number) {
  await ensureGenfilesTasksTable();
  const result = await pool.query<{
    id: number;
    external_task_id: string;
    keyword: string | null;
    appnos: number[];
    status: string;
    pdf_urls: string[] | null;
    local_paths: string[] | null;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, external_task_id, keyword, appnos, status, pdf_urls, local_paths, created_at, updated_at
     FROM genfiles_tasks WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [localId, userId],
  );
  return result.rows[0] ?? null;
}

export type GenfilesTaskRow = {
  id: number;
  external_task_id: string;
  keyword: string | null;
  appnos: number[];
  status: string;
  pdf_urls: string[] | null;
  local_paths: string[] | null;
  created_at: string;
  updated_at: string;
};

function normalizeGenfilesStatus(status: string): string {
  if (status === "ready") return "completed";
  return status;
}

export function serializeGenfilesTask(row: GenfilesTaskRow) {
  const status = normalizeGenfilesStatus(row.status);
  const localPaths = row.local_paths ?? [];
  return {
    id: row.id,
    externalTaskId: row.external_task_id,
    keyword: row.keyword,
    appnoCount: Array.isArray(row.appnos) ? row.appnos.length : 0,
    status,
    pdfUrls: row.pdf_urls ?? [],
    hasDownload: localPaths.length > 0 && (status === "completed" || status === "ready"),
    pdfCount: localPaths.length,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const LIST_STATUS_FILTERS: Record<string, string[]> = {
  scheduled: ["scheduled"],
  pending: ["pending"],
  completed: ["completed", "ready"],
  failed: ["failed"],
};

export async function listGenfilesTasksForUser(
  userId: number,
  opts: { status?: string; limit?: number; offset?: number } = {},
) {
  await ensureGenfilesTasksTable();

  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const statusKey = opts.status?.toLowerCase();
  const statuses = statusKey && statusKey !== "all" ? LIST_STATUS_FILTERS[statusKey] : null;

  const params: unknown[] = [userId];
  let where = "WHERE user_id = $1";
  if (statuses) {
    params.push(statuses);
    where += ` AND status = ANY($${params.length}::text[])`;
  }

  const countResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM genfiles_tasks ${where}`,
    params,
  );

  params.push(limit, offset);
  const result = await pool.query<GenfilesTaskRow>(
    `SELECT id, external_task_id, keyword, appnos, status, pdf_urls, local_paths, created_at, updated_at
     FROM genfiles_tasks
     ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return {
    total: Number(countResult.rows[0]?.count ?? 0),
    tasks: result.rows.map(serializeGenfilesTask),
  };
}
