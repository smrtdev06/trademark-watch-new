import { useState } from "react";
import { Layout } from "@/components/layout";
import { useListSocialResults } from "@workspace/api-client-react";
import { Loader2, Star, ExternalLink, Download } from "lucide-react";
import { exportToCsv } from "@/lib/export-csv";

export default function SocialResults() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useListSocialResults({ page } as any);
  const results = (data as any)?.data ?? [];
  const totalPages = (data as any)?.totalPages ?? 1;

  return (
    <Layout>
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-xl font-semibold">Results</h4>
        <button onClick={() => exportToCsv("social_results.csv", results, [
          { key: "title", label: "Title" }, { key: "pageUrl", label: "URL" },
          { key: "createdAt", label: "Date" },
        ])} className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1">
          <Download className="w-4 h-4" /> Export
        </button>
      </div>
      <div className="bg-white rounded shadow-sm border p-4">
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : results.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No results found</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {results.map((r: any) => (
              <div key={r.id} className="border rounded overflow-hidden relative group">
                <div className="text-xs text-center bg-gray-100 py-1 font-medium text-gray-600">
                  {r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-GB") : "-"}
                </div>
                <a href={r.pageUrl || r.page_url || r.link || "#"} target="_blank" rel="noopener noreferrer">
                  {r.image || r.imageUrl ? (
                    <img src={r.image || r.imageUrl} alt={r.title || ""} className="w-full h-32 object-cover" />
                  ) : (
                    <div className="w-full h-32 bg-gray-200 flex items-center justify-center text-gray-400">
                      <ExternalLink className="w-8 h-8" />
                    </div>
                  )}
                </a>
                <button onClick={() => {}} className="absolute bottom-2 right-2 bg-blue-500 hover:bg-yellow-500 text-white p-1 rounded text-xs" title="Bookmark">
                  <Star className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t">
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
