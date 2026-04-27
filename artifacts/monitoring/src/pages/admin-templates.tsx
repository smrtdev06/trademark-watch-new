import { Layout } from "@/components/layout";
import { useListTemplates } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";

export default function AdminTemplates() {
  const { data: templates, isLoading } = useListTemplates();
  const list = Array.isArray(templates) ? templates : [];

  return (
    <Layout>
      <div className="mb-4"><h4 className="text-xl font-semibold">Templates</h4></div>
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
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Subject</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {list.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No templates found</td></tr>
                ) : list.map((t: any) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{t.id}</td>
                    <td className="px-4 py-3 font-medium">{t.name}</td>
                    <td className="px-4 py-3">{t.subject || "-"}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs ${t.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{t.active ? "Active" : "Inactive"}</span></td>
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
