import { Layout } from "@/components/layout";
import { useState } from "react";
import { Loader2 } from "lucide-react";

const SITES = [
  { value: "", label: " - Select Site - " },
  { value: "indiamart.com", label: "IndiaMart" },
  { value: "amazon.in", label: "Amazon" },
  { value: "flipkart.in", label: "FlipKart" },
  { value: "tradeindia.com", label: "TradeIndia" },
];

export default function SearchB2B() {
  const [keyword, setKeyword] = useState("");
  const [site, setSite] = useState("");
  const [searchVariation, setSearchVariation] = useState(false);
  const [searchExact, setSearchExact] = useState(false);
  const [excludeCompanies, setExcludeCompanies] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [currPage, setCurrPage] = useState(1);

  const handleSearch = async (e: React.FormEvent, direction?: string) => {
    if (e) e.preventDefault();
    if (!keyword) return;
    setLoading(true);
    setHasSearched(true);

    try {
      const token = localStorage.getItem("token");
      const baseUrl = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;
      const params = new URLSearchParams({ keyword });
      if (site) params.append("site", site);
      if (searchVariation) params.append("searchType", "variation");
      if (searchExact) params.append("searchType", "exact");
      if (excludeCompanies) params.append("excludeCompanies", excludeCompanies);

      let nextPage = currPage;
      if (direction === "next") nextPage = currPage + 1;
      else if (direction === "previous") nextPage = Math.max(1, currPage - 1);
      else nextPage = 1;
      params.append("page", String(nextPage));

      const resp = await fetch(`${baseUrl}/search/b2b?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setRecords(data.records || []);
        setCurrPage(nextPage);
      } else {
        setRecords([]);
      }
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-xl font-semibold">B2B/B2C In Search</h4>
        {hasSearched && records.length > 0 && (
          <button className="bg-blue-500 text-white px-3 py-1.5 rounded text-sm">Export</button>
        )}
      </div>

      <div className="bg-white rounded shadow-sm border p-4 mb-4">
        <form onSubmit={handleSearch} className="flex flex-wrap items-start gap-3">
          <div className="w-full sm:w-auto sm:flex-[3]">
            <input
              type="text"
              placeholder="Keyword"
              className="w-full border rounded px-3 py-2 text-sm"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              required
            />
          </div>

          <div className="w-full sm:w-auto sm:flex-[2]">
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={site}
              onChange={(e) => setSite(e.target.value)}
            >
              {SITES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-auto sm:flex-[2] flex flex-col gap-1">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={searchVariation}
                onChange={(e) => setSearchVariation(e.target.checked)}
                className="rounded"
              />
              Search Variations
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={searchExact}
                onChange={(e) => setSearchExact(e.target.checked)}
                className="rounded"
              />
              Search Exact
            </label>
          </div>

          <div className="w-full sm:w-auto sm:flex-[4]">
            <input
              type="text"
              placeholder="Exclude of Company (enter via comma)"
              className="w-full border rounded px-3 py-2 text-sm"
              value={excludeCompanies}
              onChange={(e) => setExcludeCompanies(e.target.value)}
            />
          </div>

          <div className="w-full sm:w-auto sm:flex-[1]">
            <button
              type="submit"
              disabled={loading}
              className="bg-green-500 text-white px-4 py-2 rounded text-sm hover:bg-green-600 disabled:opacity-50 w-full sm:w-auto"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Search"}
            </button>
          </div>
        </form>
      </div>

      {hasSearched && !loading && (
        <div className="bg-white rounded shadow-sm border mb-4">
          {records.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="text-lg font-medium">No records found</p>
              <p className="text-sm mt-1">Try adjusting your search criteria.</p>
            </div>
          ) : (
            <div className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {records.map((record: any, idx: number) => (
                  <div key={idx} className="relative border rounded overflow-hidden group">
                    <a href={record.link} target="_blank" rel="noopener noreferrer">
                      <img src={record.imageUrl} alt="" className="w-full h-auto" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(records.length > 0 || currPage > 1) && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <button
                type="button"
                disabled={currPage <= 1}
                onClick={() => handleSearch({ preventDefault: () => {} } as any, "previous")}
                className="px-3 py-1.5 bg-green-500 text-white rounded text-sm disabled:opacity-50"
              >
                &lt; Previous page
              </button>
              <button
                type="button"
                disabled={records.length === 0}
                onClick={() => handleSearch({ preventDefault: () => {} } as any, "next")}
                className="px-3 py-1.5 bg-green-500 text-white rounded text-sm disabled:opacity-50"
              >
                Next page &gt;
              </button>
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="bg-white rounded shadow-sm border p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}
    </Layout>
  );
}
