import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function TmWatchSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    monitoringFrequency: "daily", similarityThreshold: "70", maxResultsPerKeyword: "100",
  });

  useEffect(() => {
    const token = localStorage.getItem("token");
    const baseUrl = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;
    fetch(`${baseUrl}/settings`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((settings: any[]) => {
        const vals: Record<string, string> = {};
        if (Array.isArray(settings)) settings.forEach((s: any) => { vals[s.name] = s.value || ""; });
        setForm(prev => ({
          monitoringFrequency: vals.monitoringFrequency || prev.monitoringFrequency,
          similarityThreshold: vals.similarityThreshold || prev.similarityThreshold,
          maxResultsPerKeyword: vals.maxResultsPerKeyword || prev.maxResultsPerKeyword,
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
      const resp = await fetch(`${baseUrl}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(items),
      });
      if (resp.ok) toast({ title: "Settings saved" });
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
      <div className="mb-4"><h4 className="text-xl font-semibold">Monitoring Settings</h4></div>
      <div className="bg-white rounded shadow-sm border p-6">
        <div className="space-y-4 max-w-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Monitoring Frequency</label>
            <select className="border rounded px-3 py-2 text-sm w-full" value={form.monitoringFrequency} onChange={(e) => setField("monitoringFrequency", e.target.value)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Similarity Threshold (%)</label>
            <input type="number" className="border rounded px-3 py-2 text-sm w-full" value={form.similarityThreshold} onChange={(e) => setField("similarityThreshold", e.target.value)} min={0} max={100} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Results Per Keyword</label>
            <input type="number" className="border rounded px-3 py-2 text-sm w-full" value={form.maxResultsPerKeyword} onChange={(e) => setField("maxResultsPerKeyword", e.target.value)} min={1} />
          </div>
          <button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </Layout>
  );
}
