import { Router, type IRouter } from "express";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

const EXTERNAL_APIS = {
  companySearch: "http://193.30.120.239/test/madrid2.php",
  assessmentApi: "http://193.30.120.239/test/search_assessment.php",
  assessmentModeApi: "http://api.maxfabulous.com:8080/search/",
  oppositionSearch: "http://23.148.145.241/test/sys/search_oppdetails.php",
  license: "http://citations.rasr.in:3000",
  citations: "http://citations.rasr.in/api/crawler_sitemapindexrecord",
};

function getFullImageUrl(appno: string): string {
  if (!appno) return "";
  const s = String(appno).trim();
  const len = s.length;
  let img = "";
  if (len === 6) {
    const parts = s.match(/.{1,2}/g) || [];
    img = "00/00/" + parts.join("/");
  } else if (len === 7) {
    const start = s[0];
    const rest = s.substring(1);
    const parts = rest.match(/.{1,2}/g) || [];
    img = "00/0" + start + "/" + parts.join("/");
  }
  if (img) {
    return "https://cdn.tmpilot.com/file/tmrimages/" + img + ".jpg";
  }
  return "";
}

function decodeString(str: string): string {
  if (!str) return str;
  let decoded = str;
  try {
    decoded = decoded
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&#39;/g, "'");
  } catch {}
  return decoded;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

function similarityScore(keyword: string, tmName: string): number {
  const a = keyword.toLowerCase().trim();
  let b = tmName.toLowerCase().trim();
  b = b.replace(/\([^)]+\)/g, "").trim();
  const withPos = b.indexOf("with ");
  if (withPos !== -1) b = b.substring(0, withPos).trim();

  if (!a || !b) return 0;

  let minLev = 100;
  for (const word of b.split(/\s+/)) {
    const lev = levenshtein(a, word);
    if (lev < minLev) minLev = lev;
  }

  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 100;
  const levScore = Math.round((1 - minLev / Math.max(a.length, Math.max(...b.split(/\s+/).map(w => w.length), 1))) * 100);

  const fullLev = levenshtein(a, b);
  const fullScore = Math.round((1 - fullLev / maxLen) * 100);

  return Math.max(levScore, fullScore);
}

function categorizeRisk(keyword: string, item: any): string {
  const score = similarityScore(keyword, item.tmAppliedFor || "");

  const st = (item.status || "").toLowerCase();
  if (st === "removed" || st === "withdrawn") return "low";

  if (score > 80) return "vhigh";
  if (score >= 70) return "high";
  if (score >= 60) return "medium";
  if (score >= 45) return "low";
  return "other";
}

function formatDate(dateStr: string): string {
  if (!dateStr || dateStr === "--" || !dateStr.trim()) return "";
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    }
  } catch {}
  return dateStr;
}

function deriveCompanyType(companyName: string): string {
  if (!companyName) return "-";
  const cn = companyName.toLowerCase().replace(/\./g, "");
  if (cn.includes("private limited") || cn.includes("pvtltd") || cn.includes("pvt ltd") || cn.includes("private ltd") || cn.includes("pvt limited")) return "Private Limited";
  if (cn.includes("limited") || cn.includes("ltd")) return "Limited";
  if (/\sinc\./.test(companyName.toLowerCase()) || cn.includes("incorporation")) return "INC";
  return "-";
}

