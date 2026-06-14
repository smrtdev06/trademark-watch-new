import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useListProducts } from "@workspace/api-client-react";
import { Loader2, Plus, X, Pencil, ToggleLeft, ToggleRight } from "lucide-react";

// ─── Constants ──────────────────────────────────────────────────────────────

const PAYMENT_METHODS = [
  { id: 15, label: "PayPal" },
  { id: 25, label: "Razorpay" },
];

const FUNCTIONS = [
  { id: 10,  label: "All Countries Monitoring" },
  { id: 20,  label: "Specific Countries Monitoring" },
  { id: 30,  label: "Domain Monitoring" },
  { id: 40,  label: "All Countries Visual Search" },
  { id: 50,  label: "Specific Countries Visual Search" },
  { id: 60,  label: "Assessment Search" },
  { id: 100, label: "Social Watch" },
  { id: 110, label: "Proprietor Search" },
];

const CURRENCIES = ["INR", "USD", "EUR", "GBP"];

// ─── API helpers ─────────────────────────────────────────────────────────────

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? "/api";
function getToken() { return localStorage.getItem("token"); }

async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...(opts.headers ?? {}),
    },
  });
  return res.json();
}

// ─── Form state ───────────────────────────────────────────────────────────────

type FormState = {
  name: string;
  description: string;
  price: string;
  currency: string;
  status: number;
  freeTrial: boolean;
  freeTrialDays: string;
  daysValidAfterPayment: string;
  allowedAmountOfKeywords: string;
  allowedAmountOfDomains: string;
  allowedAmountOfAssessments: string;
  allowedAmountOfImageUploads: string;
  tax: string;
  transactionFee: string;
  allowedPaymentMethods: number[];
  allowedFunctions: number[];
  groupId: string;
};

const emptyForm = (): FormState => ({
  name: "", description: "", price: "", currency: "INR", status: 1,
  freeTrial: false, freeTrialDays: "", daysValidAfterPayment: "365",
  allowedAmountOfKeywords: "", allowedAmountOfDomains: "",
  allowedAmountOfAssessments: "", allowedAmountOfImageUploads: "",
  tax: "", transactionFee: "",
  allowedPaymentMethods: [], allowedFunctions: [],
  groupId: "",
});

