import { Layout } from "@/components/layout";
import React, { useState, useMemo } from "react";
import { Download, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { exportToCsv } from "@/lib/export-csv";
import { useSearchAssessment } from "@workspace/api-client-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";

const STATUS_COLORS: Record<string, string> = {
  abandoned: "#e74c3c",
  registered: "#27ae60",
  objected: "#e67e22",
  opposed: "#9b59b6",
  "formality chk fail": "#95a5a6",
  "rectification filed": "#3498db",
  removed: "#6b7280",
  withdrawn: "#6b7280",
};

const PIE_COLORS = ["#3498db", "#e74c3c", "#2ecc71", "#e67e22", "#9b59b6", "#1abc9c", "#34495e", "#f1c40f", "#e91e63", "#00bcd4", "#795548", "#607d8b", "#ff5722", "#8bc34a", "#673ab7"];

function getStatusBadge(status: string) {
  const s = (status || "").toLowerCase();
  const color = STATUS_COLORS[s] || "#6b7280";
  return (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium text-white" style={{ backgroundColor: color }}>
      {status}
    </span>
  );
}

function GaugeChart({ value, label }: { value: number; label: string }) {
  const angle = (value / 100) * 180;
  return (
    <div className="text-center">
      <svg viewBox="0 0 200 120" width="180" height="110">
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#e0e0e0" strokeWidth="20" strokeLinecap="round" />
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#4CAF50" strokeWidth="20" strokeLinecap="round"
          strokeDasharray={`${(angle / 180) * 251.2} 251.2`} />
        <text x="100" y="95" textAnchor="middle" fontSize="28" fontWeight="bold" fill="#333">{value}</text>
        <text x="20" y="118" textAnchor="middle" fontSize="12" fill="#666">0</text>
        <text x="180" y="118" textAnchor="middle" fontSize="12" fill="#666">100</text>
      </svg>
      <div className="text-xs font-medium text-gray-600 mt-1">{label}</div>
    </div>
  );
}

const RISK_SECTIONS = [
  { key: "vhigh", label: "Very High", defaultOpen: true },
  { key: "high", label: "High", defaultOpen: false },
  { key: "medium", label: "Medium", defaultOpen: false },
  { key: "low", label: "Low", defaultOpen: false },
  { key: "other", label: "Others", defaultOpen: false },
];

const MODE_FILTER_DEFS = [
  { key: "appno", label: "Number", type: "text" },
  { key: "dateOfApp", label: "Date", type: "text" },
  { key: "status", label: "Status", type: "select" },
  { key: "state", label: "State", type: "select" },
  { key: "country", label: "Country", type: "text" },
  { key: "tmAppliedFor", label: "TM", type: "text" },
  { key: "userDetail", label: "User Detail", type: "text" },
  { key: "validUpto", label: "Expiry", type: "text" },
  { key: "propName", label: "Company", type: "text" },
  { key: "propAddress", label: "Address", type: "text" },
  { key: "buisnessName", label: "Owner", type: "text" },
  { key: "buisnessType", label: "Type", type: "select" },
  { key: "goodsAndSerice", label: "Goods And Serice", type: "text" },
];

const NONMODE_FILTER_DEFS = [
  { key: "appno", label: "Number", type: "text" },
  { key: "tmAppliedFor", label: "TM", type: "text" },
  { key: "status", label: "Status", type: "select" },
  { key: "state", label: "State", type: "select" },
  { key: "buisnessName", label: "Company", type: "text" },
  { key: "company_type", label: "Type", type: "select" },
  { key: "class", label: "Class", type: "select" },
  { key: "validUpto", label: "Expiry", type: "text" },
  { key: "userDetail", label: "User Detail", type: "text" },
  { key: "dateOfApp", label: "Date", type: "text" },
  { key: "goodsAndSerice", label: "Goods And Serice", type: "text" },
];

function FilterBar({ defs, textFilters, setTextFilters, selectFilters, filterValues, toggleFilterValue, openFilter, setOpenFilter, setCurrentPage }: any) {
  return (
    <div className="flex flex-wrap gap-1 items-center mb-3">
      {defs.map((fd: any) => {
        if (fd.type === "text") {
          return (
            <div key={fd.key} className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setOpenFilter(openFilter === fd.key ? null : fd.key); }}
                className={`px-2 py-1 text-xs border rounded hover:bg-gray-100 flex items-center gap-1 ${textFilters[fd.key] ? "bg-blue-50 border-blue-300" : ""}`}
              >
                {fd.label} <ChevronDown className="w-3 h-3" />
              </button>
              {openFilter === fd.key && (
                <div className="absolute top-full left-0 mt-1 bg-white border rounded shadow-lg z-50 p-2 min-w-[160px]" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    className="w-full border rounded px-2 py-1 text-xs"
                    placeholder={`Filter ${fd.label}...`}
                    value={textFilters[fd.key] || ""}
                    onChange={(e) => { setTextFilters((prev: any) => ({ ...prev, [fd.key]: e.target.value })); setCurrentPage(1); }}
                    autoFocus
                  />
                </div>
              )}
            </div>
          );
        }
        const opts = selectFilters[fd.key] || [];
        return (
          <div key={fd.key} className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setOpenFilter(openFilter === fd.key ? null : fd.key); }}
              className={`px-2 py-1 text-xs border rounded hover:bg-gray-100 flex items-center gap-1 ${filterValues[fd.key]?.size ? "bg-blue-50 border-blue-300" : ""}`}
            >
              {fd.label} {filterValues[fd.key]?.size ? `(${filterValues[fd.key]!.size})` : ""} <ChevronDown className="w-3 h-3" />
            </button>
            {openFilter === fd.key && (
              <div className="absolute top-full left-0 mt-1 bg-white border rounded shadow-lg z-50 p-2 min-w-[180px] max-h-[200px] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                {opts.map((opt: string) => (
                  <label key={opt} className="flex items-center gap-1 text-xs py-0.5 cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={filterValues[fd.key]?.has(opt) || false}
                      onChange={() => toggleFilterValue(fd.key, opt)}
                      className="w-3 h-3"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function applyFilters(items: any[], textFilters: Record<string, string>, filterValues: Record<string, Set<string>>, searchTerm: string): any[] {
  let filtered = items;
  if (searchTerm) {
    const s = searchTerm.toLowerCase();
    filtered = filtered.filter((item: any) =>
      Object.values(item).some(v => String(v || "").toLowerCase().includes(s))
    );
  }
  for (const [key, val] of Object.entries(textFilters)) {
    if (val) {
      filtered = filtered.filter((r: any) => String(r[key] || "").toLowerCase().includes(val.toLowerCase()));
    }
  }
  for (const [key, vals] of Object.entries(filterValues)) {
    if (vals?.size) {
      filtered = filtered.filter((r: any) => vals.has(String(r[key] || "")));
    }
  }
  return filtered;
}

function PaginatedTable({ data, columns, renderRow, entriesPerPage, setEntriesPerPage, currentPage, setCurrentPage, searchTerm, setSearchTerm }: any) {
  const totalPages = Math.ceil(data.length / entriesPerPage);
  const paginated = data.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

  return (
    <div className="bg-white rounded shadow-sm border">
      <div className="flex flex-col sm:flex-row items-center justify-between p-3 border-b gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span>Show</span>
          <select value={entriesPerPage} onChange={(e) => { setEntriesPerPage(Number(e.target.value)); setCurrentPage(1); }} className="border rounded px-2 py-1 text-sm">
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span>entries</span>
        </div>
        {setSearchTerm && (
          <div className="flex items-center gap-2 text-sm">
            <span>Search:</span>
            <input type="text" className="border rounded px-2 py-1 text-sm w-40" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {columns.map((col: string, i: number) => (
                <th key={i} className="px-3 py-3 text-center font-medium text-gray-500">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {paginated.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">No results found</td></tr>
            ) : paginated.map((item: any, i: number) => renderRow(item, i))}
          </tbody>
        </table>
      </div>
      {data.length > 0 && (
        <div className="flex items-center justify-between p-3 border-t text-sm text-gray-500">
          <span>Showing {(currentPage - 1) * entriesPerPage + 1} to {Math.min(currentPage * entriesPerPage, data.length)} of {data.length} entries</span>
          <div className="flex items-center gap-1">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)} className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50">Previous</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let page: number;
              if (totalPages <= 5) page = i + 1;
              else if (currentPage <= 3) page = i + 1;
              else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
              else page = currentPage - 2 + i;
              return (
                <button key={page} onClick={() => setCurrentPage(page)} className={`px-3 py-1 border rounded ${currentPage === page ? "bg-blue-600 text-white" : "hover:bg-gray-50"}`}>
                  {page}
                </button>
              );
            })}
            <button disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(currentPage + 1)} className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Assessment() {
  const [keyword, setKeyword] = useState("");
  const [tmClass, setTmClass] = useState("");
  const [searchMode, setSearchMode] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, Set<string>>>({});
  const [textFilters, setTextFilters] = useState<Record<string, string>>({});
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ vhigh: true });
  const [sectionPages, setSectionPages] = useState<Record<string, number>>({});
  const [sectionEntries, setSectionEntries] = useState<Record<string, number>>({});
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const isGetEnabled = keyword.length >= 3 && tmClass && searchMode;

  const searchMutation = useSearchAssessment();
  const responseData = searchMutation.data as any;
  const isModSearch = responseData?.searchMode === true;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isGetEnabled) return;
    setCurrentPage(1);
    setFilterValues({});
    setTextFilters({});
    setOpenSections({ vhigh: true });
    setSectionPages({});
    const effectiveMode = searchMode === "phonetic_mode" ? undefined : searchMode;
    searchMutation.mutate({
      data: { name: keyword, className: tmClass || "99", searchMode: effectiveMode || undefined } as any,
    });
  };

  const handleAnotherSearch = () => {
    searchMutation.reset();
    setKeyword("");
    setTmClass("");
    setSearchMode("");
    setSearchTerm("");
    setCurrentPage(1);
    setFilterValues({});
    setTextFilters({});
    setOpenSections({ vhigh: true });
    setSectionPages({});
  };

  const toggleFilterValue = (filterKey: string, value: string) => {
    setFilterValues(prev => {
      const newSet = new Set(prev[filterKey] || []);
      if (newSet.has(value)) newSet.delete(value);
      else newSet.add(value);
      return { ...prev, [filterKey]: newSet };
    });
    setCurrentPage(1);
    setSectionPages({});
  };

  const modeData = responseData?.data ?? [];
  const riskGroups = responseData?.riskGroups ?? {};
  const stats = responseData?.stats;
  const sectionStatuses = responseData?.sectionStatuses ?? {};
  const modeFilters = responseData?.filters ?? {};

  const modeSelectFilters: Record<string, string[]> = {
    status: modeFilters.filterStatus || [],
    state: modeFilters.filterState || [],
    buisnessType: modeFilters.filterCompanyType || [],
  };

  const nonModeSelectFilters: Record<string, string[]> = {
    status: stats?.filterStatus || [],
    state: stats?.filterState || [],
    company_type: stats?.filterCompanyType || [],
    class: stats?.filterClass || [],
  };

  const modeFiltered = useMemo(() => {
    if (!isModSearch) return [];
    return applyFilters(modeData, textFilters, filterValues, searchTerm);
  }, [isModSearch, modeData, textFilters, filterValues, searchTerm]);

  const nonModeFilteredGroups = useMemo(() => {
    if (isModSearch) return {};
    const groups: Record<string, any[]> = {};
    for (const section of RISK_SECTIONS) {
      const items = riskGroups[section.key] || [];
      groups[section.key] = applyFilters(items, textFilters, filterValues, "");
    }
    return groups;
  }, [isModSearch, riskGroups, textFilters, filterValues]);

  const classWiseData = stats?.classWise ? Object.entries(stats.classWise).map(([name, value]) => ({ name: `Class ${name}`, value })) : [];
  const yearWiseData = stats?.yearWise ? Object.entries(stats.yearWise).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => ({ name, value })) : [];
  const exactVsVariationData = stats?.allYears ? stats.allYears.map((yr: string) => ({
    name: yr,
    exact: stats.exactYears?.[yr] || 0,
    variation: stats.variationYears?.[yr] || 0,
  })) : [];
  const withUserData = stats?.allYears ? stats.allYears.map((yr: string) => ({
    name: yr,
    withUser: stats.withUserDetails?.[yr] || 0,
    withDateOfApp: stats.withDateOfApp?.[yr] || 0,
  })) : [];

  const allNonModeItems = useMemo(() => {
    const all: any[] = [];
    for (const s of RISK_SECTIONS) {
      all.push(...(nonModeFilteredGroups[s.key] || []));
    }
    return all;
  }, [nonModeFilteredGroups]);

  return (
    <Layout>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xl font-semibold">Assessment</h4>
        <div className="flex items-center gap-3">
          {searchMutation.isSuccess && (
            <>
              <span className="text-sm text-gray-600">Attempts Limit/Used : 500 / {isModSearch ? (responseData?.data?.length || 0) : (stats?.total || 0)}</span>
              <button onClick={() => {
                if (isModSearch) {
                  exportToCsv("assessment.csv", modeFiltered, [
                    { key: "appno", label: "Appno" }, { key: "dateOfApp", label: "Date Of App" },
                    { key: "status", label: "Status" }, { key: "state", label: "State" },
                    { key: "country", label: "Country" }, { key: "tmAppliedFor", label: "Tm Name" },
                    { key: "userDetail", label: "Date" }, { key: "validUpto", label: "Expire At" },
                    { key: "propName", label: "Company" }, { key: "propAddress", label: "Address" },
                    { key: "buisnessName", label: "Owner" }, { key: "buisnessType", label: "Company Type" },
                    { key: "goodsAndSerice", label: "Description" },
                  ]);
                } else {
                  exportToCsv("assessment.csv", allNonModeItems, [
                    { key: "appno", label: "Number" }, { key: "tmAppliedFor", label: "TM" },
                    { key: "status", label: "Status" }, { key: "state", label: "State" },
                    { key: "companyName", label: "Company" }, { key: "company_type", label: "Type" },
                    { key: "class", label: "Class" }, { key: "validUpto", label: "Expiry" },
                    { key: "userDetail", label: "User Detail" }, { key: "dateOfApp", label: "Date" },
                    { key: "goodsAndSerice", label: "Goods And Serice" },
                  ]);
                }
              }} className="bg-teal-500 text-white px-3 py-1.5 rounded text-sm hover:bg-teal-600 flex items-center gap-1">
                <Download className="w-3 h-3" /> Export
              </button>
              <button onClick={handleAnotherSearch} className="bg-emerald-500 text-white px-3 py-1.5 rounded text-sm hover:bg-emerald-600">
                Another Search
              </button>
            </>
          )}
        </div>
      </div>

      {!searchMutation.isSuccess && (
        <div className="bg-white rounded shadow-sm border p-4">
          <form onSubmit={handleSearch}>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px]" style={{ flex: "0 0 58%" }}>
                <input type="text" className="w-full border rounded px-3 py-2 text-sm" placeholder="Input Trademark Name" value={keyword} onChange={(e) => setKeyword(e.target.value)} required />
              </div>
              <div style={{ flex: "0 0 15%" }}>
                <select className="w-full border rounded px-3 py-2 text-sm" value={tmClass} onChange={(e) => setTmClass(e.target.value)}>
                  <option value="">- Select Class -</option>
                  <option value="all">All</option>
                  {Array.from({ length: 45 }, (_, i) => (
                    <option key={i + 1} value={String(i + 1)}>{i + 1}</option>
                  ))}
                  <option value="99">99</option>
                </select>
              </div>
              <div style={{ flex: "0 0 15%" }}>
                <select className="w-full border rounded px-3 py-2 text-sm" value={searchMode} onChange={(e) => setSearchMode(e.target.value)}>
                  <option value="">- Select Mode -</option>
                  <option value="startswith">Starts with</option>
                  <option value="contains">Contains</option>
                  <option value="phonetic_mode">Phonetic</option>
                </select>
              </div>
              <div>
                <button type="submit" disabled={!isGetEnabled || searchMutation.isPending} className="bg-green-500 text-white px-6 py-2 rounded text-sm hover:bg-green-600 flex items-center gap-2 disabled:opacity-50">
                  {searchMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Get
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {searchMutation.isPending && (
        <div className="bg-white rounded shadow-sm border mt-4 p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Searching trademark records...</p>
        </div>
      )}

      {searchMutation.isError && (
        <div className="bg-red-50 border border-red-200 rounded mt-4 p-4 text-center">
          <p className="text-sm text-red-600">Error searching records. Please try again.</p>
        </div>
      )}

      {searchMutation.isSuccess && responseData?.message && !isModSearch && !responseData?.riskGroups && (
        <div className="bg-yellow-50 border border-yellow-200 rounded mt-4 p-4 text-center">
          <p className="text-sm text-yellow-700">{responseData.message}</p>
        </div>
      )}

      {searchMutation.isSuccess && isModSearch && (
        <div className="mt-4">
          <FilterBar
            defs={MODE_FILTER_DEFS}
            textFilters={textFilters}
            setTextFilters={setTextFilters}
            selectFilters={modeSelectFilters}
            filterValues={filterValues}
            toggleFilterValue={toggleFilterValue}
            openFilter={openFilter}
            setOpenFilter={setOpenFilter}
            setCurrentPage={setCurrentPage}
          />

          <PaginatedTable
            data={modeFiltered}
            columns={["Logo", "Appno", "Date Of App", "Status", "State", "Country", "Tm Name", "Date", "Expire At", "Company"]}
            entriesPerPage={entriesPerPage}
            setEntriesPerPage={setEntriesPerPage}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            renderRow={(item: any, i: number) => {
              const imgUrl = item.imgurl || item.imgfile || "";
              const globalIdx = (currentPage - 1) * entriesPerPage + i;
              const isExpanded = expandedRows.has(globalIdx);
              const toggleExpand = () => {
                setExpandedRows(prev => {
                  const next = new Set(prev);
                  if (next.has(globalIdx)) next.delete(globalIdx);
                  else next.add(globalIdx);
                  return next;
                });
              };
              return (
                <React.Fragment key={globalIdx}>
                  <tr className="hover:bg-yellow-50 cursor-pointer align-middle" onClick={toggleExpand}>
                    <td className="px-2 py-1 text-center">{imgUrl ? <img src={imgUrl} alt="" width={100} referrerPolicy="no-referrer" /> : ""}</td>
                    <td className="px-2 py-1 text-center">{item.appno || "-"}</td>
                    <td className="px-2 py-1 text-center">{item.dateOfApp || "-"}</td>
                    <td className="px-2 py-1 text-center">{getStatusBadge(item.status || "-")}</td>
                    <td className="px-2 py-1 text-center">{item.state || "-"}</td>
                    <td className="px-2 py-1 text-center">{item.country || "-"}</td>
                    <td className="px-2 py-1 text-center">{item.tmAppliedFor || "-"}</td>
                    <td className="px-2 py-1 text-center">{item.userDetail || "-"}</td>
                    <td className="px-2 py-1 text-center">{item.validUpto || "-"}</td>
                    <td className="px-2 py-1 text-center">{item.propName || "-"}</td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-yellow-50">
                      <td colSpan={10} className="px-4 py-2 border-t-0">
                        <div className="text-sm">
                          <span className="font-semibold">Owner</span>&nbsp;&nbsp;&nbsp;&nbsp;{item.buisnessName || "-"}
                        </div>
                        <div className="text-sm mt-1">
                          <span className="font-semibold">Address</span>&nbsp;&nbsp;&nbsp;&nbsp;{item.propAddress || "-"}
                        </div>
                        <div className="text-sm mt-1">
                          <span className="font-semibold">Company Type</span>&nbsp;&nbsp;&nbsp;&nbsp;{(item.buisnessType && item.buisnessType !== "-" ? item.buisnessType : item.company_type && item.company_type !== "-" ? item.company_type : "-")}
                        </div>
                        <div className="text-sm mt-1">
                          <span className="font-semibold">Description</span> {item.goodsAndSerice || "-"}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            }}
          />
        </div>
      )}

      {searchMutation.isSuccess && !isModSearch && stats && (
        <div className="mt-4">
          <div className="card mb-1 shadow-none border rounded bg-white">
            <button
              className="w-full text-left px-4 py-3 flex items-center justify-between"
              onClick={() => setOpenSections(prev => ({ ...prev, statsChart: !prev.statsChart }))}
            >
              <h5 className="m-0 text-base font-medium">
                Assessment for {keyword.toUpperCase()} in Class : {tmClass}
              </h5>
              <ChevronDown className={`w-5 h-5 transition-transform ${openSections.statsChart !== false ? "" : "-rotate-90"}`} />
            </button>
            {openSections.statsChart !== false && (
              <div className="px-4 pb-4">
                <div className="text-center mb-3">
                  <h6 className="text-sm font-semibold text-gray-700">
                    Total Assessment Records: {stats.total}
                  </h6>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
                  <div className="bg-white rounded border p-3 flex justify-center">
                    <GaugeChart value={stats.dropOutRate} label="Drop Out Rate" />
                  </div>
                  <div className="bg-white rounded border p-3 flex justify-center">
                    <GaugeChart value={stats.renewalRate} label="Renewal Rate" />
                  </div>
                  <div className="bg-white rounded border p-3">
                    <h6 className="text-xs font-semibold text-center mb-1">Class-wise filing</h6>
                    {classWiseData.length > 0 && (
                      <ResponsiveContainer width="100%" height={150}>
                        <PieChart>
                          <Pie data={classWiseData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={55} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={9}>
                            {classWiseData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  <div className="bg-white rounded border p-3">
                    <h6 className="text-xs font-semibold text-center mb-1">Year-wise filing</h6>
                    {yearWiseData.length > 0 && (
                      <ResponsiveContainer width="100%" height={150}>
                        <BarChart data={yearWiseData}>
                          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                          <YAxis tick={{ fontSize: 9 }} />
                          <Tooltip />
                          <Bar dataKey="value" fill="#1976D2" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  <div className="bg-white rounded border p-3">
                    <h6 className="text-xs font-semibold text-center mb-1">Exact vs Variations</h6>
                    {exactVsVariationData.length > 0 && (
                      <ResponsiveContainer width="100%" height={150}>
                        <LineChart data={exactVsVariationData}>
                          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                          <YAxis tick={{ fontSize: 9 }} />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: 10 }} />
                          <Line type="monotone" dataKey="exact" stroke="#00ff00" strokeWidth={2} name="Exact" dot={false} />
                          <Line type="monotone" dataKey="variation" stroke="#ff0000" strokeWidth={2} name="Variation" dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {withUserData.length > 0 && (
                  <div className="bg-white rounded border p-3">
                    <h6 className="text-xs font-semibold text-center mb-1">With / Without User</h6>
                    <ResponsiveContainer width="100%" height={150}>
                      <LineChart data={withUserData}>
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line type="monotone" dataKey="withUser" stroke="#00ff00" strokeWidth={2} name="With User" dot={false} />
                        <Line type="monotone" dataKey="withDateOfApp" stroke="#ff0000" strokeWidth={2} name="Without User" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}
          </div>

          <FilterBar
            defs={NONMODE_FILTER_DEFS}
            textFilters={textFilters}
            setTextFilters={setTextFilters}
            selectFilters={nonModeSelectFilters}
            filterValues={filterValues}
            toggleFilterValue={toggleFilterValue}
            openFilter={openFilter}
            setOpenFilter={setOpenFilter}
            setCurrentPage={() => setSectionPages({})}
          />

          {RISK_SECTIONS.map(section => {
            const items = nonModeFilteredGroups[section.key] || [];
            const isOpen = openSections[section.key] ?? section.defaultOpen;
            const statusStat = sectionStatuses[section.key] || "";
            const secPage = sectionPages[section.key] || 1;
            const secEntries = sectionEntries[section.key] || 10;
            const totalSecPages = Math.ceil(items.length / secEntries);
            const paginatedItems = items.slice((secPage - 1) * secEntries, secPage * secEntries);

            return (
              <div key={section.key} className="card mb-1 shadow-none border rounded bg-white">
                <button
                  className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                  onClick={() => setOpenSections(prev => ({ ...prev, [section.key]: !isOpen }))}
                >
                  <h5 className="m-0 text-base font-medium flex items-center gap-3">
                    {section.label}
                    {statusStat && <span className="text-xs text-gray-500 font-normal">{statusStat}</span>}
                  </h5>
                  <ChevronDown className={`w-5 h-5 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                </button>
                {isOpen && (
                  <div className="px-0 pb-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-3 py-3 text-center font-medium text-gray-500">
                              <input type="checkbox" defaultChecked={section.key === "vhigh" || section.key === "high" || section.key === "medium"} />
                            </th>
                            <th className="px-3 py-3 text-center font-medium text-gray-500">Number</th>
                            <th className="px-3 py-3 text-center font-medium text-gray-500">TM</th>
                            <th className="px-3 py-3 text-center font-medium text-gray-500">Status</th>
                            <th className="px-3 py-3 text-center font-medium text-gray-500">State</th>
                            <th className="px-3 py-3 text-center font-medium text-gray-500">Company</th>
                            <th className="px-3 py-3 text-center font-medium text-gray-500">Type</th>
                            <th className="px-3 py-3 text-center font-medium text-gray-500">Class</th>
                            <th className="px-3 py-3 text-center font-medium text-gray-500">Expiry</th>
                            <th className="px-3 py-3 text-center font-medium text-gray-500">User Detail</th>
                            <th className="px-3 py-3 text-center font-medium text-gray-500">Date</th>
                            <th className="px-3 py-3 text-center font-medium text-gray-500">Goods And Serice</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {paginatedItems.length === 0 ? (
                            <tr><td colSpan={12} className="px-4 py-8 text-center text-gray-500">No records</td></tr>
                          ) : paginatedItems.map((item: any, i: number) => (
                            <tr key={i} className="hover:bg-yellow-50 cursor-pointer align-middle">
                              <td className="px-2 py-1 text-center">
                                <input type="checkbox" defaultChecked={section.key === "vhigh" || section.key === "high" || section.key === "medium"} onClick={(e) => e.stopPropagation()} />
                              </td>
                              <td className="px-2 py-1 text-center">{item.appno || ""}</td>
                              <td className="px-2 py-1 text-center">{item.tmAppliedFor || ""}</td>
                              <td className="px-2 py-1 text-center">{getStatusBadge(item.status || "")}</td>
                              <td className="px-2 py-1 text-center">{item.state || ""}</td>
                              <td className="px-2 py-1 text-center">{item.companyName || item.buisnessName || ""}</td>
                              <td className="px-2 py-1 text-center">{item.company_type === "Limited" ? "Limited " : (item.company_type || "")}</td>
                              <td className="px-2 py-1 text-center">{item.class || ""}</td>
                              <td className="px-2 py-1 text-center">{item.validUpto || ""}</td>
                              <td className="px-2 py-1 text-center">{item.userDetail || ""}</td>
                              <td className="px-2 py-1 text-center">{item.dateOfAppStr || item.dateOfApp || ""}</td>
                              <td className="px-2 py-1 text-center"><div className="whitespace-pre-wrap max-w-[300px]">{item.goodsAndSerice || ""}</div></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {items.length > 10 && (
                      <div className="flex items-center justify-between p-3 border-t text-sm text-gray-500">
                        <span>Showing {(secPage - 1) * secEntries + 1} to {Math.min(secPage * secEntries, items.length)} of {items.length} entries</span>
                        <div className="flex items-center gap-1">
                          <button disabled={secPage === 1} onClick={() => setSectionPages(p => ({ ...p, [section.key]: secPage - 1 }))} className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50">Previous</button>
                          <button disabled={secPage >= totalSecPages} onClick={() => setSectionPages(p => ({ ...p, [section.key]: secPage + 1 }))} className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50">Next</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
