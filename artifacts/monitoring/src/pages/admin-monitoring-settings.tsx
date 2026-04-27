import { useState } from "react";
import { Layout } from "@/components/layout";

export default function AdminMonitoringSettings() {
  const [processMonitoring, setProcessMonitoring] = useState(true);
  const [scopesPerMin, setScopesPerMin] = useState("10");
  const [stopWords, setStopWords] = useState("");
  const [excludeYears, setExcludeYears] = useState("");
  const [excludeCompanies, setExcludeCompanies] = useState("");
  const [excludeAgents, setExcludeAgents] = useState("");

  return (
    <Layout>
      <div className="mb-4"><h4 className="text-xl font-semibold">Monitoring Settings</h4></div>

      <div className="bg-white rounded shadow-sm border p-4 mb-4">
        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={processMonitoring} onChange={(e) => setProcessMonitoring(e.target.checked)} className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
          <span className="text-sm font-medium text-gray-700">Process monitoring (on/off)</span>
        </div>
      </div>

      <div className="bg-white rounded shadow-sm border p-4 mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Process Scopes per Minute</label>
        <input type="number" className="border rounded px-3 py-2 text-sm w-full max-w-md" value={scopesPerMin} onChange={(e) => setScopesPerMin(e.target.value)} />
      </div>

      <div className="bg-white rounded shadow-sm border p-4 mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Stop Words</label>
        <textarea className="border rounded px-3 py-2 text-sm w-full" rows={3} placeholder="Enter stop words separated by commas" value={stopWords} onChange={(e) => setStopWords(e.target.value)} />
      </div>

      <div className="bg-white rounded shadow-sm border p-4 mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Exclud Years</label>
        <textarea className="border rounded px-3 py-2 text-sm w-full" rows={2} placeholder="Enter years to exclude separated by commas" value={excludeYears} onChange={(e) => setExcludeYears(e.target.value)} />
      </div>

      <div className="bg-white rounded shadow-sm border p-4 mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Companies Blacklist</label>
        <textarea className="border rounded px-3 py-2 text-sm w-full" rows={3} placeholder="Enter company names to exclude separated by commas" value={excludeCompanies} onChange={(e) => setExcludeCompanies(e.target.value)} />
      </div>

      <div className="bg-white rounded shadow-sm border p-4 mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Agents Blacklist</label>
        <textarea className="border rounded px-3 py-2 text-sm w-full" rows={3} placeholder="Enter agent names to exclude separated by commas" value={excludeAgents} onChange={(e) => setExcludeAgents(e.target.value)} />
      </div>
    </Layout>
  );
}
