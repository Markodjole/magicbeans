"use client";

import { useActionState } from "react";
import { createPerformanceOffer } from "@/lib/actions/developer-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TEXTAREA_CLASSES =
  "flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400";
const SELECT_CLASSES =
  "flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400";

type OfferState = { error?: string; offerId?: string };
const initialState: OfferState = {};

const CHANNELS = [
  { value: "TIKTOK", label: "TikTok" },
  { value: "META", label: "Meta" },
  { value: "GOOGLE_ADS", label: "Google Ads" },
];

/**
 * Creates a CPA performance offer: "$35 per verified subscriber," plus a
 * fixed, pre-approved set of creatives and targeting templates a marketer
 * can pick from. No open-ended creative upload for this first pass — a
 * small curated list per offer, matching what was actually described.
 */
export function PerformanceOfferForm({ appId }: { appId: string }) {
  const [state, formAction, pending] = useActionState<OfferState, FormData>(createPerformanceOffer, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="appId" value={appId} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Offer title</Label>
        <Input id="title" name="title" required maxLength={200} placeholder="e.g. FocusFlow — US iOS growth offer" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          name="description"
          required
          rows={3}
          maxLength={4000}
          placeholder="What's this offer for, and what counts as a verified subscriber?"
          className={TEXTAREA_CLASSES}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="payoutPerConversion">Payout per verified subscriber ($)</Label>
          <Input id="payoutPerConversion" name="payoutPerConversion" type="number" min={1} step="0.01" required placeholder="35" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="marketplaceFeePercent">MagicBeans fee (%)</Label>
          <Input id="marketplaceFeePercent" name="marketplaceFeePercent" type="number" min={0} max={50} step="1" defaultValue={10} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="minBudget">Minimum campaign budget ($)</Label>
          <Input id="minBudget" name="minBudget" type="number" min={1} step="1" defaultValue={50} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <Label>Approved creatives</Label>
          <p className="text-xs text-slate-500">Marketers can only launch campaigns using one of these — add at least one.</p>
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="grid gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-[1fr_auto_2fr]">
            <Input name="creativeName" placeholder={`Creative ${String.fromCharCode(65 + i)} name`} maxLength={120} />
            <select name="creativeChannel" defaultValue="TIKTOK" className={SELECT_CLASSES}>
              {CHANNELS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <Input name="creativeDescription" placeholder="Short description of the creative" maxLength={280} />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <Label>Approved targeting templates</Label>
          <p className="text-xs text-slate-500">e.g. &quot;Broad US&quot;, &quot;Women 25–44&quot; — add at least one.</p>
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="grid gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-[1fr_auto_2fr]">
            <Input name="targetingName" placeholder={`Targeting ${String.fromCharCode(65 + i)} name`} maxLength={120} />
            <select name="targetingChannel" defaultValue="TIKTOK" className={SELECT_CLASSES}>
              {CHANNELS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <Input name="targetingDescription" placeholder="Short description of the audience" maxLength={280} />
          </div>
        ))}
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <Button type="submit" disabled={pending} size="lg">
        {pending ? "Saving…" : "Create performance offer"}
      </Button>
    </form>
  );
}
