import { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { Loader2, RefreshCw } from "lucide-react";

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? "/api";

interface JournalRow {
  id: number;
  countryCode: string;
  journalDate: string;
  createdAt: string;
}

export default function DebugLatestJournals() {
  const [rows, setRows] = useState<JournalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    fetch(`${API_BASE}/debug/latest-journals`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <Layout>
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-xl font-semibold">Latest Journals</h4>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 text-sm bg-blue-600 text-white px-3 py-1.5 rounded disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm">{error}</div>
      )}

      <div className="bg-white rounded shadow-sm border overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No journal entries found in monitoring_latest table.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">ID</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Country Code</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Journal Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Recorded At</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{row.id}</td>
                  <td className="px-4 py-3 font-medium">{row.countryCode}</td>
                  <td className="px-4 py-3">{row.journalDate}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(row.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-3 text-xs text-gray-400">
        Rows from <code>monitoring_latest</code> table — updated by the monitoring cron after each journal fetch.
      </p>
    </Layout>
  );
}
