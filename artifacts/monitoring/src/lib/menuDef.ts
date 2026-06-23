/**
 * Single source of truth for main nav items and permission keys (group feature).
 * Parent keys (e.g. "alerts") control the whole section; child keys are optional overrides.
 *
 * Keep `getAllMenuKeys()` in sync with `artifacts/api-server/src/lib/menuKeys.ts` (admin default allow list on auth).
 */
export type MenuDef =
  | { type: "link"; key: string; label: string; href: string }
  | { type: "parent"; key: string; label: string; children: MenuDef[] };

export const mainMenu: MenuDef[] = [
  { type: "link", key: "home", label: "Home", href: "/" },
  {
    type: "parent",
    key: "alerts",
    label: "Alerts",
    children: [
      { type: "link", key: "alerts.add", label: "Add", href: "/alerts" },
      { type: "link", key: "alerts.list", label: "List", href: "/alerts/list" },
      { type: "link", key: "alerts.results", label: "Results", href: "/alerts/results" },
    ],
  },
  {
    type: "parent",
    key: "search",
    label: "Search",
    children: [
      { type: "link", key: "search.assessment", label: "New Trademark", href: "/assessment" },
      { type: "link", key: "search.pdf_reports", label: "PDF Reports", href: "/pdf-reports" },
      { type: "link", key: "search.license", label: "License", href: "/license" },
      { type: "link", key: "search.opposition", label: "Oppositions", href: "/search_opposition" },
      { type: "link", key: "search.proprietor", label: "Proprietor", href: "/proprietor" },
      { type: "link", key: "search.b2b", label: "B2B/B2C", href: "/search" },
    ],
  },
  {
    type: "parent",
    key: "social_watch",
    label: "Social Watch",
    children: [
      { type: "link", key: "social_watch.list", label: "List/Add", href: "/social-watch/list" },
      { type: "link", key: "social_watch.results", label: "Results", href: "/social-watch/results" },
    ],
  },
  {
    type: "parent",
    key: "domain_monitoring",
    label: "Domain Monitoring",
    children: [
      { type: "link", key: "domain_monitoring.list", label: "List/Add", href: "/domain-monitoring" },
      { type: "link", key: "domain_monitoring.results", label: "Results", href: "/domain-monitoring/results" },
    ],
  },
  {
    type: "parent",
    key: "tm_watch",
    label: "TM Watch",
    children: [
      { type: "link", key: "tm_watch.add", label: "Add New", href: "/tm-watch/add" },
      { type: "link", key: "tm_watch.import", label: "Import", href: "/tm-watch/import" },
      { type: "link", key: "tm_watch.import_failed", label: "Import Failed", href: "/tm-watch/import-failed" },
      { type: "link", key: "tm_watch.list", label: "My Keywords", href: "/tm-watch/list" },
      { type: "link", key: "tm_watch.view", label: "View Results", href: "/tm-watch/view" },
      { type: "link", key: "tm_watch.export", label: "Export Results", href: "/tm-watch/export" },
    ],
  },
  {
    type: "parent",
    key: "logo_search",
    label: "Logo Search",
    children: [
      { type: "link", key: "logo_search.view", label: "View", href: "/logo" },
      { type: "link", key: "logo_search.add", label: "Add", href: "/logo/add" },
      { type: "link", key: "logo_search.results", label: "Results", href: "/logo/results" },
    ],
  },
  {
    type: "parent",
    key: "image_watch",
    label: "Image Watch",
    children: [
      { type: "link", key: "image_watch.view", label: "View", href: "/image-watch" },
      { type: "link", key: "image_watch.import", label: "Import", href: "/image-watch/import" },
    ],
  },
  { type: "link", key: "files", label: "Files", href: "/files" },
  { type: "link", key: "contacts", label: "Clients", href: "/user/contacts" },
];

/** All keys in display order, for default permissions (all true) and admin form. */
export function getAllMenuKeys(): string[] {
  const out: string[] = [];
  function walk(nodes: MenuDef[]) {
    for (const n of nodes) {
      if (n.type === "link") {
        out.push(n.key);
      } else {
        out.push(n.key);
        walk(n.children);
      }
    }
  }
  walk(mainMenu);
  return out;
}

function defaultAllTrue(): Record<string, boolean> {
  return Object.fromEntries(getAllMenuKeys().map((k) => [k, true])) as Record<string, boolean>;
}

export function getDefaultMenuPermissions(): Record<string, boolean> {
  return defaultAllTrue();
}

type LayoutMenuItem = {
  key: string;
  label: string;
  href?: string;
  children?: LayoutMenuItem[];
  adminOnly?: boolean;
};

function permAllows(key: string, perms: Record<string, boolean> | null | undefined): boolean {
  if (perms == null) return true;
  return perms[key] !== false;
}

/** If parent is hidden, children are hidden; if parent is shown, children are filtered by their keys. */
function filterNode(node: MenuDef, perms: Record<string, boolean> | null | undefined): MenuDef | null {
  if (node.type === "link") {
    if (!permAllows(node.key, perms)) return null;
    return node;
  }
  if (!permAllows(node.key, perms)) return null;
  const children = node.children.map((c) => filterNode(c, perms)).filter(Boolean) as MenuDef[];
  if (children.length === 0) return null;
  return { type: "parent", key: node.key, label: node.label, children };
}

export function filterMainMenuByPermissions(
  perms: Record<string, boolean> | null | undefined,
): MenuDef[] {
  return mainMenu
    .map((n) => filterNode(n, perms))
    .filter(Boolean) as MenuDef[];
}

export function toLayoutMenuItem(def: MenuDef): LayoutMenuItem {
  if (def.type === "link") {
    return { key: def.key, label: def.label, href: def.href };
  }
  return {
    key: def.key,
    label: def.label,
    children: def.children.map(toLayoutMenuItem),
  };
}
