import { useState } from "react";
import { Layout } from "@/components/layout";
import { useListLogoSearches, useDeleteLogoSearch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2 } from "lucide-react";

export default function LogoView() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const { data, isLoading, refetch } = useListLogoSearches({ page } as any);
  const searches = (data as any)?.data ?? [];
  const totalPages = (data as any)?.totalPages ?? 1;

  const deleteMutation = useDeleteLogoSearch({
    mutation: { onSuccess: () => { toast({ title: "Deleted" }); refetch(); } },
  });

  return (
    <Layout>
      <div className="mb-4"><h4 className="text-xl font-semibold">Logo Search</h4></div>
      <div className="bg-white rounded shadow-sm border">
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">#</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">File</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Client</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Created</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {searches.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No logo searches found</td></tr>
                ) : searches.map((s: any) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{s.id}</td>
                    <td className="px-4 py-3 font-medium">{s.file || "-"}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs ${s.status === "completed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{s.status || "pending"}</span></td>
                    <td className="px-4 py-3">{s.clientName || "-"}</td>
                    <td className="px-4 py-3">{s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "-"}</td>
                    <td className="px-4 py-3"><button onClick={() => deleteMutation.mutate({ id: s.id })} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button></td>
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