router.post("/proprietor", requireAuth, async (req, res): Promise<void> => {
  const { name, address, buisnessType, state, country } = req.body;
  if (!name && !address) {
    res.status(400).json({ status: 400, message: "Company name or address is required" });
    return;
  }

  try {
    const input = (name || "")
      .toLowerCase()
      .replace(/m\/s\.\s?|m\/s/g, "")
      .split(" ")
      .slice(0, 3)
      .join(" ")
      .trim();

    let url = EXTERNAL_APIS.companySearch;

    if (address && address.trim()) {
      url += "?proprietorAdrMode=contains&proprietorAdr=" + encodeURIComponent(address.trim());
      if (input) {
        url += "&buisnessNameMode=contains&buisnessName=" + encodeURIComponent(input);
      }
    } else {
      url += "?buisnessNameMode=contains&buisnessName=" + encodeURIComponent(input);
    }

    if (input) {
      url += "&propName=" + encodeURIComponent(input) + "&propNameMode=contains&or_group=buisnessName,propName";
    }

    if (Array.isArray(buisnessType)) {
      buisnessType.forEach((bt: string) => { url += "&additionalBuisnessType[]=" + encodeURIComponent(bt); });
    }
    if (Array.isArray(state)) {
      state.forEach((s: string) => { url += "&additionalState[]=" + encodeURIComponent(s); });
    }
    if (Array.isArray(country)) {
      country.forEach((c: string) => { url += "&additionalCountry[]=" + encodeURIComponent(c); });
    }

    url += "&per_page=10000";

    const response = await fetch(url);
    if (!response.ok) {
      res.json({ status: 200, data: [], message: "External API returned error" });
      return;
    }

    const tmpData = await response.json();

    if (!tmpData || (tmpData.status !== undefined && tmpData.status !== 1) || !tmpData.data || !tmpData.data.length) {
      res.json({ status: 200, data: [], message: "No results found" });
      return;
    }

    const data = tmpData.data.map((item: any) => {
      item.buisnessName = decodeString(item.buisnessName || "");
      item.tmAppliedFor = decodeString(item.tmAppliedFor || "");
      item.imgfile = getFullImageUrl(String(item.appno || ""));
      item.status = decodeString(item.status || "");

      if (item.userDetail && item.userDetail.toLowerCase().trim() === "proposed to be used") {
        item.userDetail = "PU";
      }

      item.dateOfApp = formatDate(item.dateOfApp);
      if (item.validUpto && item.validUpto !== "--" && item.validUpto.trim()) {
        item.validUpto = formatDate(item.validUpto);
      }

      return item;
    });

    const classWise: Record<string, number> = {};
    const yearWise: Record<string, number> = {};
    let totalAbandoned = 0;
    let totalRegistered = 0;
    const withUserDetails: Record<string, number> = {};
    const withDateOfApp: Record<string, number> = {};
    const agents: Record<string, number> = {};
    const filterStatus: string[] = [];
    const filterClass: string[] = [];
    const filterBuisnessName: string[] = [];

    data.forEach((item: any) => {
      const cls = item.class || "unknown";
      classWise[cls] = (classWise[cls] || 0) + 1;

      if (!filterClass.includes(String(cls))) filterClass.push(String(cls));

      const statusVal = (item.status || "").trim();
      if (statusVal && !filterStatus.includes(statusVal)) filterStatus.push(statusVal);

      const compName = (item.buisnessName || "").trim();
      if (compName && !filterBuisnessName.includes(compName)) filterBuisnessName.push(compName);

      if (item.dateOfApp) {
        const yearMatch = item.dateOfApp.match(/(\d{4})$/);
        if (yearMatch) {
          const yr = yearMatch[1];
          yearWise[yr] = (yearWise[yr] || 0) + 1;
        }
      }

      const st = (item.status || "").toLowerCase();
      if (st === "abandoned") totalAbandoned++;
      if (st === "registered") totalRegistered++;

      const agentName = (item.agentName || "").trim();
      if (agentName) {
        agents[agentName] = (agents[agentName] || 0) + 1;
      }

      if (item.userDetail && item.userDetail !== "PU") {
        const udMatch = item.userDetail.match(/(\d{4})$/);
        if (udMatch) {
          const yr = udMatch[1];
          withUserDetails[yr] = (withUserDetails[yr] || 0) + 1;
        }
      } else if (item.userDetail === "PU" && item.dateOfApp) {
        const dMatch = item.dateOfApp.match(/(\d{4})$/);
        if (dMatch) {
          const yr = dMatch[1];
          withDateOfApp[yr] = (withDateOfApp[yr] || 0) + 1;
        }
      }
    });

    const sortedAgents = Object.entries(agents)
      .sort(([, a], [, b]) => b - a)
      .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {} as Record<string, number>);

    const total = data.length;
    const dropOutRate = total > 0 ? Math.round((totalAbandoned / total) * 100) : 0;
    const renewalRate = total > 0 ? Math.round((totalRegistered / total) * 100) : 0;

    res.json({
      status: 200,
      data,
      stats: {
        total,
        dropOutRate,
        renewalRate,
        classWise,
        yearWise,
        withUserDetails,
        withDateOfApp,
        agents: sortedAgents,
        filterStatus,
        filterClass,
        filterBuisnessName,
      },
    });
  } catch (err: any) {
    console.error("Proprietor search error:", err.message);
    res.json({ status: 200, data: [], message: "Error fetching data: " + err.message });
  }
});

