import { useState } from "react";
import { Layout } from "@/components/layout";
import { Loader2, Search } from "lucide-react";

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? "/api";

interface Application {
  appId: string;
  tmname: string;
  translation: string;
  transliteration: string;
  date: string;
  journalDate: string;
  countryCode: string;
  appClass: string;
  compNameAndAddress: string;
}

export default function DebugKeywordTest() {
  const [keyword, setKeyword] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Application[] | null>(null);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return;
    setLoading(true);
    setError("");
    setResults(null);

    try {
      const r = await fetch(`${API_BASE}/debug/keyword-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ keyword: keyword.trim(), countryCode: countryCode.trim() || null, date: date.trim() || null }),
      });
      const data = await r.json();
      if (!r.ok || data.status === 0) {
        setError(data.message ?? "Request failed");
      } else {
        setResults(data.data ?? []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="mb-4">
        <h4 className="text-xl font-semibold">Keyword Test</h4>
        <p className="text-sm text-gray-500 mt-1">Run a phonetic search against the monitoring GraphQL API</p>
      </div>

      <div className="bg-white rounded shadow-sm border p-5 mb-5">
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Keyword <span className="text-red-500">*</span></label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="e.g. Apple"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              required
            />
          </div>
          <div className="w-32">
            <label className="block text-sm font-medium text-gray-700 mb-1">Country Code</label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2 text-sm uppercase"
              placeholder="e.g. IN"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
              maxLength={3}
            />
          </div>
          <div className="w-40">
            <label className="block text-sm font-medium text-gray-700 mb-1">Journal Date</label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="DD/MM/YYYY"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !keyword.trim()}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? "Searching…" : "Search"}
          </button>
        </form>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm">{error}</div>
      )}

      {results !== null && (
        <div className="bg-white rounded shadow-sm border overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Results</span>
            <span className="text-sm text-gray-500">{results.length} application{results.length !== 1 ? "s" : ""} found</span>
          </div>
          {results.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">No results found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">App ID</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">TM Name</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">Translation</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">Country</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">Class</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">Journal Date</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">Applicant</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {results.map((app, i) => (
                    <tr key={app.appId ?? i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-xs">{app.appId}</td>
                      <td className="px-3 py-2 font-medium">{app.tmname}</td>
                      <td className="px-3 py-2 text-gray-500">{app.translation || app.transliteration || "—"}</td>
                      <td className="px-3 py-2">{app.countryCode}</td>
                      <td className="px-3 py-2">{app.appClass}</td>
                      <td className="px-3 py-2">{app.journalDate}</td>
                      <td className="px-3 py-2 text-gray-600 max-w-[200px] truncate" title={app.compNameAndAddress}>
                        {app.compNameAndAddress}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
