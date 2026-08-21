import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isColorDark } from "@/lib/color";
import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  "#0f172a", // slate-900
  "#1e293b", // slate-800
  "#111827", // gray-900
  "#1e1b4b", // indigo-950
  "#052e16", // green-950
  "#450a0a", // red-950
  "#f8fafc", // slate-50
  "#ffffff",
];

export default function AppearancePage() {
  const { company, refresh } = useCompany();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"color" | "image">("color");
  const [color, setColor] = useState("#0f172a");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!company) return;
    setMode(company.sidebar_background_url ? "image" : "color");
    setColor(company.sidebar_background_color ?? "#0f172a");
  }, [company]);

  if (!company) return null;

  const handleSaveColor = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("companies")
      .update({ sidebar_background_color: color, sidebar_background_url: null })
      .eq("id", company.id);
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Sidebar color updated");
    refresh();
  };

  const handleUploadImage = async (file: File) => {
    setUploading(true);

    const ext = file.name.split(".").pop();
    const path = `${company.id}/sidebar-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("company-logos").upload(path, file, {
      upsert: true,
    });

    if (uploadError) {
      setUploading(false);
      toast.error(uploadError.message);
      return;
    }

    const { data: publicUrl } = supabase.storage.from("company-logos").getPublicUrl(path);

    const { error: updateError } = await supabase
      .from("companies")
      .update({ sidebar_background_url: publicUrl.publicUrl, sidebar_background_color: null })
      .eq("id", company.id);

    setUploading(false);

    if (updateError) {
      toast.error(updateError.message);
      return;
    }

    toast.success("Sidebar background updated");
    refresh();
  };

  const handleRemoveImage = async () => {
    const { error } = await supabase
      .from("companies")
      .update({ sidebar_background_url: null })
      .eq("id", company.id);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Sidebar background removed");
    refresh();
  };

  const handleResetToDefault = async () => {
    const { error } = await supabase
      .from("companies")
      .update({ sidebar_background_url: null, sidebar_background_color: null })
      .eq("id", company.id);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Sidebar reset to default");
    refresh();
  };

  const previewIsDark = mode === "image" ? !!company.sidebar_background_url : isColorDark(color);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Sidebar appearance</h1>
        <p className="text-sm text-muted-foreground">
          Customize the background of your company's navigation sidebar.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Background</CardTitle>
          <CardDescription>
            Choose a solid color or upload an image. Text and icons automatically switch to stay
            readable against whatever you pick.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Tabs value={mode} onValueChange={(v) => setMode(v as "color" | "image")}>
            <TabsList>
              <TabsTrigger value="color">Solid color</TabsTrigger>
              <TabsTrigger value="image">Image</TabsTrigger>
            </TabsList>

            <TabsContent value="color" className="space-y-4 pt-4">
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setColor(preset)}
                    className={cn(
                      "h-8 w-8 rounded-full border-2 transition-transform",
                      color.toLowerCase() === preset ? "border-primary scale-110" : "border-border",
                    )}
                    style={{ backgroundColor: preset }}
                    aria-label={preset}
                  />
                ))}
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="custom-color" className="text-sm">
                  Custom color
                </Label>
                <input
                  id="custom-color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 w-14 cursor-pointer rounded border border-border bg-transparent p-0.5"
                />
                <span className="text-sm text-muted-foreground">{color}</span>
              </div>
              <Button onClick={handleSaveColor} disabled={saving}>
                {saving ? "Saving…" : "Save color"}
              </Button>
            </TabsContent>

            <TabsContent value="image" className="space-y-4 pt-4">
              {company.sidebar_background_url ? (
                <div className="flex items-center gap-3">
                  <img
                    src={company.sidebar_background_url}
                    alt="Sidebar background"
                    className="h-16 w-16 rounded-md border border-border object-cover"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={handleRemoveImage}>
                    <X className="h-3.5 w-3.5" />
                    Remove image
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No image set.</p>
              )}
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploading ? "Uploading…" : "Upload image"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadImage(file);
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                A dark overlay is applied automatically so nav text stays legible over any photo.
              </p>
            </TabsContent>
          </Tabs>

          <div className="border-t border-border pt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Preview</p>
            <div
              className={cn(
                "relative flex w-56 flex-col gap-2 overflow-hidden rounded-md border border-border p-3",
                previewIsDark ? "dark" : "",
              )}
              style={
                mode === "image" && company.sidebar_background_url
                  ? {
                      backgroundImage: `url(${company.sidebar_background_url})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : { backgroundColor: mode === "color" ? color : undefined }
              }
            >
              {mode === "image" && company.sidebar_background_url && (
                <div className="absolute inset-0 bg-black/55" />
              )}
              <div className="relative rounded bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground">
                Dashboard
              </div>
              <div className="relative px-2 py-1.5 text-xs font-medium text-foreground">Ticketing</div>
              <div className="relative px-2 py-1.5 text-xs font-medium text-muted-foreground">Settings</div>
            </div>
          </div>

          {(company.sidebar_background_url || company.sidebar_background_color) && (
            <Button type="button" variant="ghost" size="sm" onClick={handleResetToDefault}>
              Reset to default
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
