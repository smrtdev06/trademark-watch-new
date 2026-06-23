import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Loader2, RefreshCw } from "lucide-react";

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? "/api";

type PdfTask = {
  id: number;
  externalTaskId: string;
  keyword: string | null;
  appnoCount: number;
  status: string;
  hasDownload: boolean;
  pdfCount: number;
  createdAt: string;
  updatedAt: string;
};

type StatusTab = "all" | "scheduled" | "pending" | "completed" | "failed";

const TABS: { key: StatusTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "scheduled", label: "Scheduled" },
  { key: "pending", label: "Pending" },
  { key: "completed", label: "Completed" },
  { key: "failed", label: "Failed" },
];

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    scheduled: "bg-slate-100 text-slate-700",
    pending: "bg-amber-100 text-amber-800",
    completed: "bg-emerald-100 text-emerald-800",
    ready: "bg-emerald-100 text-emerald-800",
    failed: "bg-red-100 text-red-700",
  };
  const label =
    status === "ready" ? "Completed" : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${styles[status] ?? "bg-gray-100 text-gray-700"}`}
    >
      {label}
    </span>
  );
}

function formatDate(value: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default function PdfReports() {
  const [activeTab, setActiveTab] = useState<StatusTab>("all");
  const [tasks, setTasks] = useState<PdfTask[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const loadTasks = useCallback(async () => {
    const token = localStorage.getItem("token");
    const r = await fetch(`${API_BASE}/genfiles/tasks?status=${activeTab}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return;
    const data = await r.json();
    setTasks(data.tasks ?? []);
    setTotal(data.total ?? 0);
  }, [activeTab]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadTasks().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [loadTasks]);

  useEffect(() => {
    const hasInProgress = tasks.some(t => t.status === "scheduled" || t.status === "pending");
    if (!hasInProgress) return;
    const timer = setInterval(() => {
      void loadTasks();
    }, 10000);
    return () => clearInterval(timer);
  }, [tasks, loadTasks]);

  const handleDownload = async (task: PdfTask, index = 0) => {
    setDownloadingId(task.id);
    try {
      const token = localStorage.getItem("token");
      const r = await fetch(`${API_BASE}/genfiles/tasks/${task.id}/download?index=${index}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return;
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `assessment-${task.keyword || task.externalTaskId}${task.pdfCount > 1 ? `-${index + 1}` : ""}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">PDF Reports</h1>
            <p className="text-muted-foreground">
              Track Genfiles PDF jobs. Completed reports arrive via webhook and can be downloaded here.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadTasks()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded text-sm border ${
                activeTab === tab.key
                  ? "bg-violet-600 text-white border-violet-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <Card>
          <CardHeader className="pb-3 border-b">
            <p className="text-sm text-muted-foreground">{total} report{total === 1 ? "" : "s"}</p>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keyword</TableHead>
                    <TableHead>App Nos</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.length > 0 ? (
                    tasks.map(task => (
                      <TableRow key={task.id}>
                        <TableCell className="font-medium">{task.keyword || "—"}</TableCell>
                        <TableCell>{task.appnoCount}</TableCell>
                        <TableCell>{statusBadge(task.status)}</TableCell>
                        <TableCell className="text-sm text-gray-600">{formatDate(task.createdAt)}</TableCell>
                        <TableCell className="text-sm text-gray-600">{formatDate(task.updatedAt)}</TableCell>
                        <TableCell className="text-right">
                          {task.hasDownload && (task.status === "completed" || task.status === "ready") ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={downloadingId === task.id}
                              onClick={() => void handleDownload(task)}
                            >
                              {downloadingId === task.id ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Download className="w-4 h-4 mr-2" />
                              )}
                              Download
                            </Button>
                          ) : task.status === "scheduled" || task.status === "pending" ? (
                            <span className="text-xs text-gray-500">Waiting for Genfiles…</span>
                          ) : task.status === "failed" ? (
                            <span className="text-xs text-red-600">Generation failed</span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                        No PDF reports in this category.{" "}
                        <Link href="/assessment" className="text-violet-600 hover:underline">
                          Run a phonetic search
                        </Link>{" "}
                        and use Generate PDF.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
