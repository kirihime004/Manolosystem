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
      logo={
        <img
          src="/brand/landing-logo.png"
          alt="Mindburst"
          className="w-[26rem] max-w-full"
          style={{
            // Zero-blur drop-shadows stacked in 8 directions at a fixed 2px
            // offset -- this is the only way to get a hard-edged solid
            // outline via CSS filter (any nonzero blur radius produces a
            // soft/spread glow instead of a crisp stroke).
            filter: [
              "drop-shadow(0.5px 0 0 rgba(255,255,255,0.5))",
              "drop-shadow(-0.5px 0 0 rgba(255,255,255,0.5))",
              "drop-shadow(0 0.5px 0 rgba(255,255,255,0.5))",
              "drop-shadow(0 -0.5px 0 rgba(255,255,255,0.5))",
              "drop-shadow(0.35px 0.35px 0 rgba(255,255,255,0.5))",
              "drop-shadow(-0.35px 0.35px 0 rgba(255,255,255,0.5))",
              "drop-shadow(0.35px -0.35px 0 rgba(255,255,255,0.5))",
              "drop-shadow(-0.35px -0.35px 0 rgba(255,255,255,0.5))",
            ].join(" "),
          }}
        />
      }
      subtitle="Select your company"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="code" className="text-white">Company code</Label>
          <Input
            id="code"
            placeholder="e.g. JBCO"
            autoComplete="off"
            autoCapitalize="characters"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="border-white/20 bg-white/95 text-slate-900 placeholder:text-slate-500 focus-visible:ring-white/40 dark:border-white/20 dark:bg-white/95 dark:text-slate-900 dark:placeholder:text-slate-500"
          />
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Looking up…" : "Continue"}
        </Button>
      </form>
      <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-white/80">
        <Building2 className="h-3.5 w-3.5" />
        Not sure of your company code? Ask your company administrator.
      </div>
    </AuthCard>
  );
}
