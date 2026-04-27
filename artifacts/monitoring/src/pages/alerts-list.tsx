import { useState } from "react";
import { Layout } from "@/components/layout";
import { useListAlerts, useDeleteAlert } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2 } from "lucide-react";

export default function AlertsList() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch } = useListAlerts({ page, search: search || undefined } as any);
  const alerts = (data as any)?.data ?? [];
  const totalPages = (data as any)?.totalPages ?? 1;

  const deleteMutation = useDeleteAlert({
    mutation: {
      onSuccess: () => { toast({ title: "Alert deleted" }); refetch(); },
      onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    },
  });

  return (
    <Layout>
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-xl font-semibold">Alerts List</h4>
        <input
          type="text"
          placeholder="Search..."
          className="border rounded px-3 py-1.5 text-sm w-64"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
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
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Sites</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Client</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">User</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Search Mode</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Frequency (days)</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {alerts.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No alerts found</td></tr>
                ) : alerts.map((a: any) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{a.keyword}</td>
                    <td className="px-4 py-3">{a.sites || a.buisnessTypeSpecific || "-"}</td>
                    <td className="px-4 py-3">{a.clientName || "-"}</td>
                    <td className="px-4 py-3">{a.userName || "-"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">{a.type}</span>
                    </td>
                    <td className="px-4 py-3">{a.searchMode || "-"}</td>
                    <td className="px-4 py-3">{a.freq || "-"}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => deleteMutation.mutate({ id: a.id })}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
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
