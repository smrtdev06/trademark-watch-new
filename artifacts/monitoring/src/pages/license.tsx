import { Layout } from "@/components/layout";
import { useState } from "react";
import { Loader2, Download } from "lucide-react";
import { exportToCsv } from "@/lib/export-csv";
import { useSearchLicense } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";

function normalizeResults(data: any, searchType: string): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (searchType === "all") {
    const all: any[] = [];
    for (const [key, arr] of Object.entries(data)) {
      if (Array.isArray(arr)) {
        (arr as any[]).forEach((item: any) => all.push({ ...item, _source: key }));
      }
    }
    return all;
  }
  const typedData = data[searchType];
  if (Array.isArray(typedData)) return typedData.map((item: any) => ({ ...item, _source: searchType }));
  return [];
}

export default function LicenseSearch() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [keyword, setKeyword] = useState("");
  const [searchType, setSearchType] = useState<string>("");
  const [startsWith, setStartsWith] = useState<string>("*");
  const [searchTerm, setSearchTerm] = useState("");
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const searchMutation = useSearchLicense();
  const responseData = (searchMutation.data as any)?.data;

  const fssaiResults = normalizeResults(responseData, "fssai").length > 0
    ? normalizeResults(responseData, "fssai")
    : (searchType === "fssai" || searchType === "all") ? normalizeResults(responseData, "fssai") : [];
  const udyaamResults = normalizeResults(responseData, "udyaam").length > 0
    ? normalizeResults(responseData, "udyaam")
    : (searchType === "udyaam" || searchType === "all") ? normalizeResults(responseData, "udyaam") : [];
  const mcaResults = normalizeResults(responseData, "mca").length > 0
    ? normalizeResults(responseData, "mca")
    : (searchType === "mca" || searchType === "all") ? normalizeResults(responseData, "mca") : [];
  const citationsResults = normalizeResults(responseData, "citations").length > 0
    ? normalizeResults(responseData, "citations")
    : (searchType === "citations" || searchType === "all") ? normalizeResults(responseData, "citations") : [];

  const getAllResults = () => {
    if (searchType === "all") {
      return [...fssaiResults, ...udyaamResults, ...mcaResults, ...citationsResults];
    }
    if (searchType === "fssai") return fssaiResults;
    if (searchType === "udyaam") return udyaamResults;
    if (searchType === "mca") return mcaResults;
    if (searchType === "citations") return citationsResults;
    return [];
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword || !searchType) return;
    setCurrentPage(1);
    searchMutation.mutate({ data: { keyword, type: searchType, startsWith } });
  };

  const handleAnotherSearch = () => {
    searchMutation.reset();
    setKeyword("");
    setSearchType("");
    setStartsWith("*");
    setSearchTerm("");
    setCurrentPage(1);
  };

  const filterBySearchTerm = (items: any[], fields: string[]) => {
    if (!searchTerm) return items;
    const s = searchTerm.toLowerCase();
    return items.filter((item: any) =>
      fields.some(f => (item[f] || "").toString().toLowerCase().includes(s))
    );
  };

  const paginate = (items: any[]) => {
    const totalPages = Math.ceil(items.length / entriesPerPage);
    const paginated = items.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);
    return { paginated, totalPages, total: items.length };
  };

  const showFssai = searchType === "fssai" || searchType === "all";
  const showUdyaam = searchType === "udyaam" || searchType === "all";
  const showMca = searchType === "mca" || searchType === "all";
  const showCitations = searchType === "citations" || searchType === "all";

  return (
    <Layout>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xl font-semibold">License</h4>
        <div className="flex items-center gap-2">
          {searchMutation.isSuccess && (
            <>
              <button onClick={() => exportToCsv("license_results.csv", getAllResults())} className="bg-blue-500 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-600 flex items-center gap-1">
                <Download className="w-3 h-3" /> XLS Export
              </button>
              <button onClick={() => exportToCsv("license_results.csv", getAllResults())} className="bg-blue-500 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-600 flex items-center gap-1">
                <Download className="w-3 h-3" /> PDF Export
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
              <div className="w-48">
                <select className="w-full border rounded px-3 py-2 text-sm" value={searchType} onChange={(e) => setSearchType(e.target.value)}>
                  <option value="">- Search Type -</option>
                  <option value="fssai">FSSAI</option>
                  <option value="udyaam">Udyaam</option>
                  <option value="mca">MCA</option>
                  <option value="citations">Citations</option>
                  <option value="all">All</option>
                </select>
              </div>
              <div>
                <input type="text" className="border rounded px-3 py-2 text-sm w-44" placeholder="Keyword" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
              </div>
              <div className="w-40">
                <select className="w-full border rounded px-3 py-2 text-sm" value={startsWith} onChange={(e) => setStartsWith(e.target.value)}>
                  <option value="*">Contains</option>
                  <option value="">Starts</option>
                </select>
              </div>
              <div>
                <button type="submit" disabled={searchMutation.isPending || !searchType} className="bg-green-500 text-white px-6 py-2 rounded text-sm hover:bg-green-600 flex items-center gap-2 disabled:opacity-50">
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
          <p className="text-sm text-gray-500">Searching license records...</p>
        </div>
      )}

      {searchMutation.isSuccess && (
        <>
          {showFssai && fssaiResults.length > 0 && (() => {
            const filtered = filterBySearchTerm(fssaiResults, ["kob_name", "companyname", "premiseaddress", "licenseno", "licensecategoryname", "licenseactive"]);
            const { paginated, totalPages, total } = paginate(filtered);
            return (
              <div className="bg-white rounded shadow-sm border mt-4">
                <div className="flex flex-col sm:flex-row items-center justify-between p-3 border-b gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span>Show</span>
                    <select value={entriesPerPage} onChange={(e) => { setEntriesPerPage(Number(e.target.value)); setCurrentPage(1); }} className="border rounded px-2 py-1 text-sm">
                      <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
                    </select>
                    <span>entries</span>
                  </div>
                  {searchType === "all" && <h6 className="text-sm font-semibold">FSSAI</h6>}
                  <div className="flex items-center gap-2 text-sm">
                    <span>Search:</span>
                    <input type="text" className="border rounded px-2 py-1 text-sm w-40" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-3 py-3 text-center font-medium text-gray-500">Name</th>
                        <th className="px-3 py-3 text-center font-medium text-gray-500">Company</th>
                        <th className="px-3 py-3 text-center font-medium text-gray-500">Address</th>
                        <th className="px-3 py-3 text-center font-medium text-gray-500">License No.</th>
                        <th className="px-3 py-3 text-center font-medium text-gray-500">Category</th>
                        <th className="px-3 py-3 text-center font-medium text-gray-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {paginated.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No results found</td></tr>
                      ) : paginated.map((item: any, i: number) => (
                        <tr key={i} className="hover:bg-yellow-50 text-center">
                          <td className="px-3 py-2">{item.kob_name || "-"}</td>
                          <td className="px-3 py-2">{item.companyname || "-"}</td>
                          <td className="px-3 py-2">{item.premiseaddress || "-"}</td>
                          <td className="px-3 py-2">{item.licenseno || "-"}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs text-white ${item.licensecategoryname === "State License" ? "bg-yellow-500" : "bg-blue-400"}`}>
                              {item.licensecategoryname || "-"}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs text-white ${item.licenseactive === "Active" ? "bg-green-500" : "bg-red-500"}`}>
                              {item.licenseactive || "-"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {total > 0 && (
                  <div className="flex items-center justify-between p-3 border-t text-sm text-gray-500">
                    <span>Showing {(currentPage - 1) * entriesPerPage + 1} to {Math.min(currentPage * entriesPerPage, total)} of {total} entries</span>
                    <div className="flex items-center gap-1">
                      <button disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)} className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50">Previous</button>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let page: number;
                        if (totalPages <= 5) page = i + 1;
                        else if (currentPage <= 3) page = i + 1;
                        else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
                        else page = currentPage - 2 + i;
                        return <button key={page} onClick={() => setCurrentPage(page)} className={`px-3 py-1 border rounded ${currentPage === page ? "bg-blue-600 text-white" : "hover:bg-gray-50"}`}>{page}</button>;
                      })}
                      <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)} className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50">Next</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {showUdyaam && udyaamResults.length > 0 && (() => {
            const filtered = filterBySearchTerm(udyaamResults, ["name", "unit", "address", "state", "district", "pin"]);
            const { paginated, totalPages, total } = paginate(filtered);
            return (
              <div className="bg-white rounded shadow-sm border mt-4">
                <div className="flex flex-col sm:flex-row items-center justify-between p-3 border-b gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span>Show</span>
                    <select value={entriesPerPage} onChange={(e) => { setEntriesPerPage(Number(e.target.value)); setCurrentPage(1); }} className="border rounded px-2 py-1 text-sm">
                      <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
                    </select>
                    <span>entries</span>
                  </div>
                  {searchType === "all" && <h6 className="text-sm font-semibold">Udyaam</h6>}
                  <div className="flex items-center gap-2 text-sm">
                    <span>Search:</span>
                    <input type="text" className="border rounded px-2 py-1 text-sm w-40" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-3 py-3 text-center font-medium text-gray-500">Name</th>
                        <th className="px-3 py-3 text-center font-medium text-gray-500">Unit</th>
                        <th className="px-3 py-3 text-center font-medium text-gray-500">Address</th>
                        <th className="px-3 py-3 text-center font-medium text-gray-500">State</th>
                        <th className="px-3 py-3 text-center font-medium text-gray-500">District</th>
                        <th className="px-3 py-3 text-center font-medium text-gray-500">Pin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {paginated.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No results found</td></tr>
                      ) : paginated.map((item: any, i: number) => (
                        <tr key={i} className="hover:bg-yellow-50 text-center">
                          <td className="px-3 py-2">{item.name || "-"}</td>
                          <td className="px-3 py-2">{item.unit || "-"}</td>
                          <td className="px-3 py-2">{item.address || "-"}</td>
                          <td className="px-3 py-2">{item.state || "-"}</td>
                          <td className="px-3 py-2">{item.district || "-"}</td>
                          <td className="px-3 py-2">{item.pin || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {total > 0 && (
                  <div className="flex items-center justify-between p-3 border-t text-sm text-gray-500">
                    <span>Showing {(currentPage - 1) * entriesPerPage + 1} to {Math.min(currentPage * entriesPerPage, total)} of {total} entries</span>
                    <div className="flex items-center gap-1">
                      <button disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)} className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50">Previous</button>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let page: number;
                        if (totalPages <= 5) page = i + 1;
                        else if (currentPage <= 3) page = i + 1;
                        else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
                        else page = currentPage - 2 + i;
                        return <button key={page} onClick={() => setCurrentPage(page)} className={`px-3 py-1 border rounded ${currentPage === page ? "bg-blue-600 text-white" : "hover:bg-gray-50"}`}>{page}</button>;
                      })}
                      <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)} className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50">Next</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {showMca && mcaResults.length > 0 && (() => {
            const filtered = filterBySearchTerm(mcaResults, ["cin", "name", "date", "state", "address", "roc", "description"]);
            const { paginated, totalPages, total } = paginate(filtered);
            return (
              <div className="bg-white rounded shadow-sm border mt-4">
                <div className="flex flex-col sm:flex-row items-center justify-between p-3 border-b gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span>Show</span>
                    <select value={entriesPerPage} onChange={(e) => { setEntriesPerPage(Number(e.target.value)); setCurrentPage(1); }} className="border rounded px-2 py-1 text-sm">
                      <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
                    </select>
                    <span>entries</span>
                  </div>
                  {searchType === "all" && <h6 className="text-sm font-semibold">MCA</h6>}
                  <div className="flex items-center gap-2 text-sm">
                    <span>Search:</span>
                    <input type="text" className="border rounded px-2 py-1 text-sm w-40" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-3 py-3 text-center font-medium text-gray-500">CIN</th>
                        <th className="px-3 py-3 text-center font-medium text-gray-500">Name</th>
                        <th className="px-3 py-3 text-center font-medium text-gray-500">Date</th>
                        <th className="px-3 py-3 text-center font-medium text-gray-500">State</th>
                        <th className="px-3 py-3 text-center font-medium text-gray-500">Address</th>
                        <th className="px-3 py-3 text-center font-medium text-gray-500">Roc</th>
                        <th className="px-3 py-3 text-center font-medium text-gray-500">Description</th>
                        {isAdmin && <th className="px-3 py-3 text-center font-medium text-gray-500">Created</th>}
                        {isAdmin && <th className="px-3 py-3 text-center font-medium text-gray-500">Updated</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {paginated.length === 0 ? (
                        <tr><td colSpan={isAdmin ? 9 : 7} className="px-4 py-8 text-center text-gray-500">No results found</td></tr>
                      ) : paginated.map((item: any, i: number) => (
                        <tr key={i} className="hover:bg-yellow-50 text-center">
                          <td className="px-3 py-2">{item.cin || "-"}</td>
                          <td className="px-3 py-2">{item.name || "-"}</td>
                          <td className="px-3 py-2">{item.date || "-"}</td>
                          <td className="px-3 py-2">{item.state || "-"}</td>
                          <td className="px-3 py-2">{item.address || "-"}</td>
                          <td className="px-3 py-2">{item.roc || "-"}</td>
                          <td className="px-3 py-2">{item.description || "-"}</td>
                          {isAdmin && <td className="px-3 py-2">{item.created_at ? new Date(item.created_at).toLocaleDateString("en-GB") : "-"}</td>}
                          {isAdmin && <td className="px-3 py-2">{item.updated_at ? new Date(item.updated_at).toLocaleDateString("en-GB") : "-"}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {total > 0 && (
                  <div className="flex items-center justify-between p-3 border-t text-sm text-gray-500">
                    <span>Showing {(currentPage - 1) * entriesPerPage + 1} to {Math.min(currentPage * entriesPerPage, total)} of {total} entries</span>
                    <div className="flex items-center gap-1">
                      <button disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)} className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50">Previous</button>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let page: number;
                        if (totalPages <= 5) page = i + 1;
                        else if (currentPage <= 3) page = i + 1;
                        else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
                        else page = currentPage - 2 + i;
                        return <button key={page} onClick={() => setCurrentPage(page)} className={`px-3 py-1 border rounded ${currentPage === page ? "bg-blue-600 text-white" : "hover:bg-gray-50"}`}>{page}</button>;
                      })}
                      <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)} className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50">Next</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {showCitations && citationsResults.length > 0 && (() => {
            const filtered = filterBySearchTerm(citationsResults, ["id", "url", "brand", "manufacturer"]);
            const { paginated, totalPages, total } = paginate(filtered);
            return (
              <div className="bg-white rounded shadow-sm border mt-4">
                <div className="flex flex-col sm:flex-row items-center justify-between p-3 border-b gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span>Show</span>
                    <select value={entriesPerPage} onChange={(e) => { setEntriesPerPage(Number(e.target.value)); setCurrentPage(1); }} className="border rounded px-2 py-1 text-sm">
                      <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
                    </select>
                    <span>entries</span>
                  </div>
                  {searchType === "all" && <h6 className="text-sm font-semibold">Citations</h6>}
                  <div className="flex items-center gap-2 text-sm">
                    <span>Search:</span>
                    <input type="text" className="border rounded px-2 py-1 text-sm w-40" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-3 py-3 text-center font-medium text-gray-500">ID</th>
                        <th className="px-3 py-3 text-center font-medium text-gray-500">URL</th>
                        <th className="px-3 py-3 text-center font-medium text-gray-500">Brand</th>
                        <th className="px-3 py-3 text-center font-medium text-gray-500">Manufacturer</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {paginated.length === 0 ? (
                        <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No results found</td></tr>
                      ) : paginated.map((item: any, i: number) => (
                        <tr key={i} className="hover:bg-yellow-50 text-center">
                          <td className="px-3 py-2">{item.id || "-"}</td>
                          <td className="px-3 py-2">
                            {item.url ? (
                              <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                {(() => { try { return new URL(item.url).hostname; } catch { return item.url; } })()}
                              </a>
                            ) : "-"}
                          </td>
                          <td className="px-3 py-2">{item.brand ? item.brand.split(" ").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ") : "-"}</td>
                          <td className="px-3 py-2">{item.manufacturer || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {total > 0 && (
                  <div className="flex items-center justify-between p-3 border-t text-sm text-gray-500">
                    <span>Showing {(currentPage - 1) * entriesPerPage + 1} to {Math.min(currentPage * entriesPerPage, total)} of {total} entries</span>
                    <div className="flex items-center gap-1">
                      <button disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)} className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50">Previous</button>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let page: number;
                        if (totalPages <= 5) page = i + 1;
                        else if (currentPage <= 3) page = i + 1;
                        else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
                        else page = currentPage - 2 + i;
                        return <button key={page} onClick={() => setCurrentPage(page)} className={`px-3 py-1 border rounded ${currentPage === page ? "bg-blue-600 text-white" : "hover:bg-gray-50"}`}>{page}</button>;
                      })}
                      <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)} className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50">Next</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {showFssai && fssaiResults.length === 0 && showUdyaam && udyaamResults.length === 0 && showMca && mcaResults.length === 0 && showCitations && citationsResults.length === 0 && (
            <div className="bg-white rounded shadow-sm border mt-4 p-8 text-center text-gray-500">
              No results found
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
