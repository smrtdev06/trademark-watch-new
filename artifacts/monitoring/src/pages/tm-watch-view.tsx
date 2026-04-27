import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import {
  useListMonitoringResults,
  useGetMonitoringFilters,
  useToggleMonitoringResultFavorite,
  ListMonitoringResultsSortBy,
  ListMonitoringResultsSortDir,
} from "@workspace/api-client-react";
import type { ListMonitoringResultsParams } from "@workspace/api-client-react";
import { Loader2, Star, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Overrides PopoverContent default `w-72` (288px) so panel matches PHP ~20rem without horizontal overflow. */
const FILTER_POPOVER_BOX =
  "w-[min(100vw-2rem,20rem)] max-w-[min(100vw-2rem,20rem)] border border-gray-200 bg-white shadow-md";

const FILTER_INPUT_CLASS = cn(
  "h-9 w-full text-sm shadow-none",
  "border-gray-300 bg-white placeholder:text-gray-400",
  "focus-visible:border-sky-950 focus-visible:ring-1 focus-visible:ring-sky-950",
);

type SortKey = NonNullable<ListMonitoringResultsParams["sortBy"]>;

type FilterMenuId =
  | "keyword"
  | "country"
  | "conflict"
  | "appno"
  | "class"
  | "journal"
  | "client"
  | "score";

const SORT_COLUMNS: { key: SortKey; label: string }[] = [
  { key: ListMonitoringResultsSortBy.sourceKeyword, label: "Keyword" },
  { key: ListMonitoringResultsSortBy.country, label: "Source Country" },
  { key: ListMonitoringResultsSortBy.conflict, label: "Conflict" },
  { key: ListMonitoringResultsSortBy.appno, label: "App#" },
  { key: ListMonitoringResultsSortBy.class, label: "Class" },
  { key: ListMonitoringResultsSortBy.journalDate, label: "Journal" },
  { key: ListMonitoringResultsSortBy.client, label: "Client" },
  { key: ListMonitoringResultsSortBy.score, label: "Score" },
];

function defaultSortDir(key: SortKey): typeof ListMonitoringResultsSortDir.asc | typeof ListMonitoringResultsSortDir.desc {
  if (key === ListMonitoringResultsSortBy.journalDate || key === ListMonitoringResultsSortBy.score) {
    return ListMonitoringResultsSortDir.desc;
  }
  return ListMonitoringResultsSortDir.asc;
}

function sortBadgeText(sortDir: string, label: string): string {
  const z = sortDir === ListMonitoringResultsSortDir.desc ? "Z-A" : "A-Z";
  return `${label}: ${z}`;
}

/** PHP `longest_common_substring` + bold when length >= min(len a, len b). */
function longestCommonSubstring(a: string, b: string): string {
  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();
  let best = "";
  for (let i = 0; i < s1.length; i++) {
    for (let j = 0; j < s2.length; j++) {
      let k = 0;
      while (i + k < s1.length && j + k < s2.length && s1[i + k] === s2[j + k]) k++;
      if (k > best.length) best = s1.slice(i, i + k);
    }
  }
  return best;
}

function ConflictCell({ sourceKeyword, conflictText }: { sourceKeyword: string; conflictText: string }) {
  const hl = longestCommonSubstring(sourceKeyword, conflictText);
  const shortest = Math.min(sourceKeyword.length, conflictText.length);
  const use = hl.length > 0 && hl.length >= shortest ? hl : "";
  if (!use) return <span className="break-words">{conflictText}</span>;
  const idx = conflictText.toLowerCase().indexOf(use.toLowerCase());
  if (idx < 0) return <span className="break-words">{conflictText}</span>;
  return (
    <span className="break-words">
      {conflictText.slice(0, idx)}
      <strong className="font-semibold text-gray-900">{conflictText.slice(idx, idx + use.length)}</strong>
      {conflictText.slice(idx + use.length)}
    </span>
  );
}

function FilterListPanel({
  options,
  selected,
  onToggle,
  searchPlaceholder = "Search...",
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  searchPlaceholder?: string;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return options;
    return options.filter((o) => o.label.toLowerCase().includes(n) || o.value.toLowerCase().includes(n));
  }, [options, q]);

  return (
    <div className="min-w-0 w-full overflow-hidden">
      <div className="border-b border-gray-100 px-2 pb-2 pt-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={searchPlaceholder}
          className={FILTER_INPUT_CLASS}
          autoComplete="off"
          autoFocus
        />
      </div>
      <ScrollArea className="h-[200px] w-full">
        <ul className="p-1.5 pt-1" role="listbox" aria-multiselectable="true">
          {filtered.length === 0 ? (
            <li className="px-2 py-3 text-center text-sm text-muted-foreground">No matches</li>
          ) : (
            filtered.map((opt) => {
              const isOn = selected.includes(opt.value);
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isOn}
                    className={cn(
                      "w-full rounded px-2 py-1.5 text-left text-sm transition-colors",
                      isOn ? "bg-sky-600 text-white" : "text-gray-800 hover:bg-gray-100",
                    )}
                    onClick={() => onToggle(opt.value)}
                  >
                    {opt.label}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </ScrollArea>
    </div>
  );
}

export default function TmWatchView() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [conflict, setConflict] = useState("");
  const [conflictAppno, setConflictAppno] = useState("");
  const [selCountries, setSelCountries] = useState<string[]>([]);
  const [selJournals, setSelJournals] = useState<string[]>([]);
  const [selKeywords, setSelKeywords] = useState<string[]>([]);
  const [selClasses, setSelClasses] = useState<string[]>([]);
  const [selClients, setSelClients] = useState<string[]>([]);
  const [selScores, setSelScores] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortKey>(ListMonitoringResultsSortBy.journalDate);
  const [sortDir, setSortDir] = useState<typeof ListMonitoringResultsSortDir.asc | typeof ListMonitoringResultsSortDir.desc>(
    ListMonitoringResultsSortDir.desc,
  );
  const [openFilter, setOpenFilter] = useState<FilterMenuId | null>(null);

  const { data: filtersData } = useGetMonitoringFilters();
  const filters = filtersData as {
    journals?: string[];
    countries?: string[];
    keywords?: string[];
    classes?: number[];
    clients?: { id: number; name: string }[];
    scoreOptions?: { value: number; label: string }[];
  };

  const listParams: ListMonitoringResultsParams = useMemo(
    () => ({
      page,
      search: search.trim() || undefined,
      country: selCountries.length ? selCountries.join(",") : undefined,
      journalDates: selJournals.length ? selJournals.join(",") : undefined,
      keywords: selKeywords.length ? selKeywords.join(",") : undefined,
      classFilter: selClasses.length ? selClasses.join(",") : undefined,
      clientIds: selClients.length ? selClients.join(",") : undefined,
      scores: selScores.length ? selScores.join(",") : undefined,
      conflict: conflict.trim() || undefined,
      conflictAppno: conflictAppno.trim() || undefined,
      sortBy,
      sortDir,
    }),
    [
      page,
      search,
      selCountries,
      selJournals,
      selKeywords,
      selClasses,
      selClients,
      selScores,
      conflict,
      conflictAppno,
      sortBy,
      sortDir,
    ],
  );

  const queryClient = useQueryClient();
  const { data, isLoading, queryKey } = useListMonitoringResults(listParams);
  const toggleFavorite = useToggleMonitoringResultFavorite({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey });
      },
    },
  });
  const results = (data as { data?: unknown[] })?.data ?? [];
  const totalPages = (data as { totalPages?: number })?.totalPages ?? 1;

  function onSortColumn(key: SortKey) {
    setPage(1);
    if (sortBy === key) {
      setSortDir((d: typeof ListMonitoringResultsSortDir.asc | typeof ListMonitoringResultsSortDir.desc) =>
        d === ListMonitoringResultsSortDir.asc ? ListMonitoringResultsSortDir.desc : ListMonitoringResultsSortDir.asc,
      );
    } else {
      setSortBy(key);
      setSortDir(defaultSortDir(key));
    }
  }

  function clearSort() {
    setSortBy(ListMonitoringResultsSortBy.journalDate);
    setSortDir(ListMonitoringResultsSortDir.desc);
    setPage(1);
  }

  function resetFilters() {
    setSearch("");
    setConflict("");
    setConflictAppno("");
    setSelCountries([]);
    setSelJournals([]);
    setSelKeywords([]);
    setSelClasses([]);
    setSelClients([]);
    setSelScores([]);
    setSortBy(ListMonitoringResultsSortBy.journalDate);
    setSortDir(ListMonitoringResultsSortDir.desc);
    setPage(1);
  }

  const scoreOptions = filters?.scoreOptions ?? [
    { value: 100, label: "Very High" },
    { value: 90, label: "High" },
    { value: 80, label: "Medium" },
    { value: 70, label: "Low" },
  ];

  const scoreLabel = (v: string) => scoreOptions.find((s) => String(s.value) === v)?.label ?? v;

  const sortLabel = SORT_COLUMNS.find((c) => c.key === sortBy)?.label ?? "Journal";
  const badgeText = sortBadgeText(sortDir, sortLabel);

  const keywordOptions = useMemo(
    () => (filters?.keywords ?? []).map((k: string) => ({ value: k, label: k })),
    [filters?.keywords],
  );
  const countryOptions = useMemo(
    () => (filters?.countries ?? []).map((c: string) => ({ value: c, label: c })),
    [filters?.countries],
  );
  const classOptions = useMemo(
    () => (filters?.classes ?? []).map((c: number) => ({ value: String(c), label: String(c) })),
    [filters?.classes],
  );
  const journalOptions = useMemo(
    () => (filters?.journals ?? []).map((j: string) => ({ value: j, label: j })),
    [filters?.journals],
  );
  const clientOptions = useMemo(
    () => (filters?.clients ?? []).map((c: { id: number; name: string }) => ({ value: String(c.id), label: c.name })),
    [filters?.clients],
  );
  const scoreOpts = useMemo(
    () => scoreOptions.map((s) => ({ value: String(s.value), label: s.label })),
    [scoreOptions],
  );

  function toggleIn(setter: Dispatch<SetStateAction<string[]>>, value: string) {
    setter((prev) => {
      const next = prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value];
      return next;
    });
    setPage(1);
  }

  function filterOpen(id: FilterMenuId) {
    return openFilter === id;
  }
  function filterOnOpen(id: FilterMenuId, open: boolean) {
    setOpenFilter(open ? id : null);
  }

  /** Reset nested search when switching filter popover (panel remounts via key). */
  const filterPanelKey = openFilter ?? "closed";

  const chips: { id: string; text: string; onRemove: () => void }[] = [];
  for (const k of selKeywords) {
    chips.push({
      id: `kw-${k}`,
      text: `Keyword: ${k}`,
      onRemove: () => {
        setSelKeywords((xs) => xs.filter((x) => x !== k));
        setPage(1);
      },
    });
  }
  for (const c of selCountries) {
    chips.push({
      id: `ct-${c}`,
      text: `Country: ${c}`,
      onRemove: () => {
        setSelCountries((xs) => xs.filter((x) => x !== c));
        setPage(1);
      },
    });
  }
  for (const cls of selClasses) {
    chips.push({
      id: `cl-${cls}`,
      text: `Class: ${cls}`,
      onRemove: () => {
        setSelClasses((xs) => xs.filter((x) => x !== cls));
        setPage(1);
      },
    });
  }
  for (const j of selJournals) {
    chips.push({
      id: `j-${j}`,
      text: `Journal: ${j}`,
      onRemove: () => {
        setSelJournals((xs) => xs.filter((x) => x !== j));
        setPage(1);
      },
    });
  }
  for (const idStr of selClients) {
    const id = Number(idStr);
    const name = filters?.clients?.find((c) => c.id === id)?.name ?? idStr;
    chips.push({
      id: `cli-${idStr}`,
      text: `Client: ${name}`,
      onRemove: () => {
        setSelClients((xs) => xs.filter((x) => x !== idStr));
        setPage(1);
      },
    });
  }
  for (const sc of selScores) {
    chips.push({
      id: `sc-${sc}`,
      text: `Score: ${scoreLabel(sc)}`,
      onRemove: () => {
        setSelScores((xs) => xs.filter((x) => x !== sc));
        setPage(1);
      },
    });
  }
  if (conflict.trim()) {
    const v = conflict.trim();
    chips.push({
      id: "conflict",
      text: `Conflict: ${v}`,
      onRemove: () => {
        setConflict("");
        setPage(1);
      },
    });
  }
  if (conflictAppno.trim()) {
    const v = conflictAppno.trim();
    chips.push({
      id: "appno",
      text: `App#: ${v}`,
      onRemove: () => {
        setConflictAppno("");
        setPage(1);
      },
    });
  }

  function hasFilterActive(id: FilterMenuId): boolean {
    switch (id) {
      case "keyword":
        return selKeywords.length > 0;
      case "country":
        return selCountries.length > 0;
      case "conflict":
        return conflict.trim().length > 0;
      case "appno":
        return conflictAppno.trim().length > 0;
      case "class":
        return selClasses.length > 0;
      case "journal":
        return selJournals.length > 0;
      case "client":
        return selClients.length > 0;
      case "score":
        return selScores.length > 0;
      default:
        return false;
    }
  }

  return (
    <Layout>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xl font-semibold">View TM Watch</h4>
        <Link
          href="/tm-watch/export"
          className="rounded border border-sky-600 bg-sky-50 px-3 py-1.5 text-sm text-sky-800 hover:bg-sky-100"
        >
          Export
        </Link>
      </div>

      <div className="mb-4 rounded border bg-white p-4 shadow-sm">

        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-600">
          <Popover open={filterOpen("keyword")} onOpenChange={(o) => filterOnOpen("keyword", o)}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-0.5 border-b border-transparent pb-0.5 hover:text-gray-900",
                  hasFilterActive("keyword") && "font-medium text-sky-800",
                )}
              >
                Keyword
                <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className={cn(FILTER_POPOVER_BOX, "overflow-hidden p-0")}
              align="start"
              sideOffset={6}
              collisionPadding={12}
            >
              <div key={`${filterPanelKey}-kw`}>
                <FilterListPanel
                  options={keywordOptions}
                  selected={selKeywords}
                  onToggle={(v) => toggleIn(setSelKeywords, v)}
                />
              </div>
            </PopoverContent>
          </Popover>

          <Popover open={filterOpen("country")} onOpenChange={(o) => filterOnOpen("country", o)}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-0.5 border-b border-transparent pb-0.5 hover:text-gray-900",
                  hasFilterActive("country") && "font-medium text-sky-800",
                )}
              >
                Source Country
                <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className={cn(FILTER_POPOVER_BOX, "overflow-hidden p-0")}
              align="start"
              sideOffset={6}
              collisionPadding={12}
            >
              <div key={`${filterPanelKey}-ct`}>
                <FilterListPanel
                  options={countryOptions}
                  selected={selCountries}
                  onToggle={(v) => toggleIn(setSelCountries, v)}
                />
              </div>
            </PopoverContent>
          </Popover>

          <Popover open={filterOpen("conflict")} onOpenChange={(o) => filterOnOpen("conflict", o)}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-0.5 border-b border-transparent pb-0.5 hover:text-gray-900",
                  hasFilterActive("conflict") && "font-medium text-sky-800",
                )}
              >
                Conflict
                <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className={cn(FILTER_POPOVER_BOX, "p-3")}
              align="start"
              sideOffset={6}
              collisionPadding={12}
            >
              <label className="mb-1.5 block text-xs font-medium text-gray-600">Conflict name contains</label>
              <Input
                value={conflict}
                onChange={(e) => {
                  setConflict(e.target.value);
                  setPage(1);
                }}
                placeholder="Search..."
                className={FILTER_INPUT_CLASS}
                autoFocus
              />
            </PopoverContent>
          </Popover>

          <Popover open={filterOpen("appno")} onOpenChange={(o) => filterOnOpen("appno", o)}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-0.5 border-b border-transparent pb-0.5 hover:text-gray-900",
                  hasFilterActive("appno") && "font-medium text-sky-800",
                )}
              >
                App#
                <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className={cn(FILTER_POPOVER_BOX, "p-3")}
              align="start"
              sideOffset={6}
              collisionPadding={12}
            >
              <label className="mb-1.5 block text-xs font-medium text-gray-600">Application number</label>
              <Input
                value={conflictAppno}
                onChange={(e) => {
                  setConflictAppno(e.target.value);
                  setPage(1);
                }}
                placeholder="Search..."
                className={FILTER_INPUT_CLASS}
                autoFocus
              />
            </PopoverContent>
          </Popover>

          <Popover open={filterOpen("class")} onOpenChange={(o) => filterOnOpen("class", o)}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-0.5 border-b border-transparent pb-0.5 hover:text-gray-900",
                  hasFilterActive("class") && "font-medium text-sky-800",
                )}
              >
                Class
                <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className={cn(FILTER_POPOVER_BOX, "overflow-hidden p-0")}
              align="start"
              sideOffset={6}
              collisionPadding={12}
            >
              <div key={`${filterPanelKey}-cl`}>
                <FilterListPanel
                  options={classOptions}
                  selected={selClasses}
                  onToggle={(v) => toggleIn(setSelClasses, v)}
                />
              </div>
            </PopoverContent>
          </Popover>

          <Popover open={filterOpen("journal")} onOpenChange={(o) => filterOnOpen("journal", o)}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-0.5 border-b border-transparent pb-0.5 hover:text-gray-900",
                  hasFilterActive("journal") && "font-medium text-sky-800",
                )}
              >
                Journal
                <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className={cn(FILTER_POPOVER_BOX, "overflow-hidden p-0")}
              align="start"
              sideOffset={6}
              collisionPadding={12}
            >
              <div key={`${filterPanelKey}-j`}>
                <FilterListPanel
                  options={journalOptions}
                  selected={selJournals}
                  onToggle={(v) => toggleIn(setSelJournals, v)}
                />
              </div>
            </PopoverContent>
          </Popover>

          <Popover open={filterOpen("client")} onOpenChange={(o) => filterOnOpen("client", o)}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-0.5 border-b border-transparent pb-0.5 hover:text-gray-900",
                  hasFilterActive("client") && "font-medium text-sky-800",
                )}
              >
                Client
                <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className={cn(FILTER_POPOVER_BOX, "overflow-hidden p-0")}
              align="start"
              sideOffset={6}
              collisionPadding={12}
            >
              <div key={`${filterPanelKey}-cli`}>
                <FilterListPanel
                  options={clientOptions}
                  selected={selClients}
                  onToggle={(v) => toggleIn(setSelClients, v)}
                />
              </div>
            </PopoverContent>
          </Popover>

          <Popover open={filterOpen("score")} onOpenChange={(o) => filterOnOpen("score", o)}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-0.5 border-b border-transparent pb-0.5 hover:text-gray-900",
                  hasFilterActive("score") && "font-medium text-sky-800",
                )}
              >
                Score
                <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className={cn(FILTER_POPOVER_BOX, "overflow-hidden p-0")}
              align="start"
              sideOffset={6}
              collisionPadding={12}
            >
              <div key={`${filterPanelKey}-sc`}>
                <FilterListPanel
                  options={scoreOpts}
                  selected={selScores}
                  onToggle={(v) => toggleIn(setSelScores, v)}
                />
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {chips.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {chips.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1 rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-sm text-gray-800"
              >
                {c.text}
                <button
                  type="button"
                  className="font-medium text-red-600 hover:text-red-800"
                  aria-label={`Remove ${c.text}`}
                  onClick={c.onRemove}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1 rounded bg-sky-100 px-2.5 py-1 font-medium text-sky-900">
            {badgeText}
            <button
              type="button"
              className="ml-0.5 rounded p-0.5 hover:bg-sky-200"
              aria-label="Clear sort"
              onClick={clearSort}
            >
              ×
            </button>
          </span>
          <button type="button" className="text-sky-700 underline hover:text-sky-900" onClick={clearSort}>
            Clear
          </button>
        </div>

        <label className="mb-3 block">
          <span className="sr-only">Search</span>
          <Input
            type="text"
            className="text-sm"
            placeholder="Search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>

        <div className="mb-1">
          <button
            type="button"
            onClick={resetFilters}
            className="rounded border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            Clear filters
          </button>
        </div>
      </div>

      <div className="rounded border bg-white shadow-sm">
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  {SORT_COLUMNS.map(({ key, label }) => {
                    const active = sortBy === key;
                    return (
                      <th key={key} className="px-3 py-3 text-left font-semibold text-gray-800">
                        <button
                          type="button"
                          onClick={() => onSortColumn(key)}
                          className="inline-flex items-center gap-1 hover:text-sky-800"
                        >
                          {label}
                          <span className="text-xs font-normal text-gray-500" aria-hidden>
                            {active ? (sortDir === ListMonitoringResultsSortDir.desc ? "↓" : "↑") : "↑↓"}
                          </span>
                        </button>
                      </th>
                    );
                  })}
                  <th className="px-3 py-3 text-left font-semibold text-gray-800">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {results.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                      No results found
                    </td>
                  </tr>
                ) : (
                  (results as Record<string, unknown>[]).map((r) => {
                    const rowId = Number(r.id);
                    const sourceKeyword = String(r.sourceKeyword ?? r.keyword ?? "");
                    const rowKeywordForHighlight = String(r.keyword ?? "");
                    const tm = String(r.tmAppliedFor ?? "");
                    const jUrl = r.journalCopyUrl as string | undefined;
                    const jDate = r.journalDate != null ? String(r.journalDate) : "";
                    const scoreLbl = String(r.scoreLabel ?? "").trim();
                    const cls = String(r.conflictClassDisplay ?? r.conflictClass ?? "");
                    const isFav = Boolean(r.favorite);
                    const favPending =
                      toggleFavorite.isPending && toggleFavorite.variables?.id === rowId;
                    return (
                      <tr key={String(r.id)} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{sourceKeyword}</td>
                        <td className="px-3 py-2">{r.country != null ? String(r.country) : "—"}</td>
                        <td className="px-3 py-2">
                          <ConflictCell sourceKeyword={rowKeywordForHighlight || sourceKeyword} conflictText={tm || "—"} />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{r.appno != null ? String(r.appno) : "—"}</td>
                        <td className="px-3 py-2">{cls || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {jUrl ? (
                            <a
                              href={jUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sky-600 underline hover:text-sky-800"
                            >
                              {jDate || "Journal"}
                            </a>
                          ) : (
                            jDate || "—"
                          )}
                        </td>
                        <td className="px-3 py-2">{r.clientName != null ? String(r.clientName) : "—"}</td>
                        <td className="px-3 py-2">{scoreLbl || "—"}</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            title="Favorite"
                            aria-pressed={isFav}
                            aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
                            disabled={favPending}
                            onClick={() => toggleFavorite.mutate({ id: rowId })}
                            className={cn(
                              "rounded border p-1.5 transition-colors",
                              isFav
                                ? "border-amber-400 bg-amber-100 text-amber-800 hover:bg-amber-200"
                                : "border-sky-600 bg-sky-50 text-sky-800 hover:bg-sky-100",
                            )}
                          >
                            <Star className={cn("h-4 w-4", isFav && "fill-current")} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <span className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded border px-3 py-1 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded border px-3 py-1 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
