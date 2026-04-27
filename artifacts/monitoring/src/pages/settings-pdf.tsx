import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function SettingsPdf() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    pdfCompanyName: "", pdfCompanyAddress: "", pdfLogoUrl: "",
  });

  useEffect(() => {
    const token = localStorage.getItem("token");
    const baseUrl = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;
    fetch(`${baseUrl}/settings/user-settings`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((settings: any[]) => {
        const vals: Record<string, string> = {};
        if (Array.isArray(settings)) settings.forEach((s: any) => { vals[s.name] = s.value || ""; });
        setForm(prev => ({
          pdfCompanyName: vals.pdfCompanyName || prev.pdfCompanyName,
          pdfCompanyAddress: vals.pdfCompanyAddress || prev.pdfCompanyAddress,
          pdfLogoUrl: vals.pdfLogoUrl || prev.pdfLogoUrl,
        }));
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const baseUrl = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;
      const items = Object.entries(form).map(([name, value]) => ({ name, value }));
      const resp = await fetch(`${baseUrl}/settings/user-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(items),
      });
      if (resp.ok) toast({ title: "PDF settings saved" });
      else toast({ title: "Failed to save", variant: "destructive" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const setField = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  if (loading) return <Layout><div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div></Layout>;

  return (
    <Layout>
      <div className="mb-4"><h4 className="text-xl font-semibold">PDF Settings</h4></div>
      <div className="bg-white rounded shadow-sm border p-6">
        <p className="text-sm text-gray-500 mb-4">Configure PDF export header and footer settings.</p>
        <div className="space-y-4 max-w-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name (PDF Header)</label>
            <input type="text" className="border rounded px-3 py-2 text-sm w-full" placeholder="Your Company Name" value={form.pdfCompanyName} onChange={(e) => setField("pdfCompanyName", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Address</label>
            <textarea className="border rounded px-3 py-2 text-sm w-full" rows={3} placeholder="Company address for PDF reports" value={form.pdfCompanyAddress} onChange={(e) => setField("pdfCompanyAddress", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
            <input type="text" className="border rounded px-3 py-2 text-sm w-full" placeholder="https://..." value={form.pdfLogoUrl} onChange={(e) => setField("pdfLogoUrl", e.target.value)} />
          </div>
          <button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Saving..." : "Save PDF Settings"}
          </button>
        </div>
      </div>
    </Layout>
  );
}
