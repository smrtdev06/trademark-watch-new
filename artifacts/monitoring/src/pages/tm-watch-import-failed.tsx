import { Layout } from "@/components/layout";
import { AlertTriangle } from "lucide-react";

export default function TmWatchImportFailed() {
  return (
    <Layout>
      <div className="mb-4">
        <h4 className="text-xl font-semibold">Failed Imports</h4>
      </div>
      <div className="bg-white rounded shadow-sm border p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <h5 className="font-semibold text-gray-700 mb-2">Failed Import Records</h5>
        <p className="text-sm text-gray-500">Keywords that could not be imported will appear here.</p>
        <div className="mt-6">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">#</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Keyword</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Reason</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No failed imports</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
