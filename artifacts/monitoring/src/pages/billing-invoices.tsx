import { useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useListInvoices } from "@workspace/api-client-react";
import { Loader2, ShoppingCart } from "lucide-react";

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  trial:     { label: "Trial",      cls: "bg-yellow-100 text-yellow-800" },
  trial_end: { label: "Trial End",  cls: "bg-gray-100 text-gray-600" },
  active:    { label: "Active",     cls: "bg-green-100 text-green-700" },
  inactive:  { label: "Inactive",   cls: "bg-red-100 text-red-600" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { label: status, cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.cls}`}>{s.label}</span>
  );
}

export default function BillingInvoices() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useListInvoices({ page } as any);
  const invoices = (data as any)?.data ?? [];
  const totalPages = (data as any)?.totalPages ?? 1;

  return (
    <Layout>
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-xl font-semibold">Your Products</h4>
        <Link href="/products">
          <a className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
            <ShoppingCart className="w-4 h-4" />
            Browse Plans
          </a>
        </Link>
      </div>

      <div className="bg-white rounded shadow-sm border">
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">#</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Product</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Active Until</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                      <p className="mb-2">No products assigned yet.</p>
                      <Link href="/products">
                        <a className="text-blue-600 hover:underline text-sm">Browse available plans →</a>
                      </Link>
                    </td>
                  </tr>
                ) : invoices.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">{inv.id}</td>
                    <td className="px-4 py-3 font-medium">{inv.product_name || "-"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={inv.displayStatus ?? inv.status ?? "inactive"} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {inv.activeUntil
                        ? new Date(inv.activeUntil).toLocaleDateString()
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {inv.canPay && inv.product_id && (
                        <Link href={`/products/${inv.product_id}`}>
                          <a className="flex items-center gap-1 bg-amber-500 text-white px-3 py-1.5 rounded text-xs hover:bg-amber-600 w-fit">
                            <ShoppingCart className="w-3 h-3" />
                            Pay
                          </a>
                        </Link>
                      )}
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
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
