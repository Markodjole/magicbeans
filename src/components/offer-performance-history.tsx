import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { getOfferCampaignHistory, getOfferPerformanceBreakdown } from "@/lib/queries/marketplace";

type ComboRow = Awaited<ReturnType<typeof getOfferPerformanceBreakdown>>[number];
type CampaignRow = Awaited<ReturnType<typeof getOfferCampaignHistory>>[number];

/**
 * Real performance from every past/active campaign on this offer — the
 * data behind "tweak it your way, or just copy someone." Each campaign
 * row links to a "copy" URL that pre-fills the launch form with that
 * exact creative/targeting/budget/duration; the marketer can launch it
 * as-is or change anything before submitting.
 */
export function OfferPerformanceHistory({
  offerId,
  combos,
  campaigns,
}: {
  offerId: string;
  combos: ComboRow[];
  campaigns: CampaignRow[];
}) {
  if (campaigns.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campaign performance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">
            No campaigns have launched against this offer yet — you&apos;d be the first.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Campaign performance</CardTitle>
        <p className="text-sm text-slate-500">
          Real results from every marketer who&apos;s run this offer — not projections. Copy the exact setup of
          whichever campaign performed best, or use it as a starting point and tweak from there.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {combos.length > 1 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">By creative + audience</p>
            <div className="flex flex-col divide-y divide-slate-100">
              {combos.map((c) => (
                <div key={`${c.creativeId}-${c.targetingTemplateId}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-900">
                      {c.creativeName} · {c.targetingName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {c.campaignCount} campaign{c.campaignCount === 1 ? "" : "s"} · {c.conversions} subscribers ·{" "}
                      {formatCurrency(c.spend)} real spend
                    </p>
                  </div>
                  <span className="shrink-0 font-medium text-slate-900">
                    {c.conversionsPer100Spent.toFixed(1)} / $100 spent
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Individual campaigns</p>
          <div className="flex flex-col divide-y divide-slate-100">
            {campaigns.map((c) => (
              <div key={c.campaignId} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                <div>
                  <p className="font-medium text-slate-900">
                    {c.label} — {c.creativeName} · {c.targetingName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatCurrency(c.declaredBudget)} budget over {c.durationDays}d · {formatCurrency(c.realSpend)}{" "}
                    real spend · {c.conversions} subscribers delivered
                  </p>
                </div>
                <Link
                  href={`/offers/${offerId}?creative=${c.creativeId}&targeting=${c.targetingTemplateId}&budget=${Math.round(c.declaredBudget)}&duration=${c.durationDays}#launch`}
                  className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-400"
                >
                  Copy this campaign
                </Link>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
