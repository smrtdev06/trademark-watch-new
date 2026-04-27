import { useState } from "react";
import { Layout } from "@/components/layout";
import { useListSocialKeywords, useDeleteSocialKeyword, useListClients, useAddSocialKeyword } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, Plus, X, Pencil } from "lucide-react";
import { AddClientModal } from "@/components/add-client-modal";

/** Mirrors `App\Classes\ScaleSerpSites::ALL` — option values are `Category::siteKey` like PHP `add.blade.php`. */
const SCALE_SERP_SITES: Record<string, Record<string, string>> = {
  Products: {
    "indiamart.com": "IndiaMart.com",
    "amazon.in": "Amazon.in",
    "flipkart.in": "Flipkart.in",
  },
  Pharma: {
    "1mg.com": "1mg.com",
    "pharmaeasy.in": "Pharmaeasy.in",
    "netmeds.com": "Netmeds.com",
    "apollopharmacy.in": "ApolloPharmacy.in",
  },
  Service: {
    "swiggy.com": "Swiggy.com",
    "zomato.com": "Zomato.com",
    "justdial.com": "Justdial.com",
  },
  "Hotels & Resturant": {
    "swiggy.com": "Swiggy.com",
    "zomato.com": "Zomato.com",
    "booking.com": "Booking.com",
    "agoda.com": "Agoda.com",
    "makemytrip.com": "Makemytrip.com",
  },
};

function siteSelectValueFromDb(category: string | undefined, site: string | undefined): string {
  if (!site) return "";
  const cat = (category ?? "").toLowerCase().trim();
  for (const [catLabel, sites] of Object.entries(SCALE_SERP_SITES)) {
    if (sites[site] !== undefined && catLabel.toLowerCase() === cat) {
      return `${catLabel}::${site}`;
    }
  }
  const ambiguous: string[] = [];
  for (const [catLabel, sites] of Object.entries(SCALE_SERP_SITES)) {
    if (sites[site] !== undefined) {
      ambiguous.push(`${catLabel}::${site}`);
    }
  }
  if (ambiguous.length === 1) return ambiguous[0]!;
  return "";
}

