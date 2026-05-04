/**
 * Mirrors PHP livewire/settings/smtp.blade.php
 * SMTP settings stored in the global `settings` table (not per-user).
 * Fields: mail_host, mail_port, mail_encryption, mail_user_name, mail_password,
 *         from_address, from_name
 */
import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, Send } from "lucide-react";

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

function PasswordInput({
  value,
  onChange,
  placeholder,
  isSet,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  isSet?: boolean;
}) {
  const [show, setShow] = useState(false);
  const masked = value === "••••••••";

  return (
    <div className="space-y-1">
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          autoComplete="new-password"
          value={masked ? "" : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={masked ? "Leave blank to keep current password" : (placeholder ?? "")}
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
      {masked && (
        <p className="text-xs text-green-600">Password is set. Enter a new value to change it.</p>
      )}
    </div>
  );
}

export default function SettingsEmail() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testTo, setTestTo] = useState("");
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
      .catch(() => { /* keep defaults on error */ })
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
        // Re-fetch to refresh masked password state
        const fresh = await fetch(`${baseUrl}/settings/smtp`, { headers: { Authorization: `Bearer ${token()}` } });
        if (fresh.ok) setForm((prev) => ({ ...prev, ...(await fresh.json()) }));
      } else {
        toast({ title: "Failed to save settings", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTestMail = async () => {
    setTesting(true);
    try {
      const body: Record<string, string> = {};
      if (testTo.trim()) body.to = testTo.trim();

      const resp = await fetch(`${baseUrl}/settings/smtp/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (resp.ok && data.status === 1) {
        toast({ title: "Test email sent!", description: data.message });
      } else {
        toast({ title: "Send failed", description: data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setTesting(false);
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
              placeholder="user@example.com"
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

        {/* Send Test Mail section */}
        <div className="border-t mx-6 mb-6 pt-5">
          <h5 className="text-sm font-semibold text-gray-700 mb-3">Send Test Email</h5>
          <p className="text-xs text-gray-500 mb-3">
            Verifies your SMTP connection and sends a test message. Save your settings first.
          </p>
          <div className="flex gap-2 items-center">
            <input
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="Recipient email (defaults to your account email)"
              className="border rounded px-3 py-2 text-sm flex-1"
            />
            <button
              onClick={handleTestMail}
              disabled={testing}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {testing ? "Sending…" : "Send Test Mail"}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
