"use client";

import { useActionState } from "react";
import { setFundingTerms } from "@/lib/actions/developer-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TEXTAREA_CLASSES =
  "flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400";

type FundingTermsState = { error?: string; opportunityId?: string };
const initialState: FundingTermsState = {};

/**
 * Sets the app's standing revenue-share terms — applies to whatever
 * marketing campaigns the app runs, on any channel, starting the moment
 * an investor contributes. No funding target, no threshold.
 */
export function FundingTermsForm({
  appId,
  hasOpenTerms,
}: {
  appId: string;
  hasOpenTerms: boolean;
}) {
  // setFundingTerms's success path calls redirect() (which never returns),
  // so TS would otherwise infer its return type as the narrower error-only
  // branch. Pin the state type explicitly to match its declared prevState
  // parameter type instead of letting inference pick the narrower one.
  const [state, formAction, pending] = useActionState<FundingTermsState, FormData>(setFundingTerms, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="appId" value={appId} />

      {hasOpenTerms && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This app already has open terms. Submitting new terms supersedes them going forward — existing investors
          keep exactly what they signed up for; only new money gets these new terms.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required maxLength={200} placeholder="e.g. Standing growth funding terms" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          name="description"
          required
          rows={4}
          maxLength={4000}
          placeholder="How will invested capital be used, and why now?"
          className={TEXTAREA_CLASSES}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="investorRevenueSharePercent">Investor revenue share (%)</Label>
          <Input
            id="investorRevenueSharePercent"
            name="investorRevenueSharePercent"
            type="number"
            min={1}
            max={99}
            required
            placeholder="30"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="returnCapMultiple">Return cap (x)</Label>
          <Input id="returnCapMultiple" name="returnCapMultiple" type="number" min={1} max={10} step="0.1" required placeholder="2" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="minimumInvestment">Minimum investment ($)</Label>
          <Input id="minimumInvestment" name="minimumInvestment" type="number" min={1} step="1" defaultValue={50} />
        </div>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <Button type="submit" disabled={pending} size="lg">
        {pending ? "Saving…" : hasOpenTerms ? "Supersede with new terms" : "Open these terms for investment"}
      </Button>
    </form>
  );
}
