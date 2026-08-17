import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/info-tooltip";
import { ReturnProjectionChart } from "@/components/charts/return-projection-chart";
import { formatCurrency } from "@/lib/utils";
import type { ReturnTimeline } from "@/lib/engine/return-timeline";

export function ReturnTimelineCard({ timeline }: { timeline: ReturnTimeline }) {
  const {
    referenceAmount,
    points,
    series,
    returnCapDollarAmount,
    observedHistoryDays,
    historicalCAC,
    avgDaysToRecoupPrincipal,
    avgDaysToReturnCap,
    investmentsAnalyzed,
  } = timeline;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-base">
          Return timeline <InfoTooltip term="returnTimeline" />
        </CardTitle>
        <p className="text-xs text-slate-500">
          Projection — not guaranteed. What a {formatCurrency(referenceAmount)} investment might have back over the
          next year, based on how quickly this app&apos;s revenue has actually arrived historically — not a generic
          curve applied to every app.
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <ReturnProjectionChart
          series={series}
          referenceAmount={referenceAmount}
          returnCapDollarAmount={returnCapDollarAmount}
          observedHistoryDays={observedHistoryDays}
        />

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {points.map((p) => (
            <div key={p.days} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">{p.label}</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{formatCurrency(p.projectedInvestorReturn)}</p>
              {p.extrapolated && <p className="mt-0.5 text-[10px] text-amber-600">estimated beyond history</p>}
            </div>
          ))}
        </div>

        <dl className="mt-5 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
          <div>
            <dt className="flex items-center gap-1 text-xs text-slate-400">
              Avg. CAC <InfoTooltip term="cac" />
            </dt>
            <dd className="mt-0.5 font-medium text-slate-900">
              {historicalCAC != null ? formatCurrency(historicalCAC) : "—"}
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1 text-xs text-slate-400">
              Days to recoup principal <InfoTooltip term="avgDaysToRecoup" />
            </dt>
            <dd className="mt-0.5 font-medium text-slate-900">
              {avgDaysToRecoupPrincipal != null ? `${Math.round(avgDaysToRecoupPrincipal)} days` : "No investment has recouped yet"}
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1 text-xs text-slate-400">
              Days to hit return cap <InfoTooltip term="avgDaysToCap" />
            </dt>
            <dd className="mt-0.5 font-medium text-slate-900">
              {avgDaysToReturnCap != null ? `${Math.round(avgDaysToReturnCap)} days` : "No investment has hit the cap yet"}
            </dd>
          </div>
        </dl>
        {(avgDaysToRecoupPrincipal != null || avgDaysToReturnCap != null) && (
          <p className="mt-2 text-[11px] text-slate-400">
            Based on {investmentsAnalyzed} real investment{investmentsAnalyzed === 1 ? "" : "s"} in this app across all
            terms vintages.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