router.post("/proprietor/export", requireAuth, async (_req, res): Promise<void> => {
  res.json({ status: 200, file: "export_proprietor.xlsx" });
});

router.post("/assessment", requireAuth, async (req, res): Promise<void> => {
  const { name, className, searchMode } = req.body;
  if (!name) {
    res.status(400).json({ status: 400, message: "Trademark name is required" });
    return;
  }

  try {
    const cls = className === "all" ? "99" : (className || "99");
    let url = EXTERNAL_APIS.assessmentApi +
      "?query=" + encodeURIComponent(name.trim()) +
      "&class=" + cls +
      "&name=wtw&ip=45.77.245.200&api_key=9964341237e54debf412c2820cb84aab46509891e5cbe82529555f99833772d4";

    let modeApiWorked = false;
    let modeResults: any[] = [];

    if (searchMode) {
      try {
        const modeCls = className === "all" ? "0" : (className || "99");
        const modeUrl = EXTERNAL_APIS.assessmentModeApi +
          "?tm=" + encodeURIComponent(name.trim()) +
          "&class=" + modeCls +
          "&name=wtw&ip=45.77.245.200&api_key=9964341237e54debf412c2820cb84aab46509891e5cbe82529555f99833772d4" +
          "&mode=" + encodeURIComponent(searchMode) +
          "&new_class=1";
        const modeResponse = await fetch(modeUrl, { signal: AbortSignal.timeout(15000) });
        if (modeResponse.ok) {
          const modeResult = await modeResponse.json();
          if (!modeResult.error && modeResult.result) {
            modeResults = modeResult.result;
            modeApiWorked = true;
          }
        }
      } catch {}
    }

    if (searchMode && modeApiWorked) {
      const filterStatus = [...new Set(modeResults.map((r: any) => r.status).filter(Boolean))] as string[];
      const filterState = [...new Set(modeResults.map((r: any) => r.state).filter(Boolean))] as string[];
      const filterCompanyType = [...new Set(modeResults.map((r: any) => r.buisnessType).filter(Boolean))] as string[];

      res.json({
        status: 200,
        data: modeResults,
        searchMode: true,
        filters: { filterStatus, filterState, filterCompanyType },
      });
      return;
    }

    const response = await fetch(url);
    if (!response.ok) {
      res.json({ status: 200, data: [], message: "External API error" });
      return;
    }

    const result = await response.json();

    const refs = result?.compare?.references;
    if (!refs || typeof refs !== "object" || Object.keys(refs).length === 0) {
      if (searchMode) {
        res.json({ status: 200, data: [], searchMode: true, filters: { filterStatus: [], filterState: [], filterCompanyType: [] } });
      } else {
        res.json({
          status: 200,
          riskGroups: { vhigh: [], high: [], medium: [], low: [], other: [] },
          sectionStatuses: { vhigh: "", high: "", medium: "", low: "", other: "" },
          searchMode: false,
          stats: {
            total: 0, dropOutRate: 0, renewalRate: 0,
            classWise: {}, yearWise: {},
            withUserDetails: {}, withDateOfApp: {},
            exactYears: {}, variationYears: {},
            allYears: [],
            filterStatus: [], filterClass: [], filterBuisnessName: [],
            filterState: [], filterCompanyType: [],
          },
        });
      }
      return;
    }

    const rawItems = Object.values(refs) as any[];

    const data = rawItems.map((item: any) => {
      item.tmAppliedFor = decodeString(item.tmAppliedFor || "");
      item.imgfile = getFullImageUrl(String(item.appno || ""));
      item.status = decodeString(item.status || "");
      if (!item.buisnessName && item.companyName) {
        item.buisnessName = item.companyName;
      }
      item.buisnessName = decodeString(item.buisnessName || "");
      item.companyName = decodeString(item.companyName || item.buisnessName || "");

      if (item.userDetail && item.userDetail.toLowerCase().trim() === "proposed to be used") {
        item.userDetail = "PU";
      }

      item.dateOfAppStr = formatDate(item.dateOfApp);
      item.dateOfApp = formatDate(item.dateOfApp);

      if (item.validUpto && item.validUpto !== "--" && item.validUpto.trim()) {
        item.validUpto = formatDate(item.validUpto);
      }

      item.company_type = item.company_type || deriveCompanyType(item.companyName || "");

      return item;
    });

    if (searchMode) {
      const searchLower = name.trim().toLowerCase();
      const filteredData = data.filter((item: any) => {
        const tm = (item.tmAppliedFor || "").toLowerCase();
        if (searchMode === "startswith") return tm.startsWith(searchLower);
        if (searchMode === "contains") return tm.includes(searchLower);
        if (searchMode === "phonetic") return tm.includes(searchLower);
        return true;
      });

      const mapped = filteredData.map((item: any) => ({
        ...item,
        propName: item.propName || item.companyName || item.buisnessName || "",
        propAddress: item.propAddress || "",
        country: item.country || "",
        buisnessType: item.buisnessType || item.company_type || "",
        imgurl: item.imgfile || "",
      }));

      const filterStatus = [...new Set(mapped.map((r: any) => r.status).filter(Boolean))] as string[];
      const filterState = [...new Set(mapped.map((r: any) => r.state).filter(Boolean))] as string[];
      const filterCompanyType = [...new Set(mapped.map((r: any) => (r.buisnessType || r.company_type || "")).filter(Boolean))] as string[];

      res.json({
        status: 200,
        data: mapped,
        searchMode: true,
        filters: { filterStatus, filterState, filterCompanyType },
      });
      return;
    }

    const riskGroups: Record<string, any[]> = { vhigh: [], high: [], medium: [], low: [], other: [] };

    const classWise: Record<string, number> = {};
    const yearWise: Record<string, number> = {};
    let totalAbandoned = 0;
    let totalRegistered = 0;
    let totalRectificationFiled = 0;
    const withUserDetails: Record<string, number> = {};
    const withDateOfApp: Record<string, number> = {};
    const exactYears: Record<string, number> = {};
    const variationYears: Record<string, number> = {};
    const filterStatus: string[] = [];
    const filterClass: string[] = [];
    const filterBuisnessName: string[] = [];
    const filterState: string[] = [];
    const filterCompanyType: string[] = [];

    const statusStats: Record<string, Record<string, number>> = {
      vhigh: {}, high: {}, medium: {}, low: {}, other: {},
    };

    data.forEach((item: any) => {
      const risk = categorizeRisk(name, item);
      riskGroups[risk].push(item);

      const statusVal = (item.status || "").trim();
      if (statusVal) {
        statusStats[risk][statusVal] = (statusStats[risk][statusVal] || 0) + 1;
      }

      const cls = item.class || "unknown";
      classWise[cls] = (classWise[cls] || 0) + 1;

      if (!filterClass.includes(String(cls))) filterClass.push(String(cls));
      if (statusVal && !filterStatus.includes(statusVal)) filterStatus.push(statusVal);

      const compName = (item.companyName || item.buisnessName || "").trim();
      if (compName && !filterBuisnessName.includes(compName)) filterBuisnessName.push(compName);

      const stateVal = (item.state || "").trim();
      if (stateVal && !filterState.includes(stateVal)) filterState.push(stateVal);

      const compType = (item.company_type || "").trim();
      if (compType && compType !== "-" && !filterCompanyType.includes(compType)) filterCompanyType.push(compType);

      if (item.dateOfApp) {
        const yearMatch = item.dateOfApp.match(/(\d{4})$/);
        if (yearMatch) {
          const yr = yearMatch[1];
          yearWise[yr] = (yearWise[yr] || 0) + 1;
        }
      }

      const st = (item.status || "").toLowerCase();
      if (st === "abandoned") totalAbandoned++;
      if (st === "registered") totalRegistered++;
      if (st === "rectification filed") totalRectificationFiled++;

      if (item.userDetail && item.userDetail !== "PU") {
        const udMatch = item.userDetail.match(/(\d{4})$/);
        if (udMatch) {
          const yr = udMatch[1];
          withUserDetails[yr] = (withUserDetails[yr] || 0) + 1;
          if (!withDateOfApp[yr]) withDateOfApp[yr] = 0;
        }
      } else if (item.userDetail === "PU" && item.dateOfApp) {
        const dMatch = item.dateOfApp.match(/(\d{4})$/);
        if (dMatch) {
          const yr = dMatch[1];
          withDateOfApp[yr] = (withDateOfApp[yr] || 0) + 1;
          if (!withUserDetails[yr]) withUserDetails[yr] = 0;
        }
      }

      const tmLower = (item.tmAppliedFor || "").toLowerCase().trim();
      const searchLower = name.toLowerCase().trim();
      if (item.dateOfApp) {
        const yrMatch = item.dateOfApp.match(/(\d{4})$/);
        if (yrMatch) {
          const yr = yrMatch[1];
          if (tmLower.includes(searchLower)) {
            exactYears[yr] = (exactYears[yr] || 0) + 1;
            if (!variationYears[yr]) variationYears[yr] = 0;
          } else {
            variationYears[yr] = (variationYears[yr] || 0) + 1;
            if (!exactYears[yr]) exactYears[yr] = 0;
          }
        }
      }
    });

    const total = data.length;
    const dropOutRate = total > 0 ? Math.round((totalAbandoned / total) * 100) : 0;
    let renewalRate = 0;
    const regPlusRect = totalRegistered + totalRectificationFiled;
    if (regPlusRect > 0) {
      const futureValid = data.filter((item: any) => {
        const st = (item.status || "").toLowerCase();
        if (st !== "registered" && st !== "rectification filed") return false;
        if (!item.validUpto || item.validUpto === "--") return false;
        const parts = item.validUpto.split("/");
        if (parts.length !== 3) return false;
        const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        return d > new Date();
      }).length;
      renewalRate = Math.min(99, Math.floor((futureValid / regPlusRect) * 100));
    }

    const allYears = [...new Set([
      ...Object.keys(exactYears),
      ...Object.keys(variationYears),
      ...Object.keys(withUserDetails),
      ...Object.keys(withDateOfApp),
    ])].sort();

    const sectionStatuses: Record<string, string> = {};
    for (const [section, counts] of Object.entries(statusStats)) {
      const parts = Object.entries(counts).map(([s, c]) => `${s}: ${c}`);
      sectionStatuses[section] = parts.join(", ");
    }

    res.json({
      status: 200,
      searchMode: false,
      riskGroups,
      sectionStatuses,
      stats: {
        total,
        dropOutRate,
        renewalRate,
        classWise,
        yearWise,
        withUserDetails,
        withDateOfApp,
        exactYears,
        variationYears,
        allYears,
        filterStatus,
        filterClass,
        filterBuisnessName,
        filterState,
        filterCompanyType,
      },
    });
  } catch (err: any) {
    console.error("Assessment search error:", err.message);
    res.json({ status: 200, data: [], message: "Error fetching data: " + err.message });
  }
});

