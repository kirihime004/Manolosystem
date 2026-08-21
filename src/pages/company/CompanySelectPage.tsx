import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Building2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { AuthCard } from "@/components/shared/AuthCard";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function CompanySelectPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setSubmitting(true);
    const { data: rawData, error } = await supabase
      .rpc("lookup_company_by_code", { p_code: code.trim() })
      .maybeSingle();
    setSubmitting(false);

    const data = rawData as { slug: string; name: string; logo_url: string | null } | null;

    if (error || !data) {
      toast.error("We couldn't find a company with that code.");
      return;
    }

    navigate(`/c/${data.slug}/login`);
  };

  return (
    <AuthCard
      backgroundImage="/brand/background.png"
      logo={<img src="/brand/landing-logo.png" alt="Mindburst" className="w-72 max-w-full" />}
      subtitle="Select your company"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="code">Company code</Label>
          <Input
            id="code"
            placeholder="e.g. JBCO"
            autoComplete="off"
            autoCapitalize="characters"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Looking up…" : "Continue"}
        </Button>
      </form>
      <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Building2 className="h-3.5 w-3.5" />
        Not sure of your company code? Ask your company administrator.
      </div>
    </AuthCard>
  );
}
