import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrencies } from "@/features/it/procurement/hooks";

// A searchable-by-typing currency picker (shadcn's Select already supports
// type-ahead selection natively) -- default PHP, per spec section 20.
export function CurrencySelect({ value, onChange, className }: { value: string; onChange: (id: string) => void; className?: string }) {
  const { data: currencies } = useCurrencies();
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}><SelectValue placeholder="Select currency" /></SelectTrigger>
      <SelectContent>
        {currencies?.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.code} — {c.name} {c.symbol}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
