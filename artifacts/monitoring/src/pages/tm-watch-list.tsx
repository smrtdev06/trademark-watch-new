import { useState, useRef } from "react";
import { Layout } from "@/components/layout";
import { useListMonitoringKeywords, useDeleteMonitoringKeyword, useListClients, useGetAllowedCountries } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, Pencil, X, ChevronDown, RefreshCw } from "lucide-react";
import { normalizeAllowedCountriesPayload } from "@/lib/allowedCountries";

/** PHP `AddKeywords::mount` / edit: classes 1–45 and 99. */
const CLASSES = [...Array.from({ length: 45 }, (_, i) => String(i + 1)), "99"];

/** Reverse of API `normalizeMonitoringClass`: DB stores `|25|35|`, add form sends `25,35`. */
function parseStoredMonitoringClass(raw: string | null | undefined): string[] {
  if (raw == null || typeof raw !== "string") return [];
  const s = raw.trim();
  if (!s) return [];
  if (s.includes("|")) {
    const inner = s.replace(/^\|+|\|+$/g, "");
    return inner.split("|").map((p) => p.trim()).filter(Boolean);
  }
  return s.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
}

function formatClassDisplay(classes: string[]): string {
  if (classes.length === 0) return "";
  return `|${classes.join("|")}|`;
}

function EditModal({
  item,
  onClose,
  onSaved,
}: {
  item: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const { data: clientsData } = useListClients();
  const { data: countriesData } = useGetAllowedCountries();
  const clients = (clientsData as any)?.data ?? clientsData ?? [];
  const countries = normalizeAllowedCountriesPayload(countriesData);

  const [country, setCountry] = useState(item.country || "");
  const [cls, setCls] = useState<string[]>(() => parseStoredMonitoringClass(item.class));
  const [clientId, setClientId] = useState(String(item.clientId || ""));
  const [saving, setSaving] = useState(false);
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const classRef = useRef<HTMLDivElement>(null);

  const toggleClass = (val: string) => {
    setCls((prev) =>
      prev.includes(val) ? prev.filter((c) => c !== val) : [...prev, val]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL || "/api";
      const token = localStorage.getItem("token");
      const res = await fetch(`${baseUrl}/monitoring/keywords/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          country,
          class: cls.join(","),
          clientId: clientId ? parseInt(clientId) : null,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Update failed");
      toast({ title: "Keyword updated" });
      onSaved();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h5 className="text-lg font-semibold">Edit Keyword</h5>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Keyword</label>
            <input type="text" disabled value={item.keyword} className="w-full border rounded px-3 py-2 text-sm bg-gray-100 text-gray-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
            <select className="w-full border rounded px-3 py-2 text-sm" value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value=""> - Select Country - </option>
              {Object.entries(countries).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
            <select className="w-full border rounded px-3 py-2 text-sm" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value=""> - Select Client - </option>
              {Array.isArray(clients) && clients.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div ref={classRef}>
            <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowClassDropdown(!showClassDropdown)}
                className="w-full border rounded px-3 py-2 text-sm text-left flex items-center justify-between bg-white"
              >
                <span className="truncate">
                  {cls.length > 0 ? formatClassDisplay(cls) : "- Select Class -"}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </button>
              {showClassDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-48 overflow-y-auto">
                  {CLASSES.map((c) => (
                    <label key={c} className="flex items-center px-3 py-1.5 hover:bg-gray-50 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={cls.includes(c)}
                        onChange={() => toggleClass(c)}
                      />
                      {c}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <button onClick={onClose} className="px-4 py-2 border rounded text-sm hover:bg-gray-50">Close</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TmWatchList() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editItem, setEditItem] = useState<any | null>(null);
  const [requeueingId, setRequeueingId] = useState<number | null>(null);

  const { data, isLoading, refetch } = useListMonitoringKeywords({ page, search: search || undefined } as any);
  const keywords = (data as any)?.data ?? [];
  const totalPages = (data as any)?.totalPages ?? 1;

  const deleteMutation = useDeleteMonitoringKeyword({
    mutation: {
      onSuccess: () => { toast({ title: "Keyword deleted" }); refetch(); },
    },
  });

  async function handleRequeueScopes(id: number) {
    setRequeueingId(id);
    try {
      const baseUrl = import.meta.env.VITE_API_URL || "/api";
      const token = localStorage.getItem("token");
      const res = await fetch(`${baseUrl}/monitoring/keywords/${id}/requeue-scopes`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.message || "Re-queue failed");
      toast({
        title: "Scopes re-queued",
        description: "Fresh monitoring scopes were created and processing was scheduled.",
      });
      await refetch();
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Re-queue failed",
        variant: "destructive",
      });
    } finally {
      setRequeueingId(null);
    }
  }

  return (
    <Layout>
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-xl font-semibold">My TM Watch</h4>
        <input type="text" placeholder="Search keywords..." className="border rounded px-3 py-1.5 text-sm w-64" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>
      <div className="bg-white rounded shadow-sm border">
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Keyword</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Country</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Class</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Client Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">User</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {keywords.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No keywords found</td></tr>
                ) : keywords.map((k: any) => (
                  <tr key={k.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{k.keyword}</td>
                    <td className="px-4 py-3">{k.country}</td>
                    <td className="px-4 py-3">{k.class}</td>
                    <td className="px-4 py-3">{k.clientName || "-"}</td>
                    <td className="px-4 py-3">{k.userName || "-"}</td>
                    <td className="px-4 py-3 flex gap-2 items-center">
                      <button
                        type="button"
                        title="Re-queue scopes"
                        disabled={requeueingId === k.id}
                        onClick={() => handleRequeueScopes(k.id)}
                        className="text-emerald-600 hover:text-emerald-800 disabled:opacity-50"
                      >
                        {requeueingId === k.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                      </button>
                      <button type="button" onClick={() => setEditItem(k)} className="text-blue-500 hover:text-blue-700"><Pencil className="w-4 h-4" /></button>
                      <button type="button" onClick={() => deleteMutation.mutate({ id: k.id })} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
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
      {editItem && (
        <EditModal
          key={editItem.id}
          item={editItem}
          onClose={() => setEditItem(null)}
          onSaved={() => refetch()}
        />
      )}
    </Layout>
  );
}
