import { db } from "@workspace/db";
import { alertsTable, alertResultsTable, alertChangesTable } from "@workspace/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";

const ALERT_URLS: Record<string, string> = {
  fssai: "http://citations.rasr.in:3000",
  mca: "http://citations.rasr.in:3000",
  udyaam: "http://citations.rasr.in:3000",
  citations: "http://citations.rasr.in/api/crawler_sitemapindexrecord",
  opposition_watch: "http://156.96.118.223/test/sys/search_oppdetails.php",
  proprietor_search: "http://193.30.120.239/test/madrid2.php",
  domain_monitoring: "http://89.40.6.177:8080/api/rest/search",
};

function calcDate(freq: number): [string, string] {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - freq - 1);
  return [from.toISOString().split("T")[0], now.toISOString().split("T")[0]];
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

async function getViaApi(type: string, keyword: string, freq: number): Promise<any[]> {
  const baseUrl = ALERT_URLS[type];
  if (!baseUrl) return [];

  const [dateFrom, dateTo] = calcDate(freq);

  try {
    let url: string;
    let options: RequestInit = {};

    switch (type) {
      case "fssai":
        url = `${baseUrl}/fassai_records?companyname=ilike.* ${keyword}*&licenseactive=eq.Active&and=(created_at.gte.${dateFrom},created_at.lte.${dateTo})`;
        break;
      case "mca":
        url = `${baseUrl}/mca_records?name=ilike.* ${keyword}*&and=(date.gte.${dateFrom},date.lte.${dateTo})`;
        break;
      case "udyaam":
        url = `${baseUrl}/udyam_records?name=ilike.* ${keyword}*&and=(date.gte.${dateFrom},date.lte.${dateTo})`;
        break;
      case "citations":
        url = `${baseUrl}?select=id,url,brand,manufacturer,crawler_sitemapconfig(sitename)&brand=ilike.%25${keyword}%25`;
        break;
      case "opposition_watch":
        url = `${baseUrl}?oppname=${keyword.trim()}&oppnameMode=contains`;
        break;
      case "proprietor_search": {
        const arr = keyword.toLowerCase().split(" ");
        const input = arr.slice(0, 3).join(" ").replace(/m\/s\.\s?|m\/s/g, "").trim();
        url = `${baseUrl}?buisnessNameMode=contains&buisnessName=${encodeURIComponent(input)}&propName=${encodeURIComponent(input)}&propNameMode=contains&or_group=buisnessName,propName`;
        break;
      }
      case "domain_monitoring": {
        url = baseUrl;
        options = {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: JSON.stringify({ like: `%${keyword}%`, from: dateFrom, to: dateTo }),
        };
        break;
      }
      default:
        return [];
    }

    const response = await fetch(url, options);
    if (!response.ok) return [];

    const data = await response.json();

    if (type === "opposition_watch" || type === "proprietor_search") {
      return data?.data ?? [];
    }
    if (type === "domain_monitoring") {
      return data?.whois_db_whois ?? [];
    }
    return Array.isArray(data) ? data : [];
  } catch (err) {
    logger.error({ err, type, keyword }, "Alert API request failed");
    return [];
  }
}

function getUniqId(type: string, record: any): string {
  switch (type) {
    case "fssai": return String(record.id || "");
    case "mca": return String(record.cin || "");
    case "udyaam": return String(record.id || "");
    case "citations": return String(record.id || "");
    case "opposition_watch": return String(record.appno || "");
    case "proprietor_search": return String(record.id || "");
    case "domain_monitoring": return String(record.domain_name || "");
    default: return "";
  }
}

function getName(type: string, record: any): string {
  switch (type) {
    case "fssai": return record.companyname || "";
    case "mca": return record.name || "";
    case "udyaam": return record.name || "";
    case "citations": return record.brand || "";
    case "opposition_watch": return record.oppname || "";
    case "proprietor_search": return record.buisnessName || "";
    case "domain_monitoring": return record.domain_name || "";
    default: return "";
  }
}

function getAddress(type: string, record: any): string {
  switch (type) {
    case "fssai": return record.premiseaddress || "";
    case "mca": return record.address || "";
    case "udyaam": return record.address || "";
    case "citations": return record.url || "";
    case "opposition_watch": return record.appno || "";
    case "proprietor_search": return record.tmAppliedFor || "";
    case "domain_monitoring": return "";
    default: return "";
  }
}

export async function alertsCheck(type: string) {
  const today = todayStr();

  const alerts = await db.select().from(alertsTable)
    .where(and(
      eq(alertsTable.type, type),
      sql`(next_check_date IS NULL OR next_check_date = ${today}::date)`
    ));

  if (!alerts.length) return;

  for (const alert of alerts) {
    try {
      const newRecords = await getViaApi(type, alert.keyword, alert.freq);

      if (!newRecords.length) {
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + alert.freq);
        await db.update(alertsTable)
          .set({ nextCheckDate: nextDate.toISOString().split("T")[0] })
          .where(eq(alertsTable.id, alert.id));
        continue;
      }

      const recordsToSave: { alertId: number; recordId: string }[] = [];
      const resultsToSave: { type: string; alertId: number; name: string; address: string; recordId: string }[] = [];

      for (const record of newRecords) {
        const uniq = getUniqId(type, record);
        if (!uniq) continue;

        const existing = await db.select().from(alertChangesTable)
          .where(eq(alertChangesTable.recordId, uniq))
          .limit(1);

        if (existing.length === 0) {
          resultsToSave.push({
            type,
            alertId: alert.id,
            name: getName(type, record),
            address: getAddress(type, record),
            recordId: uniq,
          });
          recordsToSave.push({
            alertId: alert.id,
            recordId: uniq,
          });
        }
      }

      if (recordsToSave.length > 0) {
        for (const change of recordsToSave) {
          await db.insert(alertChangesTable).values(change);
        }
        for (const result of resultsToSave) {
          await db.insert(alertResultsTable).values({
            alertId: result.alertId,
            type: result.type,
            name: result.name,
            address: result.address,
            recordId: result.recordId,
            userId: alert.userId,
            clientId: alert.clientId,
          });
        }
      }

      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + alert.freq);
      await db.update(alertsTable)
        .set({ nextCheckDate: nextDate.toISOString().split("T")[0] })
        .where(eq(alertsTable.id, alert.id));

    } catch (err) {
      logger.error({ err, type, alertId: alert.id }, "Alert check failed");
    }
  }
}
