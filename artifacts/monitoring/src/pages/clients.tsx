import { Layout } from "@/components/layout";
import { useState } from "react";
import { Plus, Search, Loader2, Trash2, Pencil, X } from "lucide-react";
import { useListClients, useCreateClient, useDeleteClient } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

const EMPTY_FORM = {
  name: "", email1: "", email2: "", email3: "",
  phone1: "", phone2: "", phone3: "",
  address1: "", address2: "", address3: "",
  pincode: "", city: "", clientType: "", country: "",
  preferredContactType: "", allowControlPanel: false,
};

function ClientFormFields({ form, setField }: { form: typeof EMPTY_FORM; setField: (key: string, value: any) => void }) {
  return (
    <div className="p-4 space-y-3">
      <input type="text" className="w-full border rounded px-3 py-2 text-sm" placeholder="Name / Company Name" value={form.name} onChange={(e) => setField("name", e.target.value)} required />
      <input type="text" className="w-full border rounded px-3 py-2 text-sm" placeholder="Email 1" value={form.email1} onChange={(e) => setField("email1", e.target.value)} />
      <input type="text" className="w-full border rounded px-3 py-2 text-sm" placeholder="Email 2" value={form.email2} onChange={(e) => setField("email2", e.target.value)} />
      <input type="text" className="w-full border rounded px-3 py-2 text-sm" placeholder="Email 3" value={form.email3} onChange={(e) => setField("email3", e.target.value)} />
      <input type="text" className="w-full border rounded px-3 py-2 text-sm" placeholder="Phone 1" value={form.phone1} onChange={(e) => setField("phone1", e.target.value)} />
      <input type="text" className="w-full border rounded px-3 py-2 text-sm" placeholder="Phone 2" value={form.phone2} onChange={(e) => setField("phone2", e.target.value)} />
      <input type="text" className="w-full border rounded px-3 py-2 text-sm" placeholder="Phone 3" value={form.phone3} onChange={(e) => setField("phone3", e.target.value)} />
      <input type="text" className="w-full border rounded px-3 py-2 text-sm" placeholder="Address 1" value={form.address1} onChange={(e) => setField("address1", e.target.value)} />
      <input type="text" className="w-full border rounded px-3 py-2 text-sm" placeholder="Address 2" value={form.address2} onChange={(e) => setField("address2", e.target.value)} />
      <input type="text" className="w-full border rounded px-3 py-2 text-sm" placeholder="Address 3" value={form.address3} onChange={(e) => setField("address3", e.target.value)} />
      <input type="text" className="w-full border rounded px-3 py-2 text-sm" placeholder="Pincode" value={form.pincode} onChange={(e) => setField("pincode", e.target.value)} />
      <input type="text" className="w-full border rounded px-3 py-2 text-sm" placeholder="City" value={form.city} onChange={(e) => setField("city", e.target.value)} />
      <input type="text" className="w-full border rounded px-3 py-2 text-sm" placeholder="Attorney/Client" value={form.clientType} onChange={(e) => setField("clientType", e.target.value)} />
      <select className="w-full border rounded px-3 py-2 text-sm" value={form.country} onChange={(e) => setField("country", e.target.value)}>
        <option value="">- Select Country -</option>
        <option value="IN">India</option>
        <option value="US">United States</option>
        <option value="GB">United Kingdom</option>
        <option value="AU">Australia</option>
        <option value="CA">Canada</option>
        <option value="DE">Germany</option>
        <option value="FR">France</option>
        <option value="JP">Japan</option>
        <option value="CN">China</option>
        <option value="SG">Singapore</option>
        <option value="AE">United Arab Emirates</option>
        <option value="BR">Brazil</option>
      </select>
      <select className="w-full border rounded px-3 py-2 text-sm" value={form.preferredContactType} onChange={(e) => setField("preferredContactType", e.target.value)}>
        <option value="">Preffered Contact Type</option>
        <option value="email">Email</option>
        <option value="sms">SMS</option>
        <option value="both">Both</option>
      </select>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="allowPanel" checked={form.allowControlPanel} onChange={(e) => setField("allowControlPanel", e.target.checked)} className="rounded" />
        <label htmlFor="allowPanel" className="text-sm">Allow Control Panel</label>
      </div>
    </div>
  );
}

