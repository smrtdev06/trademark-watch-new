import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function AddClientModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", email1: "", email2: "", email3: "",
    phone1: "", phone2: "", phone3: "",
    address1: "", address2: "", address3: "",
    pincode: "", city: "", clientType: "",
    country: "", preferredContactType: "", allowControlPanel: false,
  });

  const fields = [
    { key: "name", label: "Name / Company Name" },
    { key: "email1", label: "Email 1" },
    { key: "email2", label: "Email 2" },
    { key: "email3", label: "Email 3" },
    { key: "phone1", label: "Phone 1" },
    { key: "phone2", label: "Phone 2" },
    { key: "phone3", label: "Phone 3" },
    { key: "address1", label: "Address 1" },
    { key: "address2", label: "Address 2" },
    { key: "address3", label: "Address 3" },
    { key: "pincode", label: "Pincode" },
    { key: "city", label: "City" },
    { key: "clientType", label: "Attorney/Client" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const baseUrl = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;
      const resp = await fetch(`${baseUrl}/clients`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (resp.ok) {
        toast({ title: "Client added" });
        onAdded();
        onClose();
      } else {
        toast({ title: "Failed to add client", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to add client", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h5 className="text-lg font-semibold">Add Client</h5>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 space-y-3 overflow-y-auto flex-1">
            {fields.map((f) => (
              <input
                key={f.key}
                type="text"
                placeholder={f.label}
                className="w-full border rounded px-3 py-2 text-sm"
                value={(form as any)[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              />
            ))}
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
            >
              <option value="">- Select Country -</option>
              <option value="IN">India</option>
              <option value="US">United States</option>
              <option value="GB">United Kingdom</option>
              <option value="AU">Australia</option>
              <option value="CA">Canada</option>
            </select>
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={form.preferredContactType}
              onChange={(e) => setForm({ ...form, preferredContactType: e.target.value })}
            >
              <option value="">Preffered Contact Type</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="both">Both</option>
            </select>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.allowControlPanel}
                onChange={(e) => setForm({ ...form, allowControlPanel: e.target.checked })}
                className="rounded"
              />
              Allow Control Panel
            </label>
          </div>
          <div className="flex items-center justify-end gap-2 p-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded text-sm hover:bg-gray-50">Close</button>
            <button type="submit" disabled={saving} className="bg-green-500 text-white px-4 py-2 rounded text-sm hover:bg-green-600 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AddClientButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ml-2 inline-flex items-center justify-center w-5 h-5 bg-green-500 text-white rounded text-xs font-bold hover:bg-green-600"
    >
      +
    </button>
  );
}
