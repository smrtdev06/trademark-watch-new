import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function SettingsEmail() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    smtpHost: "", smtpPort: "587", encryption: "tls", fromEmail: "", fromName: "",
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
          smtpHost: vals.smtpHost || prev.smtpHost,
          smtpPort: vals.smtpPort || prev.smtpPort,
          encryption: vals.encryption || prev.encryption,
          fromEmail: vals.fromEmail || prev.fromEmail,
          fromName: vals.fromName || prev.fromName,
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
      if (resp.ok) toast({ title: "Email settings saved" });
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
      <div className="mb-4"><h4 className="text-xl font-semibold">Email Settings</h4></div>
      <div className="bg-white rounded shadow-sm border p-6">
        <p className="text-sm text-gray-500 mb-4">Configure email notification settings.</p>
        <div className="space-y-4 max-w-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
            <input type="text" className="border rounded px-3 py-2 text-sm w-full" placeholder="smtp.example.com" value={form.smtpHost} onChange={(e) => setField("smtpHost", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Port</label>
              <input type="number" className="border rounded px-3 py-2 text-sm w-full" value={form.smtpPort} onChange={(e) => setField("smtpPort", e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Encryption</label>
              <select className="border rounded px-3 py-2 text-sm w-full" value={form.encryption} onChange={(e) => setField("encryption", e.target.value)}>
                <option value="tls">TLS</option>
                <option value="ssl">SSL</option>
                <option value="none">None</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Email</label>
            <input type="email" className="border rounded px-3 py-2 text-sm w-full" placeholder="noreply@example.com" value={form.fromEmail} onChange={(e) => setField("fromEmail", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Name</label>
            <input type="text" className="border rounded px-3 py-2 text-sm w-full" placeholder="TMPilot WTW" value={form.fromName} onChange={(e) => setField("fromName", e.target.value)} />
          </div>
          <button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Saving..." : "Save Email Settings"}
          </button>
        </div>
      </div>
    </Layout>
  );
}