export default function Clients() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data, isLoading, refetch } = useListClients();
  const clients = Array.isArray(data) ? data : (data as any)?.data ?? [];
  const [searchFilter, setSearchFilter] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const createMutation = useCreateClient({
    mutation: {
      onSuccess: () => {
        toast({ title: "Client added" });
        setShowAddModal(false);
        setForm({ ...EMPTY_FORM });
        refetch();
      },
    },
  });

  const deleteMutation = useDeleteClient({
    mutation: {
      onSuccess: () => { toast({ title: "Client deleted" }); refetch(); },
    },
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    createMutation.mutate({ data: form as any });
  };

  const handleEdit = (client: any) => {
    setEditingId(client.id);
    setForm({
      name: client.name || "",
      email1: client.email1 || "",
      email2: client.email2 || "",
      email3: client.email3 || "",
      phone1: client.phone1 || "",
      phone2: client.phone2 || "",
      phone3: client.phone3 || "",
      address1: client.address1 || "",
      address2: client.address2 || "",
      address3: client.address3 || "",
      pincode: client.pincode || "",
      city: client.city || "",
      clientType: client.clientType || "",
      country: client.country || "",
      preferredContactType: client.preferredContactType || "",
      allowControlPanel: client.allowControlPanel || false,
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !editingId) return;
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const baseUrl = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;
      const resp = await fetch(`${baseUrl}/clients/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (resp.ok) {
        toast({ title: "Client updated" });
        setShowEditModal(false);
        setEditingId(null);
        setForm({ ...EMPTY_FORM });
        refetch();
      } else {
        const err = await resp.json().catch(() => ({}));
        toast({ title: err.message || "Failed to update client", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to update client", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure?")) {
      deleteMutation.mutate({ id });
    }
  };

  const setField = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const filtered = clients.filter((c: any) =>
    !searchFilter || (c.name || "").toLowerCase().includes(searchFilter.toLowerCase()) || (c.email1 || "").toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <Layout>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xl font-semibold">Clients</h4>
        <button onClick={() => { setForm({ ...EMPTY_FORM }); setShowAddModal(true); }} className="bg-blue-500 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-600 flex items-center gap-1">
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h5 className="text-lg font-semibold">Add Client</h5>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAdd}>
              <ClientFormFields form={form} setField={setField} />
              <div className="flex items-center justify-end gap-2 p-4 border-t">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 border rounded text-sm hover:bg-gray-50">Close</button>
                <button type="submit" disabled={createMutation.isPending} className="bg-green-500 text-white px-4 py-2 rounded text-sm hover:bg-green-600 disabled:opacity-50">
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowEditModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h5 className="text-lg font-semibold">Edit Client</h5>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <ClientFormFields form={form} setField={setField} />
              <div className="flex items-center justify-end gap-2 p-4 border-t">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 border rounded text-sm hover:bg-gray-50">Close</button>
                <button type="submit" disabled={saving} className="bg-green-500 text-white px-4 py-2 rounded text-sm hover:bg-green-600 disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded shadow-sm border">
        <div className="p-3 border-b">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <input type="text" className="w-full border rounded pl-8 pr-3 py-2 text-sm" placeholder="Search clients..." value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)} />
          </div>
        </div>
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                  {isAdmin && <th className="px-4 py-3 text-left font-medium text-gray-500">User</th>}
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Emails</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Phones</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Address</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Attorney/Client</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Preffered Contact Type</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Allow Control Panel</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.length === 0 ? (
                  <tr><td colSpan={isAdmin ? 9 : 8} className="px-4 py-8 text-center text-gray-500">No clients found</td></tr>
                ) : filtered.map((c: any) => {
                  const emails = [c.email1, c.email2, c.email3].filter(Boolean);
                  const phones = [c.phone1, c.phone2, c.phone3].filter(Boolean);
                  const addressParts = [c.country, c.city, c.address1, c.address2, c.address3].filter(Boolean);
                  return (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          {c.userName && <>{c.userName}<br />[{c.userEmail}]</>}
                        </td>
                      )}
                      <td className="px-4 py-3">{emails.length > 0 ? emails.map((e: string, i: number) => <span key={i}>{e}{i < emails.length - 1 && <br />}</span>) : "-"}</td>
                      <td className="px-4 py-3">{phones.length > 0 ? phones.map((p: string, i: number) => <span key={i}>{p}{i < phones.length - 1 && <br />}</span>) : "-"}</td>
                      <td className="px-4 py-3">{addressParts.length > 0 ? addressParts.join(", ") : "-"}</td>
                      <td className="px-4 py-3">{c.clientType || "-"}</td>
                      <td className="px-4 py-3 text-center">{c.preferredContactType ? c.preferredContactType.charAt(0).toUpperCase() + c.preferredContactType.slice(1) : "-"}</td>
                      <td className="px-4 py-3 text-center">
                        {c.allowControlPanel ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">Yes</span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">No</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleDelete(c.id)} className="bg-red-500 text-white p-1.5 rounded text-xs hover:bg-red-600" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleEdit(c)} className="bg-yellow-500 text-white p-1.5 rounded text-xs hover:bg-yellow-600" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
