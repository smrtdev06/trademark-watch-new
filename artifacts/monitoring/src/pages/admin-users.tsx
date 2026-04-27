import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import {
  useListUsers,
  useCreateUser,
  useSuspendUser,
  useRestoreUser,
  useDeleteUser,
  useGetUserLimits,
  useSetUserLimit,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Heart, Lock, Unlock, Trash2, Edit } from "lucide-react";

const LIMIT_TYPES = [
  { key: "monitoringLimits", label: "Monitoring" },
  { key: "domainLimits", label: "Domain" },
  { key: "assessmentLimits", label: "Assessment" },
  { key: "imageLimits", label: "Image" },
  { key: "socialLimits", label: "Social" },
  { key: "proprietorLimits", label: "Proprietor" },
  { key: "alertLimits", label: "Alert" },
];

function AddUserModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const createUser = useCreateUser({
    mutation: {
      onSuccess: () => {
        toast({ title: "User created successfully" });
        setName("");
        setEmail("");
        setPassword("");
        onSuccess();
        onClose();
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err?.message || "Failed to create user", variant: "destructive" });
      },
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h5 className="font-semibold text-lg">Add New User</h5>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input type="text" className="w-full border rounded px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" className="w-full border rounded px-3 py-2 text-sm" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" className="w-full border rounded px-3 py-2 text-sm" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => createUser.mutate({ data: { name, email, password } as any })}
            disabled={createUser.isPending || !name || !email || password.length < 8}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {createUser.isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function LimitsModal({ open, onClose, userId }: { open: boolean; onClose: () => void; userId: number | null }) {
  const { toast } = useToast();
  const { data: limitsData, refetch } = useGetUserLimits(userId || 0, { query: { enabled: !!userId && open } });
  const setLimitMutation = useSetUserLimit({
    mutation: {
      onSuccess: () => {
        refetch();
      },
    },
  });

  const [localLimits, setLocalLimits] = useState<Record<string, string>>({});

  useEffect(() => {
    if (limitsData) {
      const ld = limitsData as any;
      const map: Record<string, string> = {};
      if (ld.limits) {
        for (const l of ld.limits) {
          map[l.name] = String(l.value);
        }
      }
      setLocalLimits(map);
    }
  }, [limitsData]);

  if (!open || !userId) return null;

  const ld = limitsData as any;
  const used = ld?.used || [];

  const getUsed = (name: string) => {
    const item = used.find((u: any) => u.name === name);
    return item ? Number(item.value) : 0;
  };

  const handleSave = async () => {
    for (const lt of LIMIT_TYPES) {
      const val = localLimits[lt.key] || "0";
      await setLimitMutation.mutateAsync({ id: userId, data: { name: lt.key, value: parseInt(val) || 0 } as any });
    }
    toast({ title: "Limits saved" });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h5 className="font-semibold text-lg">User Limits</h5>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-medium text-gray-600">Type</th>
                <th className="text-left py-2 font-medium text-gray-600">Used</th>
                <th className="text-left py-2 font-medium text-gray-600">Limit</th>
              </tr>
            </thead>
            <tbody>
              {LIMIT_TYPES.map((lt) => (
                <tr key={lt.key} className="border-b">
                  <td className="py-2">{lt.label}</td>
                  <td className="py-2">{getUsed(lt.label.toLowerCase())}</td>
                  <td className="py-2">
                    <input
                      type="number"
                      className="border rounded px-2 py-1 w-24 text-sm"
                      value={localLimits[lt.key] || "0"}
                      onChange={(e) => setLocalLimits({ ...localLimits, [lt.key]: e.target.value })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-50">Cancel</button>
          <button
            onClick={handleSave}
            disabled={setLimitMutation.isPending}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {setLimitMutation.isPending ? "Saving..." : "Save Limits"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [limitsUserId, setLimitsUserId] = useState<number | null>(null);

  const { data, isLoading, refetch } = useListUsers({ page, search: search || undefined } as any);
  const users = (data as any)?.data ?? [];
  const totalPages = (data as any)?.totalPages ?? 1;

  const suspendMutation = useSuspendUser({
    mutation: {
      onSuccess: () => { toast({ title: "User suspended" }); refetch(); },
    },
  });
  const restoreMutation = useRestoreUser({
    mutation: {
      onSuccess: () => { toast({ title: "User restored" }); refetch(); },
    },
  });
  const deleteMutation = useDeleteUser({
    mutation: {
      onSuccess: () => { toast({ title: "User deleted" }); refetch(); },
    },
  });

  const handleDelete = (userId: number) => {
    if (window.confirm("Are you sure?")) {
      deleteMutation.mutate({ id: userId });
    }
  };

  return (
    <Layout>
      <div className="row page-title mb-3 flex items-center justify-between">
        <h4 className="text-xl font-semibold">Manage Users</h4>
        <button
          onClick={() => setAddOpen(true)}
          className="btn bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />Add
        </button>
      </div>

      <div className="bg-white rounded shadow-sm border p-3">
        <div className="mb-3">
          <input
            type="text"
            placeholder="Search..."
            className="border rounded px-3 py-1.5 text-sm w-64"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500" style={{ width: "280px" }}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.length === 0 ? (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-500">No users found</td></tr>
                ) : users.map((u: any) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{u.name}</td>
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => setLimitsUserId(u.id)}
                          className="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1.5 rounded text-xs"
                          title="Limits"
                        >
                          <Heart className="w-4 h-4" />
                        </button>
                        {u.deletedAt ? (
                          <button
                            onClick={() => restoreMutation.mutate({ id: u.id })}
                            className="bg-green-500 hover:bg-green-600 text-white px-2 py-1.5 rounded text-xs"
                            title="Restore"
                          >
                            <Unlock className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => suspendMutation.mutate({ id: u.id })}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1.5 rounded text-xs"
                            title="Suspend"
                          >
                            <Lock className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(u.id)}
                          className="bg-red-500 hover:bg-red-600 text-white px-2 py-1.5 rounded text-xs"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <Link
                          href={`/user/list/${u.id}`}
                          className="inline-flex bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1.5 rounded text-xs"
                          title="User details (group, suspend, etc.)"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t mt-2">
            <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 border rounded text-sm disabled:opacity-50">Previous</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1 border rounded text-sm disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>

      <AddUserModal open={addOpen} onClose={() => setAddOpen(false)} onSuccess={() => refetch()} />
      <LimitsModal open={!!limitsUserId} onClose={() => setLimitsUserId(null)} userId={limitsUserId} />
    </Layout>
  );
}
