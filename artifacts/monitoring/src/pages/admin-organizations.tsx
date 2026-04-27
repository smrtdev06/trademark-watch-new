import { Layout } from "@/components/layout";
import { useListOrganizations } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";

export default function AdminOrganizations() {
  const { data, isLoading } = useListOrganizations();
  const orgs = Array.isArray(data) ? data : (data as any)?.data ?? [];

  return (
    <Layout>
      <div className="mb-4"><h4 className="text-xl font-semibold">Organizations</h4></div>
      <div className="bg-white rounded shadow-sm border">
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">#</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Head Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Head Email</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Members</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orgs.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No organizations found</td></tr>
                ) : orgs.map((o: any) => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{o.id}</td>
                    <td className="px-4 py-3 font-medium">{o.name}</td>
                    <td className="px-4 py-3">{o.headName || "-"}</td>
                    <td className="px-4 py-3">{o.headEmail || "-"}</td>
                    <td className="px-4 py-3">{o.memberCount ?? "-"}</td>
                    <td className="px-4 py-3">{o.createdAt ? new Date(o.createdAt).toLocaleDateString() : "-"}</td>
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
