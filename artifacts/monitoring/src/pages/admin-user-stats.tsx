import { useState } from "react";
import { Layout } from "@/components/layout";
import { useListUserStats } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";

export default function AdminUserStats() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useListUserStats({ page } as any);
  const stats = (data as any)?.data ?? [];
  const totalPages = (data as any)?.totalPages ?? 1;

  return (
    <Layout>
      <div className="mb-4"><h4 className="text-xl font-semibold">User Stats</h4></div>
      <div className="bg-white rounded shadow-sm border">
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">User</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Logged</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">IP</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">User Agent</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Proxy</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Location</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Screensize</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Logged Via</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {stats.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No user stats found</td></tr>
                ) : stats.map((s: any) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{s.userName || "-"}</td>
                    <td className="px-4 py-3">{s.lastLogin || s.logged ? new Date(s.lastLogin || s.logged).toLocaleString() : "-"}</td>
                    <td className="px-4 py-3">{s.ip || "-"}</td>
                    <td className="px-4 py-3 max-w-xs truncate text-xs">{s.userAgent || "-"}</td>
                    <td className="px-4 py-3">{s.useProxy ? "Yes" : "No"}</td>
                    <td className="px-4 py-3">{s.ipLocation || s.location || "-"}</td>
                    <td className="px-4 py-3">{s.screenSize || s.screensize || "-"}</td>
                    <td className="px-4 py-3">{s.loggedVia || "-"}</td>
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
