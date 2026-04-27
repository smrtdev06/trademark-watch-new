import { useState } from "react";
import { Layout } from "@/components/layout";
import { useListClients } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2 } from "lucide-react";
import { AddClientModal, AddClientButton } from "@/components/add-client-modal";

export default function LogoAdd() {
  const { toast } = useToast();
  const { data: clientsData, refetch: refetchClients } = useListClients();
  const clients = Array.isArray(clientsData) ? clientsData : (clientsData as any)?.data ?? [];
  const [clientId, setClientId] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);

  const handleSubmit = async () => {
    if (!files || files.length === 0) { toast({ title: "Please select at least one file", variant: "destructive" }); return; }
    if (files.length > 10) { toast({ title: "Maximum 10 files allowed", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((f) => formData.append("file", f));
      if (clientId) formData.append("clientId", clientId);
      const baseUrl = import.meta.env.VITE_API_URL || "/api";
      const res = await fetch(`${baseUrl}/logo`, { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) throw new Error("Upload failed");
      toast({ title: "Logos uploaded successfully" });
      setFiles(null);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="mb-4"><h4 className="text-xl font-semibold">Add Logo Watch</h4></div>
      <div className="bg-white rounded shadow-sm border p-6">
        <div className="flex justify-end mb-3 items-center gap-1">
          <select className="border rounded px-3 py-2 text-sm min-w-[180px]" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value=""> - Select Client - </option>
            {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <AddClientButton onClick={() => setShowAddClient(true)} />
        </div>
        <h5 className="font-semibold text-gray-700 mb-1">Add Logo(s) Here</h5>
        <p className="text-sm text-gray-500 mb-4">You can add max <b>10</b> files.</p>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 mb-4 text-center">
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <h6 className="text-gray-600">Drop files here or click to upload.</h6>
          <input type="file" accept="image/*" multiple className="text-sm mt-2" onChange={(e) => setFiles(e.target.files)} />
        </div>
        <div className="text-right mt-3">
          <button onClick={handleSubmit} disabled={submitting} className="bg-red-500 text-white px-6 py-2 rounded text-sm hover:bg-red-600 disabled:opacity-50 flex items-center gap-2 ml-auto">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Submit
          </button>
        </div>
      </div>
      {showAddClient && (
        <AddClientModal onClose={() => setShowAddClient(false)} onAdded={() => refetchClients()} />
      )}
    </Layout>
  );
}
