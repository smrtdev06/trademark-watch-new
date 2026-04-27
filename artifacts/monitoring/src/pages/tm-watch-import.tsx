import { useState } from "react";
import { Layout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2 } from "lucide-react";

export default function TmWatchImport() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!file) { toast({ title: "Please select a file", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const baseUrl = import.meta.env.VITE_API_URL || "/api";
      const res = await fetch(`${baseUrl}/monitoring/import`, { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) throw new Error("Import failed");
      toast({ title: "Import successful" });
      setFile(null);
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="mb-4"><h4 className="text-xl font-semibold">Import Tm Watch</h4></div>
      <div className="bg-white rounded shadow-sm border p-6">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 mb-4 text-center">
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <h6 className="text-gray-600">Drop files here or click to upload.</h6>
          <input type="file" accept=".csv,.xlsx,.xls" className="text-sm mt-2" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </div>
        <div className="text-right mt-3">
          <button onClick={handleSubmit} disabled={submitting} className="bg-red-500 text-white px-6 py-2 rounded text-sm hover:bg-red-600 disabled:opacity-50 flex items-center gap-2 ml-auto">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Submit
          </button>
        </div>
      </div>
    </Layout>
  );
}