export default function SocialList() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [site, setSite] = useState("");
  const [freq, setFreq] = useState("");
  const [clientId, setClientId] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const { data, isLoading, refetch } = useListSocialKeywords({ page, search: search || undefined } as any);
  const { data: clientsData, refetch: refetchClients } = useListClients();
  const keywords = (data as any)?.data ?? [];
  const totalPages = (data as any)?.totalPages ?? 1;
  const clients = (clientsData as any)?.data ?? clientsData ?? [];

  const deleteMutation = useDeleteSocialKeyword({
    mutation: {
      onSuccess: () => { toast({ title: "Keyword deleted" }); refetch(); },
    },
  });

  const addMutation = useAddSocialKeyword({
    mutation: {
      onSuccess: () => {
        toast({ title: "Keyword added" });
        setShowAddModal(false);
        void refetch();
      },
      onError: (err: Error & { message?: string }) => {
        toast({ title: "Failed to save", description: err?.message, variant: "destructive" });
      },
    },
  });

  const openAddModal = () => {
    setEditMode(false);
    setEditId(null);
    setKeyword("");
    setSite("");
    setFreq("");
    setClientId("");
    setShowAddModal(true);
  };

  const openEditModal = (k: any) => {
    setEditMode(true);
    setEditId(k.id);
    setKeyword(k.keyword || "");
    setSite(siteSelectValueFromDb(k.category, k.site));
    setFreq(String(k.freq || ""));
    setClientId(String(k.clientId || ""));
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword || !site || !freq) return;

    const siteParts = site.split("::");
    const category = siteParts.length > 1 ? siteParts[0].toLowerCase() : "";
    const siteValue = siteParts.length > 1 ? siteParts[1] : site;

    const payload = {
      keyword,
      site: siteValue,
      freq: parseInt(freq, 10),
      ...(category ? { category } : {}),
      ...(clientId ? { clientId: parseInt(clientId, 10) } : {}),
    };

    if (editMode && editId != null) {
      setEditSaving(true);
      try {
        const token = localStorage.getItem("token");
        const resp = await fetch(`/api/social/keywords/${editId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        });
        if (resp.ok) {
          toast({ title: "Keyword updated" });
          setShowAddModal(false);
          void refetch();
        } else {
          const data = (await resp.json().catch(() => null)) as { message?: string } | null;
          toast({
            title: "Failed to save",
            description: data?.message,
            variant: "destructive",
          });
        }
      } catch {
        toast({ title: "Failed to save", variant: "destructive" });
      } finally {
        setEditSaving(false);
      }
      return;
    }

    addMutation.mutate({ data: payload });
  };

  return (
    <Layout>
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-xl font-semibold">Added Keywords</h4>
        <div className="flex gap-2">
          <input type="text" placeholder="Search..." className="border rounded px-3 py-1.5 text-sm w-48" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <button onClick={openAddModal} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h5 className="text-lg font-semibold">
                {editMode ? "Edit Keyword" : "Add Keyword"}
              </h5>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Keyword</label>
                  <input
                    type="text"
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Site</label>
                  <select
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={site}
                    onChange={(e) => setSite(e.target.value)}
                    required
                  >
                    <option value=""> - Select Site - </option>
                    {Object.entries(SCALE_SERP_SITES).map(([categoryLabel, sites]) => (
                      <optgroup key={categoryLabel} label={categoryLabel}>
                        {Object.entries(sites).map(([siteKey, displayName]) => (
                          <option key={`${categoryLabel}::${siteKey}`} value={`${categoryLabel}::${siteKey}`}>
                            {displayName}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                  <select
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={freq}
                    onChange={(e) => setFreq(e.target.value)}
                    required
                  >
                    <option value="">Choose Frequency</option>
                    <option value="30">Once in 30 days</option>
                    <option value="60">Once in 60 days</option>
                    <option value="90">Once in 90 days</option>
                    <option value="180">Once in 180 days</option>
                    <option value="360">Once in 360 days</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client Name
                    <button
                      type="button"
                      onClick={() => setShowAddClient(true)}
                      className="ml-2 inline-flex items-center justify-center w-5 h-5 bg-green-500 text-white rounded text-xs font-bold hover:bg-green-600"
                    >
                      +
                    </button>
                  </label>
                  <select
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                  >
                    <option value=""> - Select Client - </option>
                    {Array.isArray(clients) && clients.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 p-4 border-t">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 border rounded text-sm hover:bg-gray-50">Close</button>
                <button type="submit" disabled={addMutation.isPending || editSaving} className="bg-green-500 text-white px-4 py-2 rounded text-sm hover:bg-green-600 disabled:opacity-50">
                  {addMutation.isPending || editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editMode ? "Save" : "Add")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddClient && (
        <AddClientModal
          onClose={() => setShowAddClient(false)}
          onAdded={() => refetchClients()}
        />
      )}

      <div className="bg-white rounded shadow-sm border">
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Keyword</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Client Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Site</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Category</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Added</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Freq</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">User</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {keywords.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No keywords found</td></tr>
                ) : keywords.map((k: any) => (
                  <tr key={k.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{k.keyword}</td>
                    <td className="px-4 py-3">{k.clientName || "-"}</td>
                    <td className="px-4 py-3">{k.site}</td>
                    <td className="px-4 py-3">{k.category || "-"}</td>
                    <td className="px-4 py-3">{k.createdAt ? new Date(k.createdAt).toLocaleDateString() : "-"}</td>
                    <td className="px-4 py-3">{k.freq}</td>
                    <td className="px-4 py-3">{k.userName || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEditModal(k)} className="text-blue-500 hover:text-blue-700"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => deleteMutation.mutate({ id: k.id })} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
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
    </Layout>
  );
}
