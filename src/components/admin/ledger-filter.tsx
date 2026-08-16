"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

const TYPES = [
  "INVESTMENT_DEPOSIT",
  "CAMPAIGN_ALLOCATION",
  "AD_SPEND",
  "ATTRIBUTED_REVENUE",
  "INVESTOR_REVENUE_SHARE",
  "DEVELOPER_REVENUE_SHARE",
  "PLATFORM_FEE",
  "INVESTOR_PAYOUT",
  "REFUND",
  "REVERSAL",
] as const;

export function LedgerFilter({ current }: { current?: string }) {
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    router.push(value ? `/admin?type=${encodeURIComponent(value)}#ledger` : "/admin#ledger");
  }

  return (
    <select
      value={current ?? ""}
      onChange={handleChange}
      className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
    >
      <option value="">All types</option>
      {TYPES.map((t) => (
        <option key={t} value={t}>
          {t.replaceAll("_", " ")}
        </option>
      ))}
    </select>
  );
}
