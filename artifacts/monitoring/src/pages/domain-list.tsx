import { useState } from "react";
import { Layout } from "@/components/layout";
import { useListDomains, useDeleteDomain, useListClients } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, Plus, Pencil, X } from "lucide-react";
import { AddClientModal, AddClientButton } from "@/components/add-client-modal";

export default function DomainList() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [domains, setDomains] = useState("");
  const [searchType, setSearchType] = useState("");
  const [clientId, setClientId] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDomain, setEditDomain] = useState("");
  const [editSearchType, setEditSearchType] = useState("contains");
  const [saving, setSaving] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);

  const { data, isLoading, refetch } = useListDomains({ page, search: search || undefined } as any);
  const domainList = (data as any)?.data ?? [];
  const totalPages = (data as any)?.totalPages ?? 1;

  const { data: clientsData, refetch: refetchClients } = useListClients();
  const clients = (clientsData as any)?.data ?? (Array.isArray(clientsData) ? clientsData : []);

  const deleteMutation = useDeleteDomain({
    mutation: {
      onSuccess: () => { toast({ title: "Domain deleted" }); refetch(); },
    },
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domains.trim() || !searchType) return;
    setAdding(true);
    try {
      const token = localStorage.getItem("token");
      const baseUrl = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;
      const lines = domains.split(/\n/).map(l => l.trim()).filter(Boolean);
      let failed = 0;
      for (const domain of lines) {
        const resp = await fetch(`${baseUrl}/domains`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ domain, searchType, clientId: clientId ? parseInt(clientId) : undefined }),
        });
        if (!resp.ok) failed++;
      }
      if (failed > 0) {
        toast({ title: `${lines.length - failed} added, ${failed} failed`, variant: "destructive" });
      } else {
        toast({ title: "Domains added successfully" });
      }
      setShowAddModal(false);
      setDomains("");
      setSearchType("");
      setClientId("");
      refetch();
    } catch {
      toast({ title: "Can't insert records. Please, try later", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const handleEdit = (d: any) => {
    setEditingId(d.id);
    setEditDomain(d.domain || "");
    setEditSearchType(d.searchType || "contains");
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDomain || !editingId) return;
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const baseUrl = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;
      const resp = await fetch(`${baseUrl}/domains/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ domain: editDomain, searchType: editSearchType }),
      });
      if (resp.ok) {
        toast({ title: "Domain updated" });
        setEditingId(null);
        refetch();
      } else {
        const err = await resp.json().catch(() => ({}));
        toast({ title: err.message || "Failed to update", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-xl font-semibold">Domain Monitoring</h4>
        <div className="flex gap-2">
          <input type="text" placeholder="Search..." className="border rounded px-3 py-1.5 text-sm w-48" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <button onClick={() => setShowAddModal(true)} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1"><Plus className="w-4 h-4" /> Add</button>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h5 className="text-lg font-semibold">Add Domain(s)</h5>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Search Type</label>
                  <select
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={searchType}
                    onChange={(e) => setSearchType(e.target.value)}
                    required
                  >
                    <option value=""> - Select - </option>
                    <option value="starts">Starts With</option>
                    <option value="contains">Contains</option>
                    <option value="ends">Ends With</option>
                  </select>
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    <select
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                    >
                      <option value=""> - Select Client - </option>
                      {clients.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <AddClientButton onClick={() => setShowAddClient(true)} />
                  </div>
                </div>
                <div>
                  <textarea
                    className="w-full border rounded px-3 py-2 text-sm"
                    rows={12}
                    value={domains}
                    onChange={(e) => setDomains(e.target.value)}
                    required
                    placeholder="Enter domains, one per line"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 p-4 border-t">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 border rounded text-sm hover:bg-gray-50">Close</button>
                <button type="submit" disabled={adding} className="bg-green-500 text-white px-4 py-2 rounded text-sm hover:bg-green-600 disabled:opacity-50">
                  {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditingId(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h5 className="text-lg font-semibold">Edit Domain</h5>
              <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Search Type</label>
                  <select className="w-full border rounded px-3 py-2 text-sm" value={editSearchType} onChange={(e) => setEditSearchType(e.target.value)}>
                    <option value=""> - Select - </option>
                    <option value="starts">Starts With</option>
                    <option value="contains">Contains</option>
                    <option value="ends">Ends With</option>
                  </select>
                </div>
                <div>
                  <input type="text" className="w-full border rounded px-3 py-2 text-sm" placeholder="Domain" value={editDomain} onChange={(e) => setEditDomain(e.target.value)} required />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 p-4 border-t">
                <button type="button" onClick={() => setEditingId(null)} className="px-4 py-2 border rounded text-sm hover:bg-gray-50">Close</button>
                <button type="submit" disabled={saving} className="bg-green-500 text-white px-4 py-2 rounded text-sm hover:bg-green-600 disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Edit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded shadow-sm border">
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Domain</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Search Type</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Client</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {domainList.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No domains found</td></tr>
                ) : domainList.map((d: any) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{d.domain}</td>
                    <td className="px-4 py-3">{d.searchType}</td>
                    <td className="px-4 py-3">{d.clientName || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleEdit(d)} className="text-blue-500 hover:text-blue-700"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => { if (confirm("Are you sure?")) deleteMutation.mutate({ id: d.id }); }} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 border rounded text-sm disabled:opacity-50">Previous</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1 border rounded text-sm disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
      {showAddClient && (
        <AddClientModal onClose={() => setShowAddClient(false)} onAdded={() => refetchClients()} />
      )}
    </Layout>
  );
}
