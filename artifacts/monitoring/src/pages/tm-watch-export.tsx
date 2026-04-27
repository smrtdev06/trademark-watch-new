import { Layout } from "@/components/layout";
import { useExportMonitoringResults } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Download, Loader2 } from "lucide-react";

export default function TmWatchExport() {
  const { toast } = useToast();
  const mutation = useExportMonitoringResults({
    mutation: {
      onSuccess: (data: any) => {
        toast({ title: "Export generated", description: data?.file || "File ready for download" });
      },
      onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    },
  });

  return (
    <Layout>
      <div className="mb-4"><h4 className="text-xl font-semibold">Export TM Watch</h4></div>
      <div className="bg-white rounded shadow-sm border p-6 max-w-2xl">
        <div className="text-center py-8">
          <Download className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h5 className="font-semibold text-gray-700 mb-2">Export Monitoring Results</h5>
          <p className="text-sm text-gray-500 mb-6">Download all your monitoring results as an Excel file</p>
          <button
            onClick={() => mutation.mutate({ data: {} } as any)}
            disabled={mutation.isPending}
            className="bg-blue-600 text-white px-6 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export to Excel
          </button>
        </div>
      </div>
    </Layout>
  );
}
