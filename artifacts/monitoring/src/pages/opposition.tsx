import { Layout } from "@/components/layout";
import { useState, useMemo } from "react";
import { Search, Download, Loader2, ChevronDown } from "lucide-react";
import { exportToCsv } from "@/lib/export-csv";
import { useSearchOpposition } from "@workspace/api-client-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

function OppNameCell({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!text || text.length < 40) return <span>{text}</span>;
  return (
    <div>
      <span style={{ display: "inline-block", height: expanded ? "auto" : "20px", overflow: "hidden" }}>{text}</span>
      <span className="text-blue-500 cursor-pointer text-xs hover:underline mt-0.5 block" onClick={() => setExpanded(!expanded)}>
        {expanded ? "Hide ..." : "Show more ..."}
      </span>
    </div>
  );
}

export default function OppositionSearch() {
  const [keyword, setKeyword] = useState("");
  const [mode, setMode] = useState("contains");
  const [searchTerm, setSearchTerm] = useState("");
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, Set<string>>>({});
  const [textFilters, setTextFilters] = useState<Record<string, string>>({});

  const searchMutation = useSearchOpposition();
  const responseData = searchMutation.data as any;
  const results = responseData?.data ?? [];
  const stats = responseData?.stats;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword) return;
    setCurrentPage(1);
    setFilterValues({});
    setTextFilters({});
    searchMutation.mutate({ data: { keyword, mode } as any });
  };

  const handleAnotherSearch = () => {
    searchMutation.reset();
    setKeyword("");
    setMode("contains");
    setSearchTerm("");
    setCurrentPage(1);
    setFilterValues({});
    setTextFilters({});
  };

  const toggleFilterValue = (filterKey: string, value: string) => {
    setFilterValues(prev => {
      const newSet = new Set(prev[filterKey] || []);
      if (newSet.has(value)) newSet.delete(value);
      else newSet.add(value);
      return { ...prev, [filterKey]: newSet };
    });
    setCurrentPage(1);
  };

  const filtered = useMemo(() => {
    let items = results;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      items = items.filter((item: any) =>
        (item.oppname || "").toLowerCase().includes(s) ||
        (item.opp_agentname || "").toLowerCase().includes(s) ||
        (item.oppnum || "").toString().toLowerCase().includes(s)
      );
    }
    if (textFilters.appno) items = items.filter((r: any) => String(r.appno || "").includes(textFilters.appno));
    if (filterValues.opp_agentname?.size) items = items.filter((r: any) => filterValues.opp_agentname!.has(r.opp_agentname || ""));
    if (filterValues.oppName?.size) items = items.filter((r: any) => filterValues.oppName!.has(r.oppname || ""));
    if (textFilters.oppDate) items = items.filter((r: any) => (r.oppdate || "").includes(textFilters.oppDate));
    if (textFilters.oppNum) items = items.filter((r: any) => String(r.oppnum || "").includes(textFilters.oppNum));
    if (textFilters.oppCode) items = items.filter((r: any) => String(r.oppcode || "").includes(textFilters.oppCode));
    return items;
  }, [results, searchTerm, filterValues, textFilters]);

  const totalPages = Math.ceil(filtered.length / entriesPerPage);
  const paginatedResults = filtered.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

  const yearWiseData = stats?.yearWise ? Object.entries(stats.yearWise).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => ({ name, value })) : [];
  const agentEntries = stats?.agents ? Object.entries(stats.agents) as [string, number][] : [];

  return (
    <Layout>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xl font-semibold">Search Opposition</h4>
        <div className="flex items-center gap-2">
          {searchMutation.isSuccess && (
            <>
              <button onClick={() => exportToCsv("opposition_search.csv", filtered, [
                { key: "appno", label: "Appno" }, { key: "oppdate", label: "Opp. Date" },
                { key: "oppnum", label: "Opp. Num." }, { key: "oppcode", label: "Opp. Code" },
                { key: "opp_agentname", label: "Opp. Agent Name" }, { key: "oppname", label: "Opp. Name" },
              ])} className="bg-orange-500 text-white px-3 py-1.5 rounded text-sm hover:bg-orange-600 flex items-center gap-1">
                <Download className="w-3 h-3" /> Export
              </button>
              <button onClick={handleAnotherSearch} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700">
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
              <div>
                <input type="text" className="border rounded px-3 py-2 text-sm w-52" placeholder="Input Opposition Name" value={keyword} onChange={(e) => setKeyword(e.target.value)} required minLength={3} />
              </div>
              <div className="w-40">
                <select className="w-full border rounded px-3 py-2 text-sm" value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="">- Select Mode -</option>
                  <option value="contains">Contains</option>
                  <option value="begins">Begins</option>
                </select>
              </div>
              <div>
                <button type="submit" disabled={searchMutation.isPending} className="bg-green-500 text-white px-6 py-2 rounded text-sm hover:bg-green-600 flex items-center gap-2 disabled:opacity-50">
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
          <p className="text-sm text-gray-500">Searching opposition records...</p>
        </div>
      )}

      {searchMutation.isSuccess && stats && (
        <>
          <div className="text-center mb-3 mt-4">
            <h6 className="text-sm font-semibold text-gray-700">
              Total Opposition Records For Word "{keyword}": {stats.total}
            </h6>
          </div>

          {yearWiseData.length > 0 && (
            <div className="bg-white rounded shadow-sm border p-4 mb-4">
              <h6 className="text-xs font-semibold text-center mb-2">Year wise filing</h6>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={yearWiseData}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#1976D2" name="Count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="bg-white rounded shadow-sm border mb-4 p-2">
            <div className="flex flex-wrap gap-1 items-center">
              {[
                { key: "appno", label: "App#" },
                { key: "oppDate", label: "Opp. Date" },
                { key: "oppNum", label: "Opp. Num." },
                { key: "oppCode", label: "Opp. Code" },
              ].map(fd => (
                <div key={fd.key} className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenFilter(openFilter === fd.key ? null : fd.key); }}
                    className="px-2 py-1 text-xs border rounded hover:bg-gray-100 flex items-center gap-1"
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
                        onChange={(e) => { setTextFilters(prev => ({ ...prev, [fd.key]: e.target.value })); setCurrentPage(1); }}
                        autoFocus
                      />
                    </div>
                  )}
                </div>
              ))}
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setOpenFilter(openFilter === "opp_agentname" ? null : "opp_agentname"); }}
                  className={`px-2 py-1 text-xs border rounded hover:bg-gray-100 flex items-center gap-1 ${filterValues.opp_agentname?.size ? "bg-blue-50 border-blue-300" : ""}`}
                >
                  Opp. Agent Name {filterValues.opp_agentname?.size ? `(${filterValues.opp_agentname.size})` : ""} <ChevronDown className="w-3 h-3" />
                </button>
                {openFilter === "opp_agentname" && (
                  <div className="absolute top-full left-0 mt-1 bg-white border rounded shadow-lg z-50 p-2 min-w-[200px] max-h-[200px] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                    {(stats.filterOppAgentName || []).map((opt: string) => (
                      <label key={opt} className="flex items-center gap-1 text-xs py-0.5 cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={filterValues.opp_agentname?.has(opt) || false}
                          onChange={() => toggleFilterValue("opp_agentname", opt)}
                          className="w-3 h-3"
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setOpenFilter(openFilter === "oppName" ? null : "oppName"); }}
                  className={`px-2 py-1 text-xs border rounded hover:bg-gray-100 flex items-center gap-1 ${filterValues.oppName?.size ? "bg-blue-50 border-blue-300" : ""}`}
                >
                  Opp. Name {filterValues.oppName?.size ? `(${filterValues.oppName.size})` : ""} <ChevronDown className="w-3 h-3" />
                </button>
                {openFilter === "oppName" && (
                  <div className="absolute top-full left-0 mt-1 bg-white border rounded shadow-lg z-50 p-2 min-w-[250px] max-h-[200px] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                    {(stats.filterOppName || []).map((opt: string) => (
                      <label key={opt} className="flex items-center gap-1 text-xs py-0.5 cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={filterValues.oppName?.has(opt) || false}
                          onChange={() => toggleFilterValue("oppName", opt)}
                          className="w-3 h-3"
                        />
                        <span className="truncate max-w-[200px]">{opt}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {searchMutation.isSuccess && (
        <div className="bg-white rounded shadow-sm border mt-0">
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
            <div className="flex items-center gap-2 text-sm">
              <span>Search:</span>
              <input type="text" className="border rounded px-2 py-1 text-sm w-40" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-3 text-center font-medium text-gray-500">Appno</th>
                  <th className="px-3 py-3 text-center font-medium text-gray-500">Opp. Date</th>
                  <th className="px-3 py-3 text-center font-medium text-gray-500">Opp. Num.</th>
                  <th className="px-3 py-3 text-center font-medium text-gray-500">Opp. Code</th>
                  <th className="px-3 py-3 text-center font-medium text-gray-500">Opp. Agent Name</th>
                  <th className="px-3 py-3 text-center font-medium text-gray-500">Opp. Name</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginatedResults.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No opposition records found</td></tr>
                ) : paginatedResults.map((item: any, i: number) => (
                  <tr key={i} className="hover:bg-yellow-50 text-center">
                    <td className="px-3 py-2">{item.appno || "-"}</td>
                    <td className="px-3 py-2">{item.oppdate || "-"}</td>
                    <td className="px-3 py-2">{item.oppnum || "-"}</td>
                    <td className="px-3 py-2">{item.oppcode || "-"}</td>
                    <td className="px-3 py-2">{item.opp_agentname || "-"}</td>
                    <td className="px-3 py-2">
                      <OppNameCell text={item.oppname || "-"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="flex items-center justify-between p-3 border-t text-sm text-gray-500">
              <span>Showing {(currentPage - 1) * entriesPerPage + 1} to {Math.min(currentPage * entriesPerPage, filtered.length)} of {filtered.length} entries</span>
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
                <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)} className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {searchMutation.isSuccess && agentEntries.length > 0 && (
        <div className="bg-white rounded shadow-sm border mt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Agent</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {agentEntries.map(([name, count]) => (
                  <tr key={name} className="text-center hover:bg-yellow-50">
                    <td className="px-4 py-2">{name || "-"}</td>
                    <td className="px-4 py-2">{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Layout>
  );
}
