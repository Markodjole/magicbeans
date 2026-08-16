"use client";

import { useActionState, useMemo, useState } from "react";
import { investInOpportunity } from "@/lib/actions/investor-actions";
import { estimateInvestorReturn } from "@/lib/engine/projection-math";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";

export function InvestForm({
  opportunityId,
  minimumInvestment,
  historicalROAS,
  investorRevenueSharePercent,
  returnCapMultiple,
}: {
  opportunityId: string;
  minimumInvestment: number;
  historicalROAS: number | null;
  investorRevenueSharePercent: number;
  returnCapMultiple: number;
}) {
  const [state, formAction, pending] = useActionState(investInOpportunity, {});
  const [amountInput, setAmountInput] = useState(String(minimumInvestment));

  const estimate = useMemo(() => {
    const amount = Number(amountInput);
    if (!historicalROAS || !Number.isFinite(amount) || amount <= 0) return null;
    return estimateInvestorReturn({ amount, historicalROAS, investorRevenueSharePercent, returnCapMultiple });
  }, [amountInput, historicalROAS, investorRevenueSharePercent, returnCapMultiple]);

  if (state.success) {
    return (
      <div className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        Investment confirmed. Capital deploys into ad spend as the campaign runs — track it from your{" "}
        <a href="/investor" className="underline">
          dashboard
        </a>
        .
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="amount">Amount to fund</Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          min={minimumInvestment}
          step="10"
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          required
        />
        <p className="text-xs text-slate-500">Minimum ${minimumInvestment}</p>
      </div>

      {estimate && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Projection — not guaranteed</p>
          <p className="mt-1 text-sm text-slate-600">
            If attributed revenue tracks this campaign&apos;s historical {historicalROAS?.toFixed(2)}x ROAS, your
            estimated revenue share — and how that compares to the {formatCurrency(Number(amountInput))} you&apos;d put in:
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
            <EstimateStat label="Bear" value={estimate.bear} amount={Number(amountInput)} />
            <EstimateStat label="Base" value={estimate.base} amount={Number(amountInput)} emphasize />
            <EstimateStat label="Bull" value={estimate.bull} amount={Number(amountInput)} />
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Revenue share only — your principal isn&apos;t separately returned, so a scenario below your contribution
            (shown in red) means a net loss, not just a smaller gain. Capped at your {returnCapMultiple.toFixed(2)}x
            return cap ({formatCurrency(estimate.maxPayable)}){estimate.capApplied ? " — bull case hits the cap." : "."}{" "}
            Assumes your contribution&apos;s proportional share; actual payout depends on total capital deployed
            alongside yours.
          </p>
        </div>
      )}

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Processing…" : "Fund this campaign"}
      </Button>
    </form>
  );
}

function EstimateStat({
  label,
  value,
  amount,
  emphasize,
}: {
  label: string;
  value: number;
  amount: number;
  emphasize?: boolean;
}) {
  const net = value - amount;
  const isLoss = net < 0;
  return (
    <div className="rounded bg-white px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className={emphasize ? "font-semibold text-slate-900" : "text-slate-700"}>{formatCurrency(value)}</p>
      <p className={`text-xs font-medium ${isLoss ? "text-red-600" : "text-emerald-600"}`}>
        {isLoss ? "−" : "+"}
        {formatCurrency(Math.abs(net))}
      </p>
    </div>
  );
}
