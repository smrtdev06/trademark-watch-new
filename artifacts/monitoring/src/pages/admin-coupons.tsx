import { Layout } from "@/components/layout";
import { useListCoupons } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";

export default function AdminCoupons() {
  const { data, isLoading } = useListCoupons();
  const coupons = Array.isArray(data) ? data : (data as any)?.data ?? [];

  return (
    <Layout>
      <div className="mb-4"><h4 className="text-xl font-semibold">Coupons</h4></div>
      <div className="bg-white rounded shadow-sm border">
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">#</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Code</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Discount</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {coupons.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No coupons found</td></tr>
                ) : coupons.map((c: any) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{c.id}</td>
                    <td className="px-4 py-3 font-medium font-mono">{c.code}</td>
                    <td className="px-4 py-3">{c.discount}%</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs ${c.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{c.active ? "Active" : "Expired"}</span></td>
                    <td className="px-4 py-3">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
