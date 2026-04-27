import { Layout } from "@/components/layout";
import { useGetMyOrganization } from "@workspace/api-client-react";
import { Loader2, Users } from "lucide-react";

export default function Organization() {
  const { data, isLoading } = useGetMyOrganization();
  const org = (data as any)?.organization;
  const head = (data as any)?.head ?? [];
  const members = (data as any)?.members ?? [];

  return (
    <Layout>
      <div className="mb-4"><h4 className="text-xl font-semibold">Your Organization</h4></div>
      {isLoading ? (
        <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : !org ? (
        <div className="bg-white rounded shadow-sm border p-8 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">You are not part of any organization yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded shadow-sm border p-4">
            <h5 className="font-semibold mb-2">{org.name}</h5>
            <p className="text-sm text-gray-500">{org.description || "No description"}</p>
          </div>
          {head.length > 0 && (
            <div className="bg-white rounded shadow-sm border p-4">
              <h6 className="font-semibold mb-2">Organization Head</h6>
              {head.map((m: any) => (
                <div key={m.id} className="flex items-center gap-3 py-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-medium">{m.userName?.[0] || "?"}</div>
                  <div><div className="text-sm font-medium">{m.userName}</div><div className="text-xs text-gray-500">{m.userEmail}</div></div>
                </div>
              ))}
            </div>
          )}
          {members.length > 0 && (
            <div className="bg-white rounded shadow-sm border p-4">
              <h6 className="font-semibold mb-2">Members ({members.length})</h6>
              {members.map((m: any) => (
                <div key={m.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-sm font-medium">{m.userName?.[0] || "?"}</div>
                  <div><div className="text-sm font-medium">{m.userName}</div><div className="text-xs text-gray-500">{m.userEmail}</div></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