function productToForm(p: any): FormState {
  return {
    name:                     p.name ?? "",
    description:              p.description ?? "",
    price:                    p.price != null ? String(p.price) : "",
    currency:                 p.currency ?? "INR",
    status:                   p.status ?? 1,
    freeTrial:                !!(p.freeTrial ?? p.free_trial),
    freeTrialDays:            String(p.freeTrialDays ?? p.free_trial_days ?? ""),
    daysValidAfterPayment:    String(p.daysValidAfterPayment ?? p.days_valid_after_payment ?? "365"),
    allowedAmountOfKeywords:  String(p.allowedAmountOfKeywords ?? p.allowed_amount_of_keywords ?? ""),
    allowedAmountOfDomains:   String(p.allowedAmountOfDomains ?? p.allowed_amount_of_domains ?? ""),
    allowedAmountOfAssessments:  String(p.allowedAmountOfAssessments ?? p.allowed_amount_of_assessments ?? ""),
    allowedAmountOfImageUploads: String(p.allowedAmountOfImageUploads ?? p.allowed_amount_of_image_uploads ?? ""),
    tax:               p.tax != null ? String(p.tax) : "",
    transactionFee:    p.transactionFee != null ? String(p.transactionFee) : (p.transaction_fee != null ? String(p.transaction_fee) : ""),
    allowedPaymentMethods: p.allowedPaymentMethods ?? p.allowed_payment_methods ?? [],
    allowedFunctions:      p.allowedFunctions ?? p.allowed_functions ?? [],
    groupId: p.groupId != null ? String(p.groupId) : (p.group_id != null ? String(p.group_id) : ""),
  };
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">{children}</span>
      <div className="flex-1 border-t border-gray-100" />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminProducts() {
  const { data, isLoading, refetch } = useListProducts();
  const products: any[] = Array.isArray(data) ? data : (data as any)?.data ?? [];
  const [groups, setGroups] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    apiFetch("/groups")
      .then((rows) => {
        if (Array.isArray(rows)) setGroups(rows);
      })
      .catch(() => {});
  }, []);

  const [showModal, setShowModal]   = useState(false);
  const [editId, setEditId]         = useState<number | null>(null);
  const [form, setForm]             = useState<FormState>(emptyForm());
  const [saving, setSaving]         = useState(false);
  const [toggling, setToggling]     = useState<number | null>(null);
  const [error, setError]           = useState<string | null>(null);

  function openAdd() {
    setEditId(null);
    setForm(emptyForm());
    setError(null);
    setShowModal(true);
  }

  function openEdit(p: any) {
    setEditId(p.id);
    setForm(productToForm(p));
    setError(null);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setError(null);
  }

  function toggleArr(arr: number[], id: number): number[] {
    return arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];
  }

  function f(key: keyof FormState, value: any) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  // ── Quick status toggle directly from the table row ──
  async function handleStatusToggle(p: any) {
    setToggling(p.id);
    try {
      await apiFetch(`/products/${p.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: p.status === 1 ? 0 : 1 }),
      });
      refetch();
    } finally {
      setToggling(null);
    }
  }

  // ── Save (create or update) ──
  async function handleSave() {
    if (!form.name.trim() || !form.price) {
      setError("Name and price are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        name:                form.name.trim(),
        description:         form.description.trim() || null,
        price:               parseFloat(form.price),
        currency:            form.currency,
        status:              form.status,
        freeTrial:           form.freeTrial,
        freeTrialDays:       form.freeTrial ? parseInt(form.freeTrialDays || "0") : 0,
        daysValidAfterPayment: parseInt(form.daysValidAfterPayment || "365"),
        allowedAmountOfKeywords:     parseInt(form.allowedAmountOfKeywords || "0"),
        allowedAmountOfDomains:      parseInt(form.allowedAmountOfDomains || "0"),
        allowedAmountOfAssessments:  parseInt(form.allowedAmountOfAssessments || "0"),
        allowedAmountOfImageUploads: parseInt(form.allowedAmountOfImageUploads || "0"),
        tax:             parseFloat(form.tax || "0"),
        transactionFee:  parseFloat(form.transactionFee || "0"),
        allowedPaymentMethods: form.allowedPaymentMethods,
        allowedFunctions:      form.allowedFunctions,
        groupId: form.groupId ? parseInt(form.groupId, 10) : null,
      };

      const res = editId
        ? await apiFetch(`/products/${editId}`, { method: "PUT",  body: JSON.stringify(body) })
        : await apiFetch("/products",            { method: "POST", body: JSON.stringify(body) });

      if (res?.id) {
        closeModal();
        refetch();
      } else {
        setError(res?.message ?? "Failed to save product.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Layout>
      {/* ── Header ── */}
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-xl font-semibold">Products</h4>
        <button onClick={openAdd}
          className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      {/* ── Product table ── */}
      <div className="bg-white rounded shadow-sm border">
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 w-10">#</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Price</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Tax / Fee</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Free Trial</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Valid (days)</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Available</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                      No products yet.{" "}
                      <button className="text-blue-600 hover:underline" onClick={openAdd}>
                        Add the first product →
                      </button>
                    </td>
                  </tr>
                ) : products.map((p: any) => {
                  const isActive = p.status === 1;
                  const hasTrial = p.freeTrial ?? p.free_trial;
                  const trialDays = p.freeTrialDays ?? p.free_trial_days ?? 0;
                  const validDays = p.daysValidAfterPayment ?? p.days_valid_after_payment ?? 365;
                  const taxPct = p.tax ?? 0;
                  const feePct = p.transactionFee ?? p.transaction_fee ?? 0;

                  return (
                    <tr key={p.id} className="hover:bg-gray-50 group">
                      <td className="px-4 py-3 text-gray-400">{p.id}</td>

                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{p.name}</div>
                        {p.description && (
                          <div className="text-xs text-gray-400 truncate max-w-[200px]">{p.description}</div>
                        )}
                      </td>

                      {/* Pricing */}
                      <td className="px-4 py-3">
                        <span className="font-medium">{p.currency ?? "INR"} {Number(p.price ?? 0).toFixed(2)}</span>
                      </td>

                      {/* Tax / Fee */}
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {taxPct > 0 || feePct > 0
                          ? <>{taxPct > 0 ? <span>{taxPct}% tax</span> : null}{taxPct > 0 && feePct > 0 ? " · " : null}{feePct > 0 ? <span>{feePct}% fee</span> : null}</>
                          : <span className="text-gray-300">—</span>}
                      </td>

                      {/* Free trial */}
                      <td className="px-4 py-3 text-center">
                        {hasTrial
                          ? <span className="inline-block bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">{trialDays}d free</span>
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>

                      {/* Valid days */}
                      <td className="px-4 py-3 text-center text-gray-600">{validDays}</td>

                      {/* Available toggle */}
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleStatusToggle(p)}
                          disabled={toggling === p.id}
                          title={isActive ? "Click to deactivate" : "Click to activate"}
                          className="inline-flex items-center gap-1 text-xs disabled:opacity-50"
                        >
                          {toggling === p.id
                            ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                            : isActive
                              ? <ToggleRight className="w-6 h-6 text-green-500" />
                              : <ToggleLeft className="w-6 h-6 text-gray-400" />}
                          <span className={isActive ? "text-green-600" : "text-gray-400"}>
                            {isActive ? "Active" : "Inactive"}
                          </span>
                        </button>
                      </td>

                      {/* Edit */}
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => openEdit(p)}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mx-auto">
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add / Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
              <h3 className="text-base font-semibold">{editId ? "Edit Product" : "Add Product"}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto px-6 py-5 space-y-5 flex-1">

              {/* ── Basic info ── */}
              <SectionLabel>Basic Info</SectionLabel>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Product Name *</label>
                  <input value={form.name} onChange={e => f("name", e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="e.g. Basic Plan" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                  <input value={form.description} onChange={e => f("description", e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="Optional short description" />
                </div>
              </div>

              {/* ── Pricing ── */}
              <SectionLabel>Pricing</SectionLabel>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Price *</label>
                  <input type="number" min="0" step="0.01" value={form.price}
                    onChange={e => f("price", e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Currency</label>
                  <select value={form.currency} onChange={e => f("currency", e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tax (%)</label>
                  <input type="number" min="0" step="0.1" value={form.tax}
                    onChange={e => f("tax", e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Transaction Fee (%)</label>
                  <input type="number" min="0" step="0.1" value={form.transactionFee}
                    onChange={e => f("transactionFee", e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="0" />
                </div>
              </div>

              {/* ── Free trial & availability ── */}
              <SectionLabel>Availability &amp; Free Trial</SectionLabel>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Group after payment
                  </label>
                  <select
                    value={form.groupId}
                    onChange={(e) => f("groupId", e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="">No group change</option>
                    {groups.map((g) => (
                      <option key={g.id} value={String(g.id)}>{g.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    User is moved to this group after successful payment.
                  </p>
                </div>
                {/* Availability toggle */}
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-medium text-gray-600 mb-2">Available to users</label>
                  <div className="flex gap-3">
                    {[{ val: 1, label: "Active" }, { val: 0, label: "Inactive" }].map(opt => (
                      <label key={opt.val}
                        className={`flex items-center gap-1.5 cursor-pointer text-sm px-3 py-1.5 rounded border transition-colors ${
                          form.status === opt.val
                            ? opt.val === 1 ? "border-green-500 bg-green-50 text-green-700" : "border-red-300 bg-red-50 text-red-600"
                            : "border-gray-200 text-gray-500 hover:bg-gray-50"
                        }`}>
                        <input type="radio" className="sr-only" checked={form.status === opt.val}
                          onChange={() => f("status", opt.val)} />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Valid after payment */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Subscription valid (days)
                  </label>
                  <input type="number" min="1" value={form.daysValidAfterPayment}
                    onChange={e => f("daysValidAfterPayment", e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="365" />
                </div>

                {/* Free trial */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Free trial</label>
                  <div className="flex items-center gap-3">
                    <label className={`flex items-center gap-1.5 cursor-pointer text-sm px-3 py-1.5 rounded border transition-colors ${
                      form.freeTrial ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"
                    }`}>
                      <input type="checkbox" className="sr-only" checked={form.freeTrial}
                        onChange={e => {
                          f("freeTrial", e.target.checked);
                          if (e.target.checked && !form.freeTrialDays) f("freeTrialDays", "14");
                        }} />
                      {form.freeTrial ? "Enabled" : "Disabled"}
                    </label>
                    {form.freeTrial && (
                      <div className="flex items-center gap-1">
                        <input type="number" min="1" value={form.freeTrialDays}
                          onChange={e => f("freeTrialDays", e.target.value)}
                          className="w-16 border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                        <span className="text-xs text-gray-500">days</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Feature quotas ── */}
              <SectionLabel>Feature Quotas</SectionLabel>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { key: "allowedAmountOfKeywords",     label: "Keywords" },
                  { key: "allowedAmountOfDomains",      label: "Domains" },
                  { key: "allowedAmountOfAssessments",  label: "Assessments" },
                  { key: "allowedAmountOfImageUploads", label: "Image Uploads" },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-500 mb-1">{label}</label>
                    <input type="number" min="0" value={(form as any)[key]}
                      onChange={e => f(key as keyof FormState, e.target.value)}
                      className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="0" />
                  </div>
                ))}
              </div>

              {/* ── Payment methods ── */}
              <SectionLabel>Payment Methods</SectionLabel>
              <div className="flex gap-3">
                {PAYMENT_METHODS.map(m => (
                  <label key={m.id}
                    className={`flex items-center gap-2 cursor-pointer text-sm px-4 py-2 rounded border transition-colors ${
                      form.allowedPaymentMethods.includes(m.id)
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}>
                    <input type="checkbox" className="sr-only"
                      checked={form.allowedPaymentMethods.includes(m.id)}
                      onChange={() => f("allowedPaymentMethods", toggleArr(form.allowedPaymentMethods, m.id))} />
                    {m.label}
                  </label>
                ))}
              </div>

              {/* ── Allowed features ── */}
              <SectionLabel>Allowed Features</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {FUNCTIONS.map(fn => (
                  <label key={fn.id}
                    className={`flex items-center gap-2 cursor-pointer text-sm px-3 py-2 rounded border transition-colors ${
                      form.allowedFunctions.includes(fn.id)
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-100 text-gray-600 hover:bg-gray-50"
                    }`}>
                    <input type="checkbox" className="sr-only"
                      checked={form.allowedFunctions.includes(fn.id)}
                      onChange={() => f("allowedFunctions", toggleArr(form.allowedFunctions, fn.id))} />
                    <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                      form.allowedFunctions.includes(fn.id) ? "bg-blue-500 border-blue-500" : "border-gray-300"
                    }`}>
                      {form.allowedFunctions.includes(fn.id) && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </span>
                    {fn.label}
                  </label>
                ))}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2 text-sm">{error}</div>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t flex justify-end gap-3 shrink-0 bg-gray-50 rounded-b-lg">
              <button onClick={closeModal}
                className="px-4 py-2 border rounded text-sm hover:bg-gray-100 text-gray-600">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 bg-blue-600 text-white px-6 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editId ? "Save Changes" : "Create Product"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