router.post("/opposition", requireAuth, async (req, res): Promise<void> => {
  const { keyword, mode } = req.body;
  if (!keyword) {
    res.status(400).json({ status: 400, message: "keyword is required" });
    return;
  }

  try {
    const searchMode = mode || "contains";
    const url = EXTERNAL_APIS.oppositionSearch +
      "?oppname=" + encodeURIComponent(keyword.trim()) +
      "&oppnameMode=" + encodeURIComponent(searchMode);

    const response = await fetch(url);
    if (!response.ok) {
      res.json({ status: 200, data: [], message: "External API error" });
      return;
    }

    const result = await response.json();

    if (!result || !result.data || !result.data.length) {
      res.json({ status: 200, data: [], message: "No results found" });
      return;
    }

    const data = result.data.map((item: any) => {
      item.oppname = (item.oppname || "").replace(/[\n\r]+/g, " ");
      item.oppname = decodeString(item.oppname);
      item.opp_agentname = decodeString(item.opp_agentname || "");
      if (item.oppnum) item.oppnum = String(item.oppnum).replace(/[\[\]]/g, "").trim();
      if (item.oppcode) item.oppcode = String(item.oppcode).replace(/[\[\]]/g, "").trim();
      return item;
    });

    const agents: Record<string, number> = {};
    const yearWise: Record<string, number> = {};
    const filterOppAgentName: string[] = [];
    const filterOppName: string[] = [];

    data.forEach((item: any) => {
      const agentName = (item.opp_agentname || "").trim();
      if (agentName) {
        agents[agentName] = (agents[agentName] || 0) + 1;
        if (!filterOppAgentName.includes(agentName)) filterOppAgentName.push(agentName);
      }
      const oppName = (item.oppname || "").trim();
      if (oppName && !filterOppName.includes(oppName)) filterOppName.push(oppName);

      const dateStr = (item.oppdate || "").trim();
      if (dateStr) {
        const yrMatch = dateStr.match(/(\d{4})/);
        if (yrMatch) {
          const yr = yrMatch[1];
          yearWise[yr] = (yearWise[yr] || 0) + 1;
        }
      }
    });

    const sortedAgents = Object.entries(agents)
      .sort(([, a], [, b]) => b - a)
      .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {} as Record<string, number>);

    res.json({
      status: 200,
      data,
      stats: {
        total: data.length,
        yearWise,
        agents: sortedAgents,
        filterOppAgentName,
        filterOppName,
      },
    });
  } catch (err: any) {
    console.error("Opposition search error:", err.message);
    res.json({ status: 200, data: [], message: "Error fetching data: " + err.message });
  }
});

