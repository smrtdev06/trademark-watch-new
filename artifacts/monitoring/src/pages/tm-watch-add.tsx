import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import { useListClients, useGetAllowedCountries, useGetProfile } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Minus, HelpCircle } from "lucide-react";
import { AddClientModal, AddClientButton } from "@/components/add-client-modal";
import { normalizeAllowedCountriesPayload } from "@/lib/allowedCountries";

interface RecordRow {
  country: string[];
  tmName: string;
  class: string[];
  client: string;
}

/** Matches PHP `AddKeywords::mount`: 1–45 plus 99 (`App\Http\Livewire\Monitoring\AddKeywords`). */
const CLASSES = [...Array.from({ length: 45 }, (_, i) => String(i + 1)), "99"];

function MultiSelect({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  const toggle = (val: string) => {
    if (value.includes(val)) {
      onChange(value.filter((v) => v !== val));
    } else {
      onChange([...value, val]);
    }
  };

  const displayText = value.length === 0
    ? placeholder || "Select..."
    : value.length === 1
    ? options.find((o) => o.value === value[0])?.label || value[0]
    : `${options.find((o) => o.value === value[0])?.label || value[0]} +${value.length - 1}`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full border rounded px-3 py-2 text-sm text-left bg-white flex items-center justify-between"
      >
        <span className={value.length === 0 ? "text-gray-400" : ""}>{displayText}</span>
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto bg-white border rounded shadow-lg">
            {options.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm"
              >
                <input
                  type="checkbox"
                  checked={value.includes(opt.value)}
                  onChange={() => toggle(opt.value)}
                  className="rounded"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Hint({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-block ml-1">
      <HelpCircle
        className="w-3.5 h-3.5 text-gray-400 cursor-pointer inline"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
      />
      {show && (
        <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-1 w-60 p-2 bg-gray-800 text-white text-xs rounded shadow-lg">
          {text}
        </div>
      )}
    </span>
  );
}

export default function TmWatchAdd() {
  const { toast } = useToast();
  const { data: clientsData, refetch: refetchClients } = useListClients();
  const { data: countriesData } = useGetAllowedCountries();
  const { data: profile } = useGetProfile();
  const clients = (clientsData as any)?.data ?? clientsData ?? [];
  const countries = normalizeAllowedCountriesPayload(countriesData);
  const [saving, setSaving] = useState(false);
  const didApplyProfileCountry = useRef(false);
  const [showAddClient, setShowAddClient] = useState(false);

  const emptyRow = (): RecordRow => ({ country: [], tmName: "", class: [], client: "" });
  const [records, setRecords] = useState<RecordRow[]>([emptyRow()]);

  /** PHP `setUpCountry()` pre-selects the user profile country on the first row. */
  useEffect(() => {
    const code = profile?.country?.trim();
    if (!code || didApplyProfileCountry.current) return;
    if (!countries[code]) return;
    didApplyProfileCountry.current = true;
    setRecords((prev) => {
      if (prev.length !== 1) return prev;
      const r = prev[0];
      if (r.tmName !== "" || r.country.length > 0 || r.class.length > 0 || r.client !== "") return prev;
      return [{ ...r, country: [code] }];
    });
  }, [profile?.country, countries]);

  const updateRecord = (index: number, field: keyof RecordRow, value: any) => {
    setRecords((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  const addRecord = () => setRecords((prev) => [...prev, emptyRow()]);
  const removeRecord = (index: number) => {
    if (records.length <= 1) return;
    setRecords((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const valid = records.filter((r) => r.tmName.trim());
    if (valid.length === 0) {
      toast({ title: "Please enter at least one TM Name", variant: "destructive" });
      return;
    }
    setSaving(true);
    let success = 0;
    let failed = 0;
    for (const rec of valid) {
      try {
        const token = localStorage.getItem("token");
        const baseUrl = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;
        const resp = await fetch(`${baseUrl}/monitoring/keywords`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            keyword: rec.tmName,
            country: rec.country.join(","),
            class: rec.class.join(","),
            ...(rec.client ? { clientId: parseInt(rec.client, 10) } : {}),
          }),
        });
        if (resp.ok) success++;
        else failed++;
      } catch {
        failed++;
      }
    }
    setSaving(false);
    if (failed === 0) {
      toast({ title: "Keywords added successfully" });
      setRecords([emptyRow()]);
    } else {
      toast({ title: `${success} added, ${failed} failed`, variant: "destructive" });
    }
  };

  const countryOptions = Object.entries(countries).map(([code, name]) => ({ value: code, label: name }));
  const classOptions = CLASSES.map((c) => ({ value: c, label: c }));

  return (
    <Layout>
      <div className="mb-4"><h4 className="text-xl font-semibold">Add keywords for monitoring</h4></div>
      <div className="bg-white rounded shadow-sm border p-4">
        {records.map((record, index) => (
          <div key={index} className="grid grid-cols-1 md:grid-cols-[3fr_4fr_1fr_3fr_auto] gap-3 items-end mb-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Country
                <Hint text="Select the list of country where you wish to watch your trademark name. Ex: If you do Business in India and export to Korea then you select India and Korea" />
              </label>
              <MultiSelect
                options={countryOptions}
                value={record.country}
                onChange={(v) => updateRecord(index, "country", v)}
                placeholder="Select countries"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                TM Name
                <Hint text="Enter the trademark Name which you wish to be watched. Ex: PEPSI" />
              </label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="TM Name"
                value={record.tmName}
                onChange={(e) => updateRecord(index, "tmName", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Class
                <Hint text="Select The classification which you wish to watch." />
              </label>
              <MultiSelect
                options={classOptions}
                value={record.class}
                onChange={(v) => updateRecord(index, "class", v)}
                placeholder="Class"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client Name
                <Hint text="Select the client name for which you wish the Trademark Name to be watched" />
              </label>
              <div className="flex items-center gap-1">
                <select
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={record.client}
                  onChange={(e) => updateRecord(index, "client", e.target.value)}
                >
                  <option value=""> - Select Client - </option>
                  {Array.isArray(clients) && clients.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <AddClientButton onClick={() => setShowAddClient(true)} />
              </div>
            </div>
            <div className="flex gap-1 pb-0.5">
              <button
                type="button"
                onClick={addRecord}
                className="bg-green-500 text-white px-2.5 py-2 rounded text-sm hover:bg-green-600"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => removeRecord(index)}
                disabled={records.length <= 1}
                className="bg-red-500 text-white px-2.5 py-2 rounded text-sm hover:bg-red-600 disabled:opacity-50"
              >
                <Minus className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        <div className="flex justify-end mt-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white px-6 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save
          </button>
        </div>
      </div>
      {showAddClient && (
        <AddClientModal onClose={() => setShowAddClient(false)} onAdded={() => refetchClients()} />
      )}
    </Layout>
  );
}
