import { Layout } from "@/components/layout";
import { useRoute } from "wouter";
import {
  useGetUser,
  useSuspendUser,
  useRestoreUser,
  useGetUserLimits,
  useListGroups,
  useSetUserGroup,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function AdminUserDetails() {
  const { toast } = useToast();
  const [, params] = useRoute("/user/list/:id");
  const id = parseInt(String(params?.id || "0"), 10);

  const { data: user, isLoading, refetch } = useGetUser(id, {
    query: { enabled: Number.isFinite(id) && id > 0 },
  });
  const { data: limits } = useGetUserLimits(id, { query: { enabled: Number.isFinite(id) && id > 0 } });
  const { data: groups, isError: groupsLoadError } = useListGroups();

  const suspendMutation = useSuspendUser({ mutation: { onSuccess: () => { toast({ title: "User suspended" }); refetch(); } } });
  const restoreMutation = useRestoreUser({ mutation: { onSuccess: () => { toast({ title: "User restored" }); refetch(); } } });
  const setGroupM = useSetUserGroup({
    mutation: {
      onSuccess: () => {
        toast({ title: "Group updated" });
        refetch();
      },
      onError: (err: { message?: string }) => {
        toast({ title: "Could not set group", description: err?.message, variant: "destructive" });
      },
    },
  });

  if (isLoading) return <Layout><div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div></Layout>;
  if (!user) return <Layout><div className="text-center py-8 text-gray-500">User not found</div></Layout>;

  const u = user as any;

  return (
    <Layout>
      <div className="mb-4"><h4 className="text-xl font-semibold">User Details: {u.name}</h4></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded shadow-sm border p-4">
          <h5 className="font-semibold mb-3">User Information</h5>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Name:</span><span>{u.name}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Email:</span><span>{u.email}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Role:</span><span className="capitalize">{u.role}</span></div>
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center">
              <span className="text-gray-500">Group:</span>
              <select
                className="border rounded px-2 py-1 text-sm max-w-[14rem]"
                value={u.groupId != null && u.groupId !== undefined ? String(u.groupId) : ""}
                disabled={setGroupM.isPending}
                onChange={(e) => {
                  const v = e.target.value;
                  setGroupM.mutate({
                    id,
                    data: { groupId: v === "" ? null : Number(v) },
                  });
                }}
              >
                <option value="">No group (all menus)</option>
                {(Array.isArray(groups) ? groups : []).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            {groupsLoadError ? (
              <p className="text-xs text-amber-800">Could not load groups (check admin access). You may still clear the user&apos;s group with &ldquo;No group&rdquo;.</p>
            ) : null}
            {!(Array.isArray(groups) && groups.length) && !groupsLoadError ? (
              <p className="text-xs text-gray-500">Create a group under Admin → Groups, then select it here.</p>
            ) : null}
            <div className="flex justify-between"><span className="text-gray-500">Status:</span><span className={u.deletedAt ? "text-red-600" : "text-green-600"}>{u.deletedAt ? "Suspended" : "Active"}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Created:</span><span>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "-"}</span></div>
          </div>
          <div className="mt-4 flex gap-2">
            {u.deletedAt ? (
              <button onClick={() => restoreMutation.mutate({ id })} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm">Restore User</button>
            ) : (
              <button onClick={() => suspendMutation.mutate({ id })} className="bg-red-600 text-white px-3 py-1.5 rounded text-sm">Suspend User</button>
            )}
          </div>
        </div>
        <div className="bg-white rounded shadow-sm border p-4">
          <h5 className="font-semibold mb-3">Limits & Usage</h5>
          {limits ? (
            <div className="space-y-2 text-sm">
              {(limits as any)?.limits?.map((l: any) => (
                <div key={l.name} className="flex justify-between"><span className="text-gray-500 capitalize">{l.name}:</span><span>{l.value}</span></div>
              ))}
              <hr className="my-2" />
              <h6 className="font-medium text-gray-700">Current Usage</h6>
              {(limits as any)?.used?.map((u: any) => (
                <div key={u.name} className="flex justify-between"><span className="text-gray-500 capitalize">{u.name}:</span><span>{u.value}</span></div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No limits configured</p>
          )}
        </div>
      </div>
    </Layout>
  );
}
