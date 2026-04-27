import { useState } from "react";
import { Layout } from "@/components/layout";
import { useListAlertResults } from "@workspace/api-client-react";
import { Loader2, Download } from "lucide-react";
import { exportToCsv } from "@/lib/export-csv";

export default function AlertsResults() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useListAlertResults({ page } as any);
  const results = (data as any)?.data ?? [];
  const totalPages = (data as any)?.totalPages ?? 1;

  return (
    <Layout>
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-xl font-semibold">Alerts Results</h4>
        <button onClick={() => exportToCsv("alert_results.csv", results, [
          { key: "keyword", label: "Keyword" }, { key: "clientName", label: "Client" },
          { key: "type", label: "Type" }, { key: "name", label: "Name" },
          { key: "address", label: "Address" }, { key: "userName", label: "User" },
          { key: "createdAt", label: "Added Date" },
        ])} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-1">
          <Download className="w-4 h-4" /> Export
        </button>
      </div>
      <div className="bg-white rounded shadow-sm border">
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Keyword</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Client</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Address</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">User</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Added Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {results.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No results found</td></tr>
                ) : results.map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{r.keyword}</td>
                    <td className="px-4 py-3">{r.clientName || r.client_name || "-"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">{r.type}</span>
                    </td>
                    <td className="px-4 py-3">{r.name || r.result?.name || "-"}</td>
                    <td className="px-4 py-3">{r.address || r.result?.address || "-"}</td>
                    <td className="px-4 py-3">{r.userName || "-"}</td>
                    <td className="px-4 py-3">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 border rounded text-sm disabled:opacity-50">Previous</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1 border rounded text-sm disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
