import { Layout } from "@/components/layout";
import { useListRoles } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";

export default function AdminRoles() {
  const { data: roles, isLoading } = useListRoles();
  const list = Array.isArray(roles) ? roles : [];

  return (
    <Layout>
      <div className="mb-4"><h4 className="text-xl font-semibold">Roles</h4></div>
      <div className="bg-white rounded shadow-sm border">
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">#</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Role Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Permissions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {list.length === 0 ? (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-500">No roles found</td></tr>
                ) : list.map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{r.id}</td>
                    <td className="px-4 py-3 font-medium capitalize">{r.name}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{r.permissions ? (typeof r.permissions === "string" ? r.permissions : JSON.stringify(r.permissions)) : "All"}</td>
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
