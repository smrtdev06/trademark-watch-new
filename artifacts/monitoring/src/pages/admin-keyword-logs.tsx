import { useState } from "react";
import { Layout } from "@/components/layout";
import { Loader2 } from "lucide-react";

export default function AdminKeywordLogs() {
  const [page, setPage] = useState(1);
  const isLoading = false;
  const logs: any[] = [];
  const totalPages = 1;

  return (
    <Layout>
      <div className="mb-4"><h4 className="text-xl font-semibold">Keyword Logs</h4></div>
      <div className="bg-white rounded shadow-sm border">
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Trademark</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Class</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Country</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">User</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Added</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Deleted</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No keyword logs found</td></tr>
                ) : logs.map((l: any) => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{l.keyword}</td>
                    <td className="px-4 py-3">{l.class || "-"}</td>
                    <td className="px-4 py-3">{l.country || "-"}</td>
                    <td className="px-4 py-3">{l.userName || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${l.status === "active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                        {l.status || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{l.createdAt ? new Date(l.createdAt).toLocaleDateString() : "-"}</td>
                    <td className="px-4 py-3">{l.deletedAt ? new Date(l.deletedAt).toLocaleDateString() : "-"}</td>
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
