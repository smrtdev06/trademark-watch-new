/**
 * Mirrors PHP livewire/settings/smtp.blade.php
 * SMTP settings stored in the global `settings` table (not per-user).
 * Fields: mail_host, mail_port, mail_encryption, mail_user_name, mail_password,
 *         from_address, from_name
 */
import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff } from "lucide-react";

interface SmtpForm {
  mail_host: string;
  mail_port: string;
  mail_encryption: string;
  mail_user_name: string;
  mail_password: string;
  from_address: string;
  from_name: string;
}

const DEFAULTS: SmtpForm = {
  mail_host: "",
  mail_port: "587",
  mail_encryption: "tls",
  mail_user_name: "",
  mail_password: "",
  from_address: "",
  from_name: "",
};

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        autoComplete="new-password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="border rounded px-3 py-2 text-sm w-full pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-gray-600"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default function SettingsEmail() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SmtpForm>(DEFAULTS);

  const baseUrl = import.meta.env.VITE_API_URL || "/api";
  const token = () => localStorage.getItem("token");

  useEffect(() => {
    fetch(`${baseUrl}/settings/smtp`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then((r) => r.json())
      .then((data: Partial<SmtpForm>) => {
        setForm((prev) => ({ ...prev, ...data }));
      })
      .catch(() => { /* use defaults */ })
      .finally(() => setLoading(false));
  }, []);

  const setField = (key: keyof SmtpForm, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const resp = await fetch(`${baseUrl}/settings/smtp`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify(form),
      });
      if (resp.ok) {
        toast({ title: "SMTP settings saved" });
      } else {
        toast({ title: "Failed to save settings", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-4"><h4 className="text-xl font-semibold">Email Settings</h4></div>

      <div className="bg-white rounded shadow-sm border">
        {/* Tab header — mirrors PHP settings.blade.php tab layout */}
        <div className="border-b px-6 pt-4">
          <div className="flex gap-4">
            <span className="text-sm font-medium border-b-2 border-blue-600 pb-3 text-blue-600">SMTP Settings</span>
          </div>
        </div>

        <div className="p-6 max-w-lg space-y-5">
          {/* Host */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Host</label>
            <input
              type="text"
              value={form.mail_host}
              onChange={(e) => setField("mail_host", e.target.value)}
              placeholder="smtp.example.com"
              className="border rounded px-3 py-2 text-sm w-full"
            />
          </div>

          {/* User Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">User Name</label>
            <input
              type="text"
              autoComplete="off"
              value={form.mail_user_name}
              onChange={(e) => setField("mail_user_name", e.target.value)}
              placeholder="Mail User Name"
              className="border rounded px-3 py-2 text-sm w-full"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <PasswordInput
              value={form.mail_password}
              onChange={(v) => setField("mail_password", v)}
              placeholder="Mail Password"
            />
          </div>

          {/* Port */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
            <input
              type="text"
              value={form.mail_port}
              onChange={(e) => setField("mail_port", e.target.value)}
              placeholder="587"
              className="border rounded px-3 py-2 text-sm w-full"
            />
          </div>

          {/* Encryption */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Encryption</label>
            <select
              value={form.mail_encryption}
              onChange={(e) => setField("mail_encryption", e.target.value)}
              className="border rounded px-3 py-2 text-sm w-full"
            >
              <option value="tls">TLS</option>
              <option value="ssl">SSL</option>
              <option value="none">None</option>
            </select>
          </div>

          {/* From Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Address</label>
            <input
              type="email"
              value={form.from_address}
              onChange={(e) => setField("from_address", e.target.value)}
              placeholder="noreply@example.com"
              className="border rounded px-3 py-2 text-sm w-full"
            />
          </div>

          {/* From Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Name</label>
            <input
              type="text"
              value={form.from_name}
              onChange={(e) => setField("from_name", e.target.value)}
              placeholder="TM Monitor"
              className="border rounded px-3 py-2 text-sm w-full"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-green-600 text-white px-5 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
