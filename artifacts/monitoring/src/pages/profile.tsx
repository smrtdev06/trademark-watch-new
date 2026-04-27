import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGetMe, useUpdateProfile } from "@workspace/api-client-react";
import { Loader2, Save, User as UserIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Profile() {
  const { data: user, isLoading } = useGetMe();
  const updateMutation = useUpdateProfile();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    organization: "",
    designation: "",
    address1: "",
    city: "",
    country: "",
    gstNumber: "",
  });

  useEffect(() => {
    if (user?.profile) {
      setFormData({
        organization: user.profile.organization || "",
        designation: user.profile.designation || "",
        address1: user.profile.address1 || "",
        city: user.profile.city || "",
        country: user.profile.country || "",
        gstNumber: user.profile.gstNumber || "",
      });
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.id]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(
      { data: formData },
      {
        onSuccess: () => {
          toast({ title: "Profile updated", description: "Your profile has been successfully saved." });
        },
        onError: (err: any) => {
          toast({ title: "Update failed", description: err.message || "Failed to save profile", variant: "destructive" });
        }
      }
    );
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your Profile</h1>
          <p className="text-muted-foreground">Manage your personal and organizational details.</p>
        </div>

        {isLoading ? (
           <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-background shadow-sm">
                  <UserIcon className="w-10 h-10 text-primary" />
                </div>
                <h3 className="font-bold text-lg">{user?.name}</h3>
                <p className="text-muted-foreground text-sm">{user?.email}</p>
                <div className="mt-4 pt-4 border-t text-sm">
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Role</span>
                    <span className="font-medium capitalize">{user?.role}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Joined</span>
                    <span className="font-medium">{user?.createdAt ? new Date(user?.createdAt).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Profile Details</CardTitle>
                <CardDescription>Update your organization information for invoices and reports.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="organization">Organization Name</Label>
                      <Input id="organization" value={formData.organization} onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="designation">Designation</Label>
                      <Input id="designation" value={formData.designation} onChange={handleChange} />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="address1">Address</Label>
                    <Input id="address1" value={formData.address1} onChange={handleChange} />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input id="city" value={formData.city} onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Input id="country" value={formData.country} onChange={handleChange} />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="gstNumber">GST/Tax Number</Label>
                    <Input id="gstNumber" value={formData.gstNumber} onChange={handleChange} />
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={updateMutation.isPending}>
                      {updateMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Save Changes
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
