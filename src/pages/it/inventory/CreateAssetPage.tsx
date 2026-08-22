import { useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useCompany } from "@/lib/tenant/useCompany";
import { useCompanyMembers } from "@/features/it/tickets/hooks";
import { useSuppliers, useAssetMutations } from "@/features/it/inventory/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const HARDWARE_CATEGORIES = [
  "Desktop", "Laptop", "Monitor", "Printer", "Scanner", "Server", "NAS", "Switch", "Router",
  "Firewall", "Access Point", "UPS", "UPS Battery", "Keyboard", "Mouse", "Mobile Device",
  "Tablet", "Phone", "CCTV Recorder", "PABX", "Network Device", "Other",
];

export default function CreateAssetPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: members } = useCompanyMembers(company?.id);
  const { data: suppliers } = useSuppliers(company?.id);
  const { create } = useAssetMutations();

  const [assetType, setAssetType] = useState<"HARDWARE" | "SOFTWARE">(
    searchParams.get("type") === "SOFTWARE" ? "SOFTWARE" : "HARDWARE",
  );
  const [softwareType, setSoftwareType] = useState<"SUBSCRIPTION" | "ONE_TIME_PURCHASE">("ONE_TIME_PURCHASE");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [assetTag, setAssetTag] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [supplierId, setSupplierId] = useState<string>("none");
  const [assignedTo, setAssignedTo] = useState<string>("none");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  // hardware
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [hostname, setHostname] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [macAddress, setMacAddress] = useState("");
  const [warrantyEnd, setWarrantyEnd] = useState("");
  const [lifecycleYears, setLifecycleYears] = useState("5");

  // software
  const [vendor, setVendor] = useState("");
  const [version, setVersion] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [numberOfLicenses, setNumberOfLicenses] = useState("1");
  const [renewalDate, setRenewalDate] = useState("");
  const [billingCycle, setBillingCycle] = useState("ANNUAL");
  const [subscriptionCost, setSubscriptionCost] = useState("");
  const [seatsTotal, setSeatsTotal] = useState("1");

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!company) return;
    setSubmitting(true);
    try {
      const asset = await create.mutateAsync({
        companyId: company.id,
        assetType,
        name: name.trim(),
        category: category || null,
        serialNumber: serialNumber || null,
        assetTag: assetTag || null,
        purchaseDate: purchaseDate || null,
        purchasePrice: purchasePrice ? Number(purchasePrice) : null,
        currency,
        supplierId: supplierId === "none" ? null : supplierId,
        assignedTo: assignedTo === "none" ? null : assignedTo,
        location: location || null,
        notes: notes || null,
        brand: assetType === "HARDWARE" ? brand || null : undefined,
        model: assetType === "HARDWARE" ? model || null : undefined,
        hostname: assetType === "HARDWARE" ? hostname || null : undefined,
        ipAddress: assetType === "HARDWARE" ? ipAddress || null : undefined,
        macAddress: assetType === "HARDWARE" ? macAddress || null : undefined,
        warrantyEnd: assetType === "HARDWARE" ? warrantyEnd || null : undefined,
        lifecycleYears: assetType === "HARDWARE" ? Number(lifecycleYears) || 5 : undefined,
        softwareType: assetType === "SOFTWARE" ? softwareType : undefined,
        vendor: assetType === "SOFTWARE" ? vendor || null : undefined,
        version: assetType === "SOFTWARE" ? version || null : undefined,
        licenseKey: assetType === "SOFTWARE" ? licenseKey || null : undefined,
        numberOfLicenses: assetType === "SOFTWARE" ? Number(numberOfLicenses) || null : undefined,
        renewalDate: assetType === "SOFTWARE" && softwareType === "SUBSCRIPTION" ? renewalDate || null : undefined,
        billingCycle: assetType === "SOFTWARE" && softwareType === "SUBSCRIPTION" ? billingCycle : undefined,
        subscriptionCost: assetType === "SOFTWARE" && softwareType === "SUBSCRIPTION" ? (subscriptionCost ? Number(subscriptionCost) : null) : undefined,
        seatsTotal: assetType === "SOFTWARE" && softwareType === "SUBSCRIPTION" ? Number(seatsTotal) || 1 : undefined,
      });
      toast.success(`${asset.asset_code} created`);
      navigate(`/c/${companySlug}/it/inventory/${asset.asset_code}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create asset");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">New asset</h1>
        <p className="text-sm text-muted-foreground">Add a hardware or software asset to the inventory.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Asset type</CardTitle></CardHeader>
          <CardContent>
            <Tabs value={assetType} onValueChange={(v) => setAssetType(v as "HARDWARE" | "SOFTWARE")}>
              <TabsList className="w-full">
                <TabsTrigger value="HARDWARE" className="flex-1">Hardware</TabsTrigger>
                <TabsTrigger value="SOFTWARE" className="flex-1">Software</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>{assetType === "HARDWARE" ? "Name (e.g. Brand + Model)" : "Software name"}</Label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            {assetType === "HARDWARE" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>{HARDWARE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Lifecycle (years)</Label>
                  <Input type="number" min={1} value={lifecycleYears} onChange={(e) => setLifecycleYears(e.target.value)} />
                </div>
                <div className="space-y-1.5"><Label>Brand</Label><Input value={brand} onChange={(e) => setBrand(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Model</Label><Input value={model} onChange={(e) => setModel(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Serial number</Label><Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Asset tag</Label><Input value={assetTag} onChange={(e) => setAssetTag(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Hostname</Label><Input value={hostname} onChange={(e) => setHostname(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>IP address</Label><Input value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>MAC address</Label><Input value={macAddress} onChange={(e) => setMacAddress(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Warranty end</Label><Input type="date" value={warrantyEnd} onChange={(e) => setWarrantyEnd(e.target.value)} /></div>
              </div>
            ) : (
              <>
                <Tabs value={softwareType} onValueChange={(v) => setSoftwareType(v as "SUBSCRIPTION" | "ONE_TIME_PURCHASE")}>
                  <TabsList className="w-full">
                    <TabsTrigger value="ONE_TIME_PURCHASE" className="flex-1">One-time purchase</TabsTrigger>
                    <TabsTrigger value="SUBSCRIPTION" className="flex-1">Subscription</TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Vendor</Label><Input value={vendor} onChange={(e) => setVendor(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Version</Label><Input value={version} onChange={(e) => setVersion(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>License key / identifier</Label><Input value={licenseKey} onChange={(e) => setLicenseKey(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Number of licenses</Label><Input type="number" min={1} value={numberOfLicenses} onChange={(e) => setNumberOfLicenses(e.target.value)} /></div>
                </div>
                {softwareType === "SUBSCRIPTION" && (
                  <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
                    <div className="space-y-1.5"><Label>Renewal date</Label><Input type="date" value={renewalDate} onChange={(e) => setRenewalDate(e.target.value)} /></div>
                    <div className="space-y-1.5">
                      <Label>Billing cycle</Label>
                      <Select value={billingCycle} onValueChange={setBillingCycle}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MONTHLY">Monthly</SelectItem>
                          <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                          <SelectItem value="ANNUAL">Annual</SelectItem>
                          <SelectItem value="OTHER">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5"><Label>Subscription cost</Label><Input type="number" step="0.01" value={subscriptionCost} onChange={(e) => setSubscriptionCost(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Seats</Label><Input type="number" min={1} value={seatsTotal} onChange={(e) => setSeatsTotal(e.target.value)} /></div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Purchase &amp; assignment</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>Purchase date</Label><Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Purchase price</Label><Input type="number" step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Currency</Label><Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No supplier</SelectItem>
                  {suppliers?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Assigned to</Label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {members?.map((m) => <SelectItem key={m.id} value={m.id}>{m.first_name} {m.last_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" disabled={submitting}>{submitting ? "Creating…" : "Create asset"}</Button>
        </div>
      </form>
    </div>
  );
}
