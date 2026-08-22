import { useCurrencies } from "@/features/it/procurement/hooks";
import { formatMoney } from "@/features/it/procurement/currencyApi";

// Displays a monetary amount using its currency's own symbol/decimal
// rules (see currencies table) -- never a hard-coded ₱/$/€, per Phase 3
// spec section 19.
export function Money({ amount, currencyId }: { amount: number | null | undefined; currencyId: string | null | undefined }) {
  const { data: currencies } = useCurrencies();
  if (amount == null) return <>—</>;
  const currency = currencies?.find((c) => c.id === currencyId);
  return <>{formatMoney(amount, currency)}</>;
}
