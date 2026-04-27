import { useState } from "react";
import { Layout } from "@/components/layout";
import { useCreateAlert, useListClients, useGetMyLimits } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check } from "lucide-react";
import { AddClientModal, AddClientButton } from "@/components/add-client-modal";

const ALERT_TYPES = [
  { key: "fssai", label: "FSSAI", color: "bg-blue-600 hover:bg-blue-700" },
  { key: "udyaam", label: "Udyaam", color: "bg-green-600 hover:bg-green-700" },
  { key: "mca", label: "MCA", color: "bg-red-600 hover:bg-red-700" },
  { key: "citations", label: "Citations", color: "bg-yellow-500 hover:bg-yellow-600" },
  { key: "opposition_watch", label: "Opposition Watch", color: "bg-cyan-500 hover:bg-cyan-600" },
  { key: "proprietor_search", label: "Propretiror Search", color: "bg-gray-400 hover:bg-gray-500" },
  { key: "domain_monitoring", label: "Domain Monitoring", color: "bg-gray-800 hover:bg-gray-900" },
  { key: "b2b", label: "B2B", color: "bg-cyan-200 hover:bg-cyan-300 text-gray-800" },
  { key: "b2c", label: "B2C", color: "bg-red-200 hover:bg-red-300 text-gray-800" },
];

export default function AlertsAdd() {
  const { toast } = useToast();
  const { data: clientsData, refetch: refetchClients } = useListClients();
  const { data: myLimits } = useGetMyLimits();
  const clients = (clientsData as any)?.data ?? clientsData ?? [];

  const [keyword, setKeyword] = useState("");
  const [searchType, setSearchType] = useState<string[]>([]);
  const [frequency, setFrequency] = useState("");
  const [clientId, setClientId] = useState("");
  const [b2bSites, setB2bSites] = useState<string[]>([]);
  const [b2cSites, setB2cSites] = useState<string[]>([]);
  const [searchMode, setSearchMode] = useState<"exact" | "variation">("variation");
  const [showAddClient, setShowAddClient] = useState(false);

  const ld = myLimits as any;
  const alertLimit = ld?.limits?.find((l: any) => l.name === "alertLimits")?.value ?? 0;
  const alertUsed = ld?.used?.find((u: any) => u.name === "alert")?.value ?? 0;

  const mutation = useCreateAlert({
    mutation: {
      onSuccess: () => {
        toast({ title: "Saved!" });
        setKeyword(""); setSearchType([]); setFrequency(""); setClientId("");
        setB2bSites([]); setB2cSites([]); setSearchMode("variation");
      },
      onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    },
  });

  const toggleType = (type: string) => {
    setSearchType((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword || searchType.length === 0 || !frequency) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    for (const type of searchType) {
      mutation.mutate({
        data: {
          keyword,
          type,
          clientId: clientId ? parseInt(clientId) : undefined,
          frequency: parseInt(frequency),
          searchMode: (type === "b2b" || type === "b2c") ? searchMode : undefined,
        } as any,
      });
    }
  };

  return (
    <Layout>
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-xl font-semibold">Alerts</h4>
        <h6 className="text-sm text-gray-600">Alerts Limit/Used : {alertLimit} / {alertUsed}</h6>
      </div>
      <div className="bg-white rounded shadow-sm border p-4">
        <form onSubmit={handleSubmit}>
          <div className="flex flex-wrap items-center gap-3 mb-4 justify-center">
            <div className="flex items-center gap-1">
              <select
                className="form-control border rounded px-3 py-2 text-sm min-w-[180px]"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              >
                <option> - Select Client - </option>
                {Array.isArray(clients) && clients.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <AddClientButton onClick={() => setShowAddClient(true)} />
            </div>
            <input
              type="text"
              placeholder="Keyword"
              className="border rounded px-3 py-2 text-sm w-48"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <select
              className="border rounded px-3 py-2 text-sm min-w-[180px]"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
            >
              <option value=""> - Select Frequency - </option>
              <option value="2">2</option>
              <option value="15">15</option>
              <option value="30">30</option>
              <option value="180">180</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-2 justify-center mb-4">
            {ALERT_TYPES.map((at) => (
              <button
                key={at.key}
                type="button"
                onClick={() => toggleType(at.key)}
                className={`px-3 py-2 rounded text-sm text-white ${at.color} flex items-center gap-1`}
              >
                {searchType.includes(at.key) && <Check className="w-4 h-4" />}
                {at.label}
              </button>
            ))}
          </div>

          {(searchType.includes("b2b") || searchType.includes("b2c")) && (
            <div className="flex flex-wrap items-center gap-4 justify-center mb-4">
              {searchType.includes("b2b") && (
                <div className="flex gap-3">
                  <label className="flex items-center gap-1 text-sm">
                    <input type="checkbox" checked={b2bSites.includes("indiamart")} onChange={(e) => setB2bSites(e.target.checked ? [...b2bSites, "indiamart"] : b2bSites.filter(s => s !== "indiamart"))} />
                    Indiamart
                  </label>
                  <label className="flex items-center gap-1 text-sm">
                    <input type="checkbox" checked={b2bSites.includes("tradeindia")} onChange={(e) => setB2bSites(e.target.checked ? [...b2bSites, "tradeindia"] : b2bSites.filter(s => s !== "tradeindia"))} />
                    TradeIndia
                  </label>
                </div>
              )}
              {searchType.includes("b2c") && (
                <div className="flex gap-3">
                  <label className="flex items-center gap-1 text-sm">
                    <input type="checkbox" checked={b2cSites.includes("flipkart")} onChange={(e) => setB2cSites(e.target.checked ? [...b2cSites, "flipkart"] : b2cSites.filter(s => s !== "flipkart"))} />
                    FlipKart
                  </label>
                  <label className="flex items-center gap-1 text-sm">
                    <input type="checkbox" checked={b2cSites.includes("amazon")} onChange={(e) => setB2cSites(e.target.checked ? [...b2cSites, "amazon"] : b2cSites.filter(s => s !== "amazon"))} />
                    Amazon
                  </label>
                </div>
              )}
              <div className="flex gap-3">
                <label className="flex items-center gap-1 text-sm">
                  <input type="checkbox" checked={searchMode === "exact"} onChange={() => setSearchMode("exact")} />
                  Exact Search
                </label>
                <label className="flex items-center gap-1 text-sm">
                  <input type="checkbox" checked={searchMode === "variation"} onChange={() => setSearchMode("variation")} />
                  Variation Search
                </label>
              </div>
            </div>
          )}

          <div className="text-right">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="bg-green-600 text-white px-6 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 ml-auto"
            >
              {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Save
            </button>
          </div>
        </form>
      </div>
      {showAddClient && (
        <AddClientModal onClose={() => setShowAddClient(false)} onAdded={() => refetchClients()} />
      )}
    </Layout>
  );
}
