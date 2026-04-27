import { Layout } from "@/components/layout";
import { useState, useMemo } from "react";
import { Search, Download, Loader2, ChevronDown } from "lucide-react";
import { exportToCsv } from "@/lib/export-csv";
import { useSearchProprietor } from "@workspace/api-client-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, ResponsiveContainer } from "recharts";

const STATUS_COLORS: Record<string, string> = {
  abandoned: "#e74c3c",
  registered: "#27ae60",
  objected: "#e67e22",
  opposed: "#9b59b6",
  "formality chk fail": "#95a5a6",
  "rectification filed": "#3498db",
};

function getStatusBadge(status: string) {
  const s = (status || "").toLowerCase();
  const color = STATUS_COLORS[s] || "#6b7280";
  return (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium text-white" style={{ backgroundColor: color }}>
      {status}
    </span>
  );
}

const PIE_COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#0088fe", "#00C49F", "#FFBB28", "#FF8042", "#a4de6c", "#d0ed57"];

export default function ProprietorSearch() {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [buisnessType, setBuisnessType] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [filterAppno, setFilterAppno] = useState("");
  const [filterAppliedFor, setFilterAppliedFor] = useState("");
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterClass, setFilterClass] = useState<string[]>([]);
  const [filterCompany, setFilterCompany] = useState<string[]>([]);
  const [filterDateOfApp, setFilterDateOfApp] = useState("");
  const [filterUserDetail, setFilterUserDetail] = useState("");
  const [filterValidUpto, setFilterValidUpto] = useState("");
  const [filterAddress, setFilterAddress] = useState("");
  const [openFilter, setOpenFilter] = useState<string | null>(null);

  const searchMutation = useSearchProprietor();
  const responseData = searchMutation.data as any;
  const results = responseData?.data ?? [];
  const stats = responseData?.stats;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name && !address) return;
    setCurrentPage(1);
    searchMutation.mutate({
      data: { name, address, buisnessType, state, country } as any,
    });
  };

  const handleAnotherSearch = () => {
    searchMutation.reset();
    setName("");
    setAddress("");
    setBuisnessType("");
    setState("");
    setCountry("");
    setShowOptions(false);
    setSearchTerm("");
    setCurrentPage(1);
    setFilterAppno("");
    setFilterAppliedFor("");
    setFilterStatus([]);
    setFilterClass([]);
    setFilterCompany([]);
    setFilterDateOfApp("");
    setFilterUserDetail("");
    setFilterValidUpto("");
    setFilterAddress("");
  };

  const filtered = useMemo(() => {
    return results.filter((item: any) => {
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const match =
          (item.appno || "").toString().toLowerCase().includes(s) ||
          (item.tmAppliedFor || "").toLowerCase().includes(s) ||
          (item.buisnessName || "").toLowerCase().includes(s) ||
          (item.status || "").toLowerCase().includes(s);
        if (!match) return false;
      }
      if (filterAppno && !(item.appno || "").toString().includes(filterAppno)) return false;
      if (filterAppliedFor && !(item.tmAppliedFor || "").toLowerCase().includes(filterAppliedFor.toLowerCase())) return false;
      if (filterStatus.length > 0 && !filterStatus.includes(item.status)) return false;
      if (filterClass.length > 0 && !filterClass.includes(String(item.class))) return false;
      if (filterCompany.length > 0 && !filterCompany.includes(item.buisnessName)) return false;
      if (filterDateOfApp && !(item.dateOfApp || "").includes(filterDateOfApp)) return false;
      if (filterUserDetail && !(item.userDetail || "").toLowerCase().includes(filterUserDetail.toLowerCase())) return false;
      if (filterValidUpto && !(item.validUpto || "").includes(filterValidUpto)) return false;
      if (filterAddress && !(item.proprietorAdr || "").toLowerCase().includes(filterAddress.toLowerCase())) return false;
      return true;
    });
  }, [results, searchTerm, filterAppno, filterAppliedFor, filterStatus, filterClass, filterCompany, filterDateOfApp, filterUserDetail, filterValidUpto, filterAddress]);

  const totalPages = Math.ceil(filtered.length / entriesPerPage);
  const paginatedResults = filtered.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

  const classWiseData = stats?.classWise
    ? Object.entries(stats.classWise as Record<string, number>).map(([name, value]) => ({ name: `Class ${name}`, value }))
    : [];
  const yearWiseData = stats?.yearWise
    ? Object.entries(stats.yearWise as Record<string, number>).sort(([a], [b]) => Number(a) - Number(b)).map(([year, count]) => ({ year, count }))
    : [];
  const withUserYears = new Set([
    ...Object.keys(stats?.withUserDetails || {}),
    ...Object.keys(stats?.withDateOfApp || {}),
  ]);
  const userTimelineData = [...withUserYears].sort().map((yr) => ({
    year: yr,
    withUser: (stats?.withUserDetails || {})[yr] || 0,
    withoutUser: (stats?.withDateOfApp || {})[yr] || 0,
  }));

  const agents = stats?.agents as Record<string, number> | undefined;
  const agentEntries = agents ? Object.entries(agents) : [];

  const toggleFilterDropdown = (filterName: string) => {
    setOpenFilter(openFilter === filterName ? null : filterName);
  };

  const toggleMultiFilter = (arr: string[], val: string, setter: (v: string[]) => void) => {
    setter(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
    setCurrentPage(1);
  };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xl font-semibold">Proprietor Search</h4>
        <div className="flex items-center gap-2">
          {searchMutation.isSuccess && results.length > 0 && (
            <span className="text-sm text-gray-500 mr-2">Attempts Limit (per week) / Used : 100 / 1</span>
          )}
          {searchMutation.isSuccess && (
            <>
              <button onClick={() => exportToCsv("proprietor_search.csv", filtered, [
                { key: "appno", label: "App No" }, { key: "tmAppliedFor", label: "Applied For" },
                { key: "status", label: "Status" }, { key: "class", label: "Class" },
                { key: "buisnessName", label: "Company Name" }, { key: "dateOfApp", label: "Date of App" },
                { key: "userDetail", label: "User Detail" }, { key: "validUpto", label: "Valid Upto" },
                { key: "proprietorAdr", label: "Address" },
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
            <div className="mb-3">
              <input type="text" className="w-full border rounded px-3 py-2 text-sm" placeholder="Enter Company Name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="mb-3">
              <input type="text" className="w-full border rounded px-3 py-2 text-sm" placeholder="Enter Company Address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="mb-3">
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={showOptions} onChange={(e) => setShowOptions(e.target.checked)} className="rounded" />
                Additional Search Options
              </label>
            </div>
            {showOptions && (
              <>
                <div className="mb-3">
                  <select className="w-full border rounded px-3 py-2 text-sm" value={buisnessType} onChange={(e) => setBuisnessType(e.target.value)}>
                    <option value="">All</option>
                    <option value="PartnerShip firm">PartnerShip firm</option>
                    <option value="Private Limited Company">Private Limited Company</option>
                    <option value="Proprietor">Proprietor</option>
                    <option value="Society">Society</option>
                    <option value="Limited Liability Partnership">Limited Liability Partnership</option>
                    <option value="Hindu Undivided Fam">Hindu Undivided Fam</option>
                    <option value="Other">Other</option>
                    <option value="Indidual">Indidual</option>
                    <option value="Joint Firm">Joint Firm</option>
                    <option value="Joint Applicant">Joint Applicant</option>
                  </select>
                </div>
                <div className="mb-3">
                  <input type="text" className="w-full border rounded px-3 py-2 text-sm" placeholder="State" value={state} onChange={(e) => setState(e.target.value)} />
                </div>
                <div className="mb-3">
                  <input type="text" className="w-full border rounded px-3 py-2 text-sm" placeholder="Country" value={country} onChange={(e) => setCountry(e.target.value)} />
                </div>
              </>
            )}
            <div className="text-right">
              <button type="submit" disabled={searchMutation.isPending} className="bg-green-500 text-white px-6 py-2 rounded text-sm hover:bg-green-600 inline-flex items-center gap-2 disabled:opacity-50">
                {searchMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Get
              </button>
            </div>
          </form>
        </div>
      )}

      {searchMutation.isPending && (
        <div className="bg-white rounded shadow-sm border mt-4 p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Searching proprietor records...</p>
        </div>
      )}

      {/* Charts Section */}
      {searchMutation.isSuccess && results.length > 0 && stats && (
        <div className="bg-white rounded shadow-sm border p-4 mb-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center">
              <h6 className="text-sm font-semibold text-gray-600 mb-2">Drop Out Rate</h6>
              <div className="flex flex-col items-center">
                <div className="relative w-24 h-24">
                  <svg viewBox="0 0 36 36" className="w-24 h-24">
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#eee" strokeWidth="3" />
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e74c3c" strokeWidth="3" strokeDasharray={`${stats.dropOutRate}, 100`} />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">{stats.dropOutRate}</span>
                </div>
              </div>
              <h6 className="text-sm font-semibold text-gray-600 mt-3 mb-2">Renewal Rate</h6>
              <div className="flex flex-col items-center">
                <div className="relative w-24 h-24">
                  <svg viewBox="0 0 36 36" className="w-24 h-24">
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#eee" strokeWidth="3" />
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#27ae60" strokeWidth="3" strokeDasharray={`${stats.renewalRate}, 100`} />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">{stats.renewalRate}</span>
                </div>
              </div>
            </div>

            <div className="text-center">
              <h6 className="text-sm font-semibold text-gray-600 mb-2">Class wise filing</h6>
              {classWiseData.length > 0 && (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={classWiseData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={50}>
                      {classWiseData.map((_: any, idx: number) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="text-center">
              <h6 className="text-sm font-semibold text-gray-600 mb-2">Year wise filing</h6>
              {yearWiseData.length > 0 && (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={yearWiseData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3498db" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="text-center">
              <h6 className="text-sm font-semibold text-gray-600 mb-2">With User and Without at Time of filing</h6>
              {userTimelineData.length > 0 && (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={userTimelineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="withUser" stroke="#3498db" name="With User" dot={false} />
                    <Line type="monotone" dataKey="withoutUser" stroke="#e74c3c" name="Without User" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
              <div className="flex justify-center gap-4 mt-1 text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> With User</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Without User</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Bar - matches PHP filter row */}
      {searchMutation.isSuccess && results.length > 0 && (
        <div className="mb-3">
          <div className="flex flex-wrap gap-2">
            {[
              { key: "appno", label: "App#", type: "text" },
              { key: "tmAppliedFor", label: "Applied For", type: "text" },
              { key: "status", label: "Status", type: "select" },
              { key: "class", label: "Class", type: "select" },
              { key: "buisnessName", label: "Company Name", type: "select" },
              { key: "dateOfApp", label: "Date Of App", type: "text" },
              { key: "userDetail", label: "User Detail", type: "text" },
              { key: "validUpto", label: "Valid up to", type: "text" },
              { key: "address", label: "Address", type: "text" },
            ].map((col) => (
              <div key={col.key} className="relative">
                <button
                  onClick={() => toggleFilterDropdown(col.key)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded bg-white hover:bg-gray-50 text-gray-700"
                >
                  {col.label} <ChevronDown className="w-3 h-3" />
                </button>
                {openFilter === col.key && (
                  <div className="absolute top-full left-0 mt-1 bg-white border rounded shadow-lg z-50 p-2 min-w-[180px]" onClick={(e) => e.stopPropagation()}>
                    {col.type === "text" && (
                      <input
                        type="text"
                        className="w-full border rounded px-2 py-1 text-sm"
                        placeholder={`Filter ${col.label}...`}
                        value={
                          col.key === "appno" ? filterAppno :
                          col.key === "tmAppliedFor" ? filterAppliedFor :
                          col.key === "dateOfApp" ? filterDateOfApp :
                          col.key === "userDetail" ? filterUserDetail :
                          col.key === "validUpto" ? filterValidUpto :
                          col.key === "address" ? filterAddress : ""
                        }
                        onChange={(e) => {
                          const v = e.target.value;
                          if (col.key === "appno") setFilterAppno(v);
                          else if (col.key === "tmAppliedFor") setFilterAppliedFor(v);
                          else if (col.key === "dateOfApp") setFilterDateOfApp(v);
                          else if (col.key === "userDetail") setFilterUserDetail(v);
                          else if (col.key === "validUpto") setFilterValidUpto(v);
                          else if (col.key === "address") setFilterAddress(v);
                          setCurrentPage(1);
                        }}
                        autoFocus
                      />
                    )}
                    {col.type === "select" && col.key === "status" && (
                      <div className="max-h-48 overflow-y-auto">
                        {(stats?.filterStatus || []).map((s: string) => (
                          <label key={s} className="flex items-center gap-2 text-sm py-0.5 cursor-pointer hover:bg-gray-50 px-1 rounded">
                            <input type="checkbox" checked={filterStatus.includes(s)} onChange={() => toggleMultiFilter(filterStatus, s, setFilterStatus)} />
                            {s}
                          </label>
                        ))}
                      </div>
                    )}
                    {col.type === "select" && col.key === "class" && (
                      <div className="max-h-48 overflow-y-auto">
                        {(stats?.filterClass || []).sort((a: string, b: string) => Number(a) - Number(b)).map((c: string) => (
                          <label key={c} className="flex items-center gap-2 text-sm py-0.5 cursor-pointer hover:bg-gray-50 px-1 rounded">
                            <input type="checkbox" checked={filterClass.includes(c)} onChange={() => toggleMultiFilter(filterClass, c, setFilterClass)} />
                            Class {c}
                          </label>
                        ))}
                      </div>
                    )}
                    {col.type === "select" && col.key === "buisnessName" && (
                      <div className="max-h-48 overflow-y-auto" style={{ minWidth: "300px" }}>
                        {(stats?.filterBuisnessName || []).slice(0, 50).map((n: string) => (
                          <label key={n} className="flex items-center gap-2 text-sm py-0.5 cursor-pointer hover:bg-gray-50 px-1 rounded">
                            <input type="checkbox" checked={filterCompany.includes(n)} onChange={() => toggleMultiFilter(filterCompany, n, setFilterCompany)} />
                            <span className="truncate">{n}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* Active filter tags */}
          {(filterAppno || filterAppliedFor || filterStatus.length > 0 || filterClass.length > 0 || filterCompany.length > 0 || filterDateOfApp || filterUserDetail || filterValidUpto || filterAddress) && (
            <div className="flex flex-wrap gap-1 mt-2">
              {filterAppno && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                  App#: {filterAppno} <button onClick={() => setFilterAppno("")} className="ml-1 font-bold">×</button>
                </span>
              )}
              {filterAppliedFor && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                  Applied For: {filterAppliedFor} <button onClick={() => setFilterAppliedFor("")} className="ml-1 font-bold">×</button>
                </span>
              )}
              {filterStatus.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                  Status: {s} <button onClick={() => setFilterStatus(filterStatus.filter((v) => v !== s))} className="ml-1 font-bold">×</button>
                </span>
              ))}
              {filterClass.map((c) => (
                <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                  Class: {c} <button onClick={() => setFilterClass(filterClass.filter((v) => v !== c))} className="ml-1 font-bold">×</button>
                </span>
              ))}
              {filterCompany.map((n) => (
                <span key={n} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                  Company: {n} <button onClick={() => setFilterCompany(filterCompany.filter((v) => v !== n))} className="ml-1 font-bold">×</button>
                </span>
              ))}
              {filterDateOfApp && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                  Date: {filterDateOfApp} <button onClick={() => setFilterDateOfApp("")} className="ml-1 font-bold">×</button>
                </span>
              )}
              {filterUserDetail && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                  User: {filterUserDetail} <button onClick={() => setFilterUserDetail("")} className="ml-1 font-bold">×</button>
                </span>
              )}
              {filterValidUpto && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                  Valid: {filterValidUpto} <button onClick={() => setFilterValidUpto("")} className="ml-1 font-bold">×</button>
                </span>
              )}
              {filterAddress && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                  Address: {filterAddress} <button onClick={() => setFilterAddress("")} className="ml-1 font-bold">×</button>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Data Table */}
      {searchMutation.isSuccess && (
        <div className="bg-white rounded shadow-sm border mb-3">
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
            <table className="w-full text-sm" id="proprietorSearch">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-3 text-center font-medium text-gray-500">Logo</th>
                  <th className="px-3 py-3 text-center font-medium text-gray-500">Appno</th>
                  <th className="px-3 py-3 text-center font-medium text-gray-500">Applied For</th>
                  <th className="px-3 py-3 text-center font-medium text-gray-500">Status</th>
                  <th className="px-3 py-3 text-center font-medium text-gray-500">Class</th>
                  <th className="px-3 py-3 text-center font-medium text-gray-500">Company name</th>
                  <th className="px-3 py-3 text-center font-medium text-gray-500">Date of app</th>
                  <th className="px-3 py-3 text-center font-medium text-gray-500">User detail</th>
                  <th className="px-3 py-3 text-center font-medium text-gray-500">Valid up to</th>
                  <th className="px-3 py-3 text-center font-medium text-gray-500">Address</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginatedResults.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-500">No results found for this search</td></tr>
                ) : paginatedResults.map((item: any, i: number) => (
                  <tr key={i} className="hover:bg-yellow-50 text-center">
                    <td className="px-3 py-2">
                      {item.imgfile ? <img src={item.imgfile} alt="" className="w-[100px] object-contain mx-auto" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /> : null}
                    </td>
                    <td className="px-3 py-2">{item.appno || "-"}</td>
                    <td className="px-3 py-2 font-medium whitespace-pre-wrap">{item.tmAppliedFor || "-"}</td>
                    <td className="px-3 py-2">{getStatusBadge(item.status || "-")}</td>
                    <td className="px-3 py-2">{item.class || "-"}</td>
                    <td className="px-3 py-2 whitespace-pre-wrap">{item.buisnessName || "-"}</td>
                    <td className="px-3 py-2">{item.dateOfApp || "-"}</td>
                    <td className="px-3 py-2 whitespace-pre-wrap">{item.userDetail || "-"}</td>
                    <td className="px-3 py-2">{item.validUpto || "-"}</td>
                    <td className="px-3 py-2 whitespace-pre-wrap text-xs">{item.proprietorAdr || "-"}</td>
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

      {/* Attorney Table */}
      {searchMutation.isSuccess && agentEntries.length > 0 && (
        <div className="bg-white rounded shadow-sm border mb-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" id="attorney">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-3 text-center font-medium text-gray-500">Attorney</th>
                  <th className="px-3 py-3 text-center font-medium text-gray-500">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {agentEntries.map(([agent, count]) => (
                  <tr key={agent} className="text-center hover:bg-yellow-50">
                    <td className="px-3 py-2">{agent}</td>
                    <td className="px-3 py-2">{count}</td>
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
