"use client";

import { useActionState, useState } from "react";
import { launchMarketerCampaign } from "@/lib/actions/marketer-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";

type CampaignState = { error?: string; campaignId?: string };
const initialState: CampaignState = {};

type Option = { id: string; name: string; channel: string; description: string };

export function MarketerCampaignForm({
  offerId,
  minBudget,
  payoutPerConversion,
  historicalCPA,
  creatives,
  targetingTemplates,
}: {
  offerId: string;
  minBudget: number;
  payoutPerConversion: number;
  /** This app's real historical cost-per-acquisition, or null if it hasn't run any ads yet. */
  historicalCPA: number | null;
  creatives: Option[];
  targetingTemplates: Option[];
}) {
  const [state, formAction, pending] = useActionState<CampaignState, FormData>(launchMarketerCampaign, initialState);
  const [budget, setBudget] = useState(String(minBudget));

  // Derived from this app's own historical CPA, not an invented ratio —
  // if it doesn't have one yet, there's nothing honest to estimate.
  const estimatedConversions =
    historicalCPA && historicalCPA > 0 && Number(budget) > 0 ? Math.floor(Number(budget) / historicalCPA) : null;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="offerId" value={offerId} />

      <fieldset className="flex flex-col gap-2">
        <Label>Choose a creative</Label>
        {creatives.map((c, i) => (
          <label key={c.id} className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3 text-sm has-[:checked]:border-slate-900 has-[:checked]:bg-slate-50">
            <input type="radio" name="creativeId" value={c.id} required defaultChecked={i === 0} className="mt-1" />
            <span>
              <span className="font-medium text-slate-900">{c.name}</span>
              <span className="ml-2 text-xs text-slate-400">{c.channel}</span>
              <p className="text-slate-500">{c.description}</p>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <Label>Choose targeting</Label>
        {targetingTemplates.map((t, i) => (
          <label key={t.id} className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3 text-sm has-[:checked]:border-slate-900 has-[:checked]:bg-slate-50">
            <input type="radio" name="targetingTemplateId" value={t.id} required defaultChecked={i === 0} className="mt-1" />
            <span>
              <span className="font-medium text-slate-900">{t.name}</span>
              <span className="ml-2 text-xs text-slate-400">{t.channel}</span>
              <p className="text-slate-500">{t.description}</p>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="declaredBudget">Your ad budget ($)</Label>
          <Input
            id="declaredBudget"
            name="declaredBudget"
            type="number"
            min={minBudget}
            step="10"
            required
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
          <p className="text-xs text-slate-500">
            You fund this directly with the ad platform — MagicBeans never processes this payment.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="durationDays">Campaign duration (days)</Label>
          <Input id="durationDays" name="durationDays" type="number" min={1} max={90} defaultValue={7} required />
        </div>
      </div>

      {estimatedConversions !== null ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Estimate — not guaranteed</p>
          <p className="mt-1">
            At this app&apos;s historical cost per acquisition ({formatCurrency(historicalCPA!)}), a{" "}
            {formatCurrency(Number(budget))} budget might deliver roughly{" "}
            <strong className="text-slate-900">~{estimatedConversions} verified subscribers</strong>, worth up to{" "}
            {formatCurrency(estimatedConversions * payoutPerConversion)} in payouts. Past performance doesn&apos;t
            guarantee future results — you&apos;re only ever paid for subscribers you actually deliver.
          </p>
        </div>
      ) : (
        <p className="text-xs text-slate-400">
          This app doesn&apos;t have enough historical ad data yet for a reliable estimate.
        </p>
      )}

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <Button type="submit" disabled={pending} size="lg">
        {pending ? "Launching…" : "Launch campaign"}
      </Button>
    </form>
  );
}
