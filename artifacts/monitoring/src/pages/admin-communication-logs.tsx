import { useState } from "react";
import { Layout } from "@/components/layout";
import { useListCommunicationLogs } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";

export default function AdminCommunicationLogs() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useListCommunicationLogs({ page } as any);
  const logs = (data as any)?.data ?? [];
  const totalPages = (data as any)?.totalPages ?? 1;

  return (
    <Layout>
      <div className="mb-4"><h4 className="text-xl font-semibold">Communication Logs</h4></div>
      <div className="bg-white rounded shadow-sm border">
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">User</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Subject</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Added Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No communication logs found</td></tr>
                ) : logs.map((l: any) => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{l.userName || l.recipient || "-"}</td>
                    <td className="px-4 py-3">{l.type || "-"}</td>
                    <td className="px-4 py-3 max-w-xs truncate">{l.subject || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${l.status === "sent" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                        {l.status || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{l.createdAt ? new Date(l.createdAt).toLocaleDateString() : "-"}</td>
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
