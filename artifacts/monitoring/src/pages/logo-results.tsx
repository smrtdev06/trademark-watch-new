import { useState } from "react";
import { Layout } from "@/components/layout";
import { useListLogoResults } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";

export default function LogoResults() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useListLogoResults({ page } as any);
  const results = (data as any)?.data ?? [];
  const totalPages = (data as any)?.totalPages ?? 1;

  return (
    <Layout>
      <div className="mb-4"><h4 className="text-xl font-semibold">Logo Search Results</h4></div>
      <div className="bg-white rounded shadow-sm border">
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">#</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Trademark</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">App No</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Match Score</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Class</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Country</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {results.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No results found</td></tr>
                ) : results.map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{r.id}</td>
                    <td className="px-4 py-3 font-medium">{r.trademarkName || "-"}</td>
                    <td className="px-4 py-3">{r.appno || "-"}</td>
                    <td className="px-4 py-3">{r.matchScore != null ? `${(r.matchScore * 100).toFixed(0)}%` : "-"}</td>
                    <td className="px-4 py-3">{r.class || "-"}</td>
                    <td className="px-4 py-3">{r.country || "-"}</td>
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