router.post("/opposition/export", requireAuth, async (_req, res): Promise<void> => {
  res.json({ status: 200, file: "export_opposition.xlsx" });
});

router.post("/license", requireAuth, async (req, res): Promise<void> => {
  const { keyword, type, startsWith } = req.body;
  if (!keyword || !type) {
    res.status(400).json({ status: 400, message: "keyword and type are required" });
    return;
  }

  try {
    const searchType = type.toLowerCase();
    const prefix = (startsWith === "*" || !startsWith) ? "* " : startsWith;

    if (searchType === "citations") {
      let url = EXTERNAL_APIS.citations + "?select=id,url,brand,manufacturer,crawler_sitemapconfig(sitename)&brand=ilike.";
      if (prefix.trim() === "*") {
        url += "%25" + encodeURIComponent(keyword) + "%25";
      } else {
        url += encodeURIComponent(keyword) + "%25";
      }
      url += "&limit=5000";
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        res.json({ status: 200, data: { citations: data } });
      } else {
        res.json({ status: 200, data: { citations: [] } });
      }
      return;
    }

    let url = EXTERNAL_APIS.license + "/";
    if (searchType === "fssai") {
      url += "fassai_records?companyname=ilike." + prefix + keyword + "*&licenseactive=eq.Active";
    } else if (searchType === "udyaam") {
      url += "udyam_records?name=ilike." + prefix + keyword + "*";
    } else if (searchType === "mca") {
      url += "mca_records?name=ilike." + prefix + keyword + "*";
    } else if (searchType === "all") {
      const results: any = { fssai: [], mca: [], udyaam: [], citations: [] };
      const urls: Record<string, string> = {
        fssai: EXTERNAL_APIS.license + "/fassai_records?companyname=ilike." + prefix + keyword + "*&licenseactive=eq.Active&limit=5000",
        udyaam: EXTERNAL_APIS.license + "/udyam_records?name=ilike." + prefix + keyword + "*&limit=5000",
        mca: EXTERNAL_APIS.license + "/mca_records?name=ilike." + prefix + keyword + "*&limit=5000",
      };

      let citationsUrl = EXTERNAL_APIS.citations + "?select=id,url,brand,manufacturer,crawler_sitemapconfig(sitename)&brand=ilike.";
      if (prefix.trim() === "*") {
        citationsUrl += "%25" + encodeURIComponent(keyword) + "%25";
      } else {
        citationsUrl += encodeURIComponent(keyword) + "%25";
      }
      citationsUrl += "&limit=5000";
      urls.citations = citationsUrl;

      const fetches = await Promise.allSettled(
        Object.entries(urls).map(async ([key, u]) => {
          const r = await fetch(u);
          if (r.ok) {
            results[key] = await r.json();
          }
        })
      );

      res.json({ status: 200, data: results });
      return;
    } else {
      res.json({ status: 400, message: "Invalid search type" });
      return;
    }

    url += "&limit=5000";
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      res.json({ status: 200, data: { [searchType]: data } });
    } else {
      res.json({ status: 200, data: { [searchType]: [] } });
    }
  } catch (err: any) {
    console.error("License search error:", err.message);
    res.json({ status: 200, data: {}, message: "Error fetching data: " + err.message });
  }
});

router.get("/search/b2b", requireAuth, async (req, res): Promise<void> => {
  try {
    const { keyword, site, searchType, excludeCompanies, page } = req.query;
    if (!keyword) {
      res.json({ records: [] });
      return;
    }
    res.json({ records: [], page: parseInt(page as string) || 1 });
  } catch (err: any) {
    console.error("B2B search error:", err.message);
    res.json({ records: [] });
  }
});

export default router;
