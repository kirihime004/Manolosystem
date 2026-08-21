import { useContext } from "react";
import { CompanyContext } from "@/lib/tenant/CompanyProvider";

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) {
    throw new Error("useCompany must be used within a CompanyProvider");
  }
  return ctx;
}
