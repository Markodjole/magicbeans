import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";
import type { LedgerEntry } from "@/generated/prisma/client";

const TYPE_LABEL: Record<string, string> = {
  INVESTMENT_DEPOSIT: "Investment Deposit",
  CAMPAIGN_ALLOCATION: "Campaign Allocation",
  AD_SPEND: "Ad Spend",
  ATTRIBUTED_REVENUE: "Attributed Revenue",
  INVESTOR_REVENUE_SHARE: "Investor Revenue Share",
  DEVELOPER_REVENUE_SHARE: "Developer Revenue Share",
  PLATFORM_FEE: "Platform Fee",
  INVESTOR_PAYOUT: "Investor Payout",
  REFUND: "Refund",
  REVERSAL: "Reversal",
};

export function AuditTimeline({ entries }: { entries: LedgerEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-500">No ledger activity recorded for this investment yet.</p>;
  }

  return (
    <ol className="flex flex-col gap-0">
      {entries.map((entry, i) => {
        const amount = Number(entry.amount);
        const isNegative = amount < 0;
        return (
          <li key={entry.id} className="relative flex gap-4 pb-8 last:pb-0">
            {/* Rail */}
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "mt-1 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-white ring-2",
                  isNegative ? "bg-red-500 ring-red-100" : "bg-slate-900 ring-slate-200"
                )}
              />
              {i < entries.length - 1 && <span className="mt-1 w-px flex-1 bg-slate-200" />}
            </div>

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{TYPE_LABEL[entry.type] ?? entry.type}</Badge>
                <span className="text-xs text-slate-400">{formatDateTime(entry.createdAt)}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm text-slate-900">{entry.description}</p>
                <p className={cn("text-sm font-semibold", isNegative ? "text-red-600" : "text-emerald-700")}>
                  {isNegative ? "" : "+"}
                  {formatCurrency(amount)}
                </p>
              </div>

              {entry.metadata != null && (
                <details className="mt-2 text-xs text-slate-500">
                  <summary className="cursor-pointer select-none font-medium text-slate-600 hover:text-slate-900">
                    View raw metadata
                  </summary>
                  <pre className="mt-2 overflow-x-auto rounded-md bg-slate-50 p-3 text-[11px] text-slate-700">
                    {JSON.stringify(entry.metadata, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
