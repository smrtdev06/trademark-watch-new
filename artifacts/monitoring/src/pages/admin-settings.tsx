import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useGetSettings, useUpdateSettings } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, CreditCard, Zap } from "lucide-react";

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? "/api";

// ---------------------------------------------------------------------------
// Payment gateway config
// ---------------------------------------------------------------------------
interface PaymentGatewaySettings {
  razorpay_key: string;
  razorpay_secret: string;
  paypal_mode: string;
  paypal_sandbox_client_id: string;
  paypal_sandbox_client_secret: string;
  paypal_live_client_id: string;
  paypal_live_client_secret: string;
}

const PAYPAL_MODES = ["sandbox", "live"];

function PasswordField({
  label, name, value, onChange,
}: { label: string; name: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          className="w-full border rounded px-3 py-2 text-sm pr-10"
          value={value}
          placeholder="••••••••"
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-gray-600"
          onClick={() => setShow((s) => !s)}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function TextField({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        className="w-full border rounded px-3 py-2 text-sm"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SectionCard({ icon, title, subtitle, children }: {
  icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="flex items-start gap-3 p-5 border-b">
        <div className="p-2 bg-blue-50 rounded-md text-blue-600">{icon}</div>
        <div>
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function AdminSettings() {
  const { toast } = useToast();

  // ── General settings ──────────────────────────────────────────────────────
  const { data: settings, isLoading, refetch } = useGetSettings();
  const [generalValues, setGeneralValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settings && Array.isArray(settings)) {
      const vals: Record<string, string> = {};
      settings.forEach((s: any) => { vals[s.name] = s.value || ""; });
      setGeneralValues(vals);
    }
  }, [settings]);

  const generalMutation = useUpdateSettings({
    mutation: {
      onSuccess: () => { toast({ title: "Settings saved" }); refetch(); },
      onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    },
  });

  const handleSaveGeneral = () => {
    const items = Object.entries(generalValues).map(([name, value]) => ({ name, value }));
    generalMutation.mutate({ data: items as any });
  };

  // ── Payment gateway settings ───────────────────────────────────────────────
  const emptyGw: PaymentGatewaySettings = {
    razorpay_key: "", razorpay_secret: "",
    paypal_mode: "sandbox",
    paypal_sandbox_client_id: "", paypal_sandbox_client_secret: "",
    paypal_live_client_id: "", paypal_live_client_secret: "",
  };
  const [gw, setGw] = useState<PaymentGatewaySettings>(emptyGw);
  const [gwLoading, setGwLoading] = useState(true);
  const [gwSaving, setGwSaving] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/settings/payment-gateways`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setGw({ ...emptyGw, ...data }))
      .catch(() => {})
      .finally(() => setGwLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setGwField = (field: keyof PaymentGatewaySettings) => (value: string) =>
    setGw((prev) => ({ ...prev, [field]: value }));

  const handleSaveGateway = async () => {
    setGwSaving(true);
    try {
      const r = await fetch(`${API_BASE}/settings/payment-gateways`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(gw),
      });
      if (!r.ok) throw new Error(await r.text());
      toast({ title: "Payment gateway settings saved" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGwSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="mb-6">
        <h4 className="text-xl font-semibold">Settings</h4>
        <p className="text-sm text-gray-500 mt-1">Manage application and payment gateway configuration</p>
      </div>

      <div className="space-y-6">
        {/* ── Payment Gateways ────────────────────────────────────────────── */}
        <SectionCard
          icon={<CreditCard className="w-5 h-5" />}
          title="Payment Gateways"
          subtitle="Configure Razorpay and PayPal credentials. Values saved here override .env settings."
        >
          {gwLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : (
            <>
              {/* Razorpay */}
              <div className="pb-4 border-b">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-blue-500" />
                  <span className="font-medium text-sm text-gray-800">Razorpay</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TextField
                    label="Key ID"
                    value={gw.razorpay_key}
                    onChange={setGwField("razorpay_key")}
                    placeholder="rzp_live_..."
                  />
                  <PasswordField
                    label="Key Secret"
                    name="razorpay_secret"
                    value={gw.razorpay_secret}
                    onChange={setGwField("razorpay_secret")}
                  />
                </div>
              </div>

              {/* PayPal */}
              <div className="pt-2">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="w-4 h-4 text-indigo-500" />
                  <span className="font-medium text-sm text-gray-800">PayPal</span>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
                  <div className="flex gap-3">
                    {PAYPAL_MODES.map((m) => (
                      <label key={m} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="paypal_mode"
                          value={m}
                          checked={gw.paypal_mode === m}
                          onChange={() => setGwField("paypal_mode")(m)}
                          className="accent-blue-600"
                        />
                        <span className="text-sm capitalize">{m}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-5">
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Sandbox Credentials</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <TextField
                        label="Sandbox Client ID"
                        value={gw.paypal_sandbox_client_id}
                        onChange={setGwField("paypal_sandbox_client_id")}
                        placeholder="AXx..."
                      />
                      <PasswordField
                        label="Sandbox Client Secret"
                        name="paypal_sandbox_client_secret"
                        value={gw.paypal_sandbox_client_secret}
                        onChange={setGwField("paypal_sandbox_client_secret")}
                      />
                    </div>
                  </div>

                  <div className="border rounded-lg p-4 bg-gray-50">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Live Credentials</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <TextField
                        label="Live Client ID"
                        value={gw.paypal_live_client_id}
                        onChange={setGwField("paypal_live_client_id")}
                        placeholder="AXx..."
                      />
                      <PasswordField
                        label="Live Client Secret"
                        name="paypal_live_client_secret"
                        value={gw.paypal_live_client_secret}
                        onChange={setGwField("paypal_live_client_secret")}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleSaveGateway}
                  disabled={gwSaving}
                  className="bg-blue-600 text-white px-5 py-2 rounded text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {gwSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {gwSaving ? "Saving…" : "Save Gateway Settings"}
                </button>
              </div>
            </>
          )}
        </SectionCard>

        {/* ── General Settings ─────────────────────────────────────────────── */}
        {!isLoading && Object.keys(generalValues).length > 0 && (
          <SectionCard
            icon={<Zap className="w-5 h-5" />}
            title="General Settings"
            subtitle="Application-wide configuration values"
          >
            <div className="space-y-3">
              {Object.entries(generalValues).map(([name, value]) => (
                <div key={name} className="grid grid-cols-3 gap-4 items-center">
                  <label className="text-sm font-medium text-gray-700 capitalize">{name.replace(/_/g, " ")}</label>
                  <input
                    type="text"
                    className="col-span-2 border rounded px-3 py-2 text-sm"
                    value={value}
                    onChange={(e) => setGeneralValues((prev) => ({ ...prev, [name]: e.target.value }))}
                  />
                </div>
              ))}
              <button
                onClick={handleSaveGeneral}
                disabled={generalMutation.isPending}
                className="bg-blue-600 text-white px-5 py-2 rounded text-sm font-medium mt-2 disabled:opacity-50"
              >
                {generalMutation.isPending ? "Saving…" : "Save Settings"}
              </button>
            </div>
          </SectionCard>
        )}
      </div>
    </Layout>
  );
}
