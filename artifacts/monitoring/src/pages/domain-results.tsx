import { useState } from "react";
import { Layout } from "@/components/layout";
import { useListDomainResults } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";

export default function DomainResults() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useListDomainResults({ page } as any);
  const results = (data as any)?.data ?? [];
  const totalPages = (data as any)?.totalPages ?? 1;

  return (
    <Layout>
      <div className="mb-4"><h4 className="text-xl font-semibold">Domain Monitoring Results</h4></div>
      <div className="bg-white rounded shadow-sm border">
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Domain</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Found Domain</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Client</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Registrant Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Registrant Country</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Created Date</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Added At</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {results.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      <p>No WHOIS hits yet.</p>
                      <p className="mt-2 text-xs text-gray-400">
                        Results appear after the domain check runs (automatically when you add or edit a watch, and daily
                        at 10:00). If nothing shows after a few minutes, the external registry API may have returned no
                        matches for your search.
                      </p>
                    </td>
                  </tr>
                ) : results.map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{r.domain}</td>
                    <td className="px-4 py-3">{r.domainName || r.domain_name || "-"}</td>
                    <td className="px-4 py-3">{r.clientName || "-"}</td>
                    <td className="px-4 py-3">{r.registrantName || r.registrant_name || "-"}</td>
                    <td className="px-4 py-3">{r.registrantCountry || r.registrant_country || "-"}</td>
                    <td className="px-4 py-3">{r.createDate || r.create_date ? new Date(r.createDate || r.create_date).toLocaleDateString() : "-"}</td>
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
