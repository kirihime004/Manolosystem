import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { AuthCard } from "@/components/shared/AuthCard";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const inputDarkOverride = "dark:border-white/20 dark:bg-white/95 dark:text-slate-900 dark:placeholder:text-slate-500";

// A client contact is a real Supabase auth user, but never a
// company_users row -- so this login intentionally checks
// production_client_users instead of the company-staff membership check
// CompanyLoginPage uses. A staff member's credentials will authenticate
// here but then fail this check and get signed back out, exactly the
// mirror image of how a client's credentials behave on the staff login.
export default function ClientLoginPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!companySlug) return;
    setSubmitting(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setSubmitting(false);
      toast.error(signInError.message);
      return;
    }

    const { data: companyRow } = await supabase.from("companies").select("id").eq("slug", companySlug).maybeSingle();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: clientRow } = await supabase
      .from("production_client_users")
      .select("is_active")
      .eq("company_id", companyRow?.id ?? "")
      .eq("user_id", user?.id ?? "")
      .maybeSingle();

    if (!companyRow || !clientRow || !clientRow.is_active) {
      await supabase.auth.signOut();
      setSubmitting(false);
      toast.error("This account does not have client portal access for this company.");
      return;
    }

    setSubmitting(false);
    navigate(`/client/${companySlug}`, { replace: true });
  };

  return (
    <AuthCard title="Client Portal" subtitle="Sign in to review your project">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="dark:text-white">Email</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputDarkOverride} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="dark:text-white">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputDarkOverride} />
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>{submitting ? "Signing in…" : "Sign In"}</Button>
      </form>
    </AuthCard>
  );
}
