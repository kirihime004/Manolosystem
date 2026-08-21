import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { getFunctionErrorMessage } from "@/lib/supabase/functionError";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Company, ModuleKey } from "@/types/database";

const MODULE_LABELS: Record<ModuleKey, string> = {
  IT: "IT",
  HR: "HR",
  FINANCE: "Finance",
  ADMIN: "Administration",
  PRODUCTION: "Production Management",
};

export function CompanyDetailSheet({
  company,
  open,
  onOpenChange,
}: {
  company: Company | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const modulesQuery = useQuery({
    queryKey: ["company-modules", company?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_modules")
        .select("*")
        .eq("company_id", company!.id)
        .order("module_key");
      if (error) throw error;
      return data;
    },
    enabled: !!company,
  });

  const toggleModule = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("company_modules")
        .update({ enabled })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-modules", company?.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const [name, setName] = useState(company?.name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    setName(company?.name ?? "");
  }, [company?.id, company?.name]);

  const handleSaveName = async () => {
    if (!company || !name.trim() || name.trim() === company.name) return;
    setSavingName(true);
    const { error } = await supabase.from("companies").update({ name: name.trim() }).eq("id", company.id);
    setSavingName(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Company name updated");
    queryClient.invalidateQueries({ queryKey: ["platform-companies"] });
  };

  const handleUploadLogo = async (file: File) => {
    if (!company) return;
    setUploadingLogo(true);

    const ext = file.name.split(".").pop();
    const path = `${company.id}/logo-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("company-logos").upload(path, file, {
      upsert: true,
    });

    if (uploadError) {
      setUploadingLogo(false);
      toast.error(uploadError.message);
      return;
    }

    const { data: publicUrl } = supabase.storage.from("company-logos").getPublicUrl(path);

    const { error: updateError } = await supabase
      .from("companies")
      .update({ logo_url: publicUrl.publicUrl })
      .eq("id", company.id);

    setUploadingLogo(false);

    if (updateError) {
      toast.error(updateError.message);
      return;
    }

    toast.success("Logo updated");
    queryClient.invalidateQueries({ queryKey: ["platform-companies"] });
  };

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [inviting, setInviting] = useState(false);

  const handleInviteAdmin = async (e: FormEvent) => {
    e.preventDefault();
    if (!company) return;
    setInviting(true);

    const { data: adminRole } = await supabase
      .from("roles")
      .select("id")
      .eq("company_id", company.id)
      .eq("name", "Admin")
      .maybeSingle();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const { error } = await supabase.functions.invoke("invite-user", {
      body: {
        companyId: company.id,
        email,
        firstName,
        lastName,
        roleIds: adminRole ? [adminRole.id] : [],
        redirectTo: `${window.location.origin}/accept-invite`,
      },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });

    setInviting(false);

    if (error) {
      toast.error(await getFunctionErrorMessage(error));
      return;
    }

    toast.success(`Invitation sent to ${email}`);
    setEmail("");
    setFirstName("");
    setLastName("");
  };

  if (!company) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{name || company.name}</SheetTitle>
        </SheetHeader>

        <div className="px-4 pb-6">
          <Tabs defaultValue="details">
            <TabsList className="w-full">
              <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
              <TabsTrigger value="modules" className="flex-1">Modules</TabsTrigger>
              <TabsTrigger value="admin" className="flex-1">Company Admin</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-5 pt-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 rounded-xl">
                  <AvatarImage src={company.logo_url ?? undefined} />
                  <AvatarFallback className="rounded-xl bg-primary text-lg text-primary-foreground">
                    {company.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <label htmlFor="logo-upload">
                    <Button type="button" variant="outline" size="sm" disabled={uploadingLogo} asChild>
                      <span className="cursor-pointer">
                        <Upload className="h-3.5 w-3.5" />
                        {uploadingLogo ? "Uploading…" : "Upload logo"}
                      </span>
                    </Button>
                  </label>
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadLogo(file);
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="company-name">Company name</Label>
                <div className="flex gap-2">
                  <Input id="company-name" value={name} onChange={(e) => setName(e.target.value)} />
                  <Button
                    type="button"
                    onClick={handleSaveName}
                    disabled={savingName || !name.trim() || name.trim() === company.name}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="modules" className="space-y-1 pt-4">
              {modulesQuery.data?.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-md px-2 py-2.5">
                  <span className="text-sm font-medium text-foreground">
                    {MODULE_LABELS[m.module_key as ModuleKey]}
                  </span>
                  <Switch
                    checked={m.enabled}
                    onCheckedChange={(checked) => toggleModule.mutate({ id: m.id, enabled: checked })}
                  />
                </div>
              ))}
            </TabsContent>

            <TabsContent value="admin" className="pt-4">
              <p className="mb-4 text-sm text-muted-foreground">
                Invite a Company Admin. They will receive an email to set their password and will be
                granted the Admin role for {company.name}.
              </p>
              <form onSubmit={handleInviteAdmin} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="admin-first">First name</Label>
                    <Input id="admin-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="admin-last">Last name</Label>
                    <Input id="admin-last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="admin-email">Email</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={inviting}>
                  {inviting ? "Sending invite…" : "Invite Company Admin"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <Separator className="my-6" />
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>Slug: /c/{company.slug}</p>
            <p>Code: {company.code}</p>
            <p>Status: {company.status}</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
