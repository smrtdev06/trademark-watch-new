import { useMemo, useState, useCallback } from "react";
import { Layout } from "@/components/layout";
import {
  useListGroups,
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
} from "@workspace/api-client-react";
import { getDefaultMenuPermissions, getAllMenuKeys, mainMenu } from "@/lib/menuDef";
import type { Group } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";

type MenuDefNode = (typeof mainMenu)[number];

function buildLabelForKey(k: string): string {
  function walk(nodes: typeof mainMenu): string | null {
    for (const n of nodes) {
      if (n.type === "link" && n.key === k) return n.label;
      if (n.type === "parent" && n.key === k) return n.label;
      if (n.type === "parent") {
        for (const c of n.children) {
          if (c.type === "link" && c.key === k) {
            return `${n.label} → ${c.label}`;
          }
        }
        const d = walk(n.children as any);
        if (d) return d;
      }
    }
    return null;
  }
  return walk(mainMenu) ?? k;
}

function renderMenuTree(
  nodes: readonly MenuDefNode[],
  perms: Record<string, boolean>,
  setPerm: (key: string, v: boolean) => void,
  depth: number,
) {
  return (
    <div className={depth ? "ml-4 mt-1 space-y-1 border-l pl-2" : "space-y-2"}>
      {nodes.map((n) => {
        if (n.type === "link") {
          return (
            <label key={n.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={perms[n.key] !== false}
                onChange={(e) => setPerm(n.key, e.target.checked)}
              />
              <span>{n.label}</span>
            </label>
          );
        }
        return (
          <div key={n.key}>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
              <input
                type="checkbox"
                checked={perms[n.key] !== false}
                onChange={(e) => setPerm(n.key, e.target.checked)}
              />
              <span>{n.label} (entire section)</span>
            </label>
            {renderMenuTree(n.children, perms, setPerm, depth + 1)}
          </div>
        );
      })}
    </div>
  );
}

function mergeWithDefaults(loaded: Record<string, boolean> | undefined) {
  const d = getDefaultMenuPermissions();
  if (!loaded) return d;
  for (const k of getAllMenuKeys()) {
    d[k] = Object.prototype.hasOwnProperty.call(loaded, k) ? (loaded as any)[k] : true;
  }
  return d;
}

export default function AdminGroups() {
  const { toast } = useToast();
  const { data, isLoading, refetch } = useListGroups();
  const groups: Group[] = useMemo(
    () => (Array.isArray(data) ? data : []) as Group[],
    [data],
  );

  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<Group | null>(null);
  const [name, setName] = useState("");
  const [perms, setPerms] = useState<Record<string, boolean>>(() => getDefaultMenuPermissions());
  const [deleting, setDeleting] = useState<Group | null>(null);

  const createM = useCreateGroup({
    mutation: {
      onSuccess: () => {
        toast({ title: "Group created" });
        setModal(null);
        refetch();
      },
      onError: (e: any) => toast({ title: e?.message || "Error", variant: "destructive" }),
    },
  });
  const updateM = useUpdateGroup({
    mutation: {
      onSuccess: () => {
        toast({ title: "Group updated" });
        setModal(null);
        setEditing(null);
        refetch();
      },
      onError: (e: any) => toast({ title: e?.message || "Error", variant: "destructive" }),
    },
  });
  const deleteM = useDeleteGroup({
    mutation: {
      onSuccess: () => {
        toast({ title: "Group deleted" });
        setDeleting(null);
        refetch();
      },
      onError: (e: any) => toast({ title: e?.message || "Error", variant: "destructive" }),
    },
  });

  const setPerm = useCallback((key: string, v: boolean) => {
    setPerms((p) => ({ ...p, [key]: v }));
  }, []);

  const openCreate = () => {
    setName("");
    setPerms(getDefaultMenuPermissions());
    setModal("create");
  };

  const openEdit = (g: Group) => {
    setEditing(g);
    setName(g.name);
    setPerms(mergeWithDefaults(g.menuPermissions as Record<string, boolean> | undefined));
    setModal("edit");
  };

  const save = () => {
    const n = name.trim();
    if (!n) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (modal === "create") {
      createM.mutate({ data: { name: n, menuPermissions: perms } });
    } else if (editing) {
      updateM.mutate({ id: editing.id, data: { name: n, menuPermissions: perms } });
    }
  };

  return (
    <Layout>
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h4 className="text-xl font-semibold">Groups (menu access)</h4>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded text-sm"
        >
          <Plus className="w-4 h-4" /> Add group
        </button>
      </div>
      <div className="bg-white rounded shadow-sm border">
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">#</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Menus (hidden from list if unchecked)</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {groups.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      No groups — create one to control user menu access.
                    </td>
                  </tr>
                ) : (
                  groups.map((g) => (
                    <tr key={g.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{g.id}</td>
                      <td className="px-4 py-3 font-medium">{g.name}</td>
                      <td className="px-4 py-3 text-xs text-gray-600 max-w-md">
                        {Object.entries(mergeWithDefaults(g.menuPermissions as any))
                          .filter(([, on]) => on === false)
                          .map(([k]) => buildLabelForKey(k))
                          .join(", ") || "— all visible —"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded mr-1"
                          onClick={() => openEdit(g)}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          onClick={() => setDeleting(g)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-4">
            <div className="flex justify-between items-center mb-3">
              <h5 className="text-lg font-semibold">{modal === "create" ? "New group" : "Edit group"}</h5>
              <button type="button" onClick={() => setModal(null)} className="p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <label className="block text-sm text-gray-600 mb-1">Name</label>
            <input
              className="w-full border rounded px-2 py-1.5 text-sm mb-3"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-sm text-gray-600 mb-2">Menu visibility (unchecked = hidden)</p>
            {renderMenuTree(mainMenu, perms, setPerm, 0)}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="px-3 py-1.5 text-sm border rounded" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded"
                onClick={save}
                disabled={createM.isPending || updateM.isPending}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow p-4 max-w-sm w-full">
            <p className="text-sm mb-3">Delete group &ldquo;{deleting.name}&rdquo;? Users in this group will be unlinked.</p>
            <div className="flex justify-end gap-2">
              <button type="button" className="px-3 py-1.5 text-sm border rounded" onClick={() => setDeleting(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded"
                onClick={() => deleteM.mutate({ id: deleting.id })}
                disabled={deleteM.isPending}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
