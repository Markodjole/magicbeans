"use client";

import { Area, AreaChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ReturnTimelineSeriesPoint } from "@/lib/engine/return-timeline";

/**
 * One-year projected cumulative return curve for a reference investment.
 * Split into two dataKeys (observed vs extrapolated) so the chart can
 * render the real-data portion solid and the beyond-history portion
 * visually distinct (lighter fill), sharing one boundary point so the
 * lines connect without a gap.
 */
export function ReturnProjectionChart({
  series,
  referenceAmount,
  returnCapDollarAmount,
  observedHistoryDays,
}: {
  series: ReturnTimelineSeriesPoint[];
  referenceAmount: number;
  returnCapDollarAmount: number;
  observedHistoryDays: number;
}) {
  const boundaryDay = Math.min(observedHistoryDays - 1, series[series.length - 1]?.day ?? 0);

  const data = series.map((p) => ({
    day: p.day,
    observed: p.extrapolated ? null : p.cumulativeReturn,
    projected: p.extrapolated || p.day === boundaryDay ? p.cumulativeReturn : null,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="observedFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0f172a" stopOpacity={0.45} />
            <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="projectedFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0f172a" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="day"
          tick={{ fontSize: 11 }}
          tickFormatter={(d: number) => (d === 0 ? "Day 0" : d % 30 === 0 ? `${Math.round(d / 30)}mo` : `${d}d`)}
          ticks={[0, 30, 60, 90, 180, 270, 365].filter((d) => d <= (series[series.length - 1]?.day ?? 365))}
        />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} width={50} />
        <Tooltip
          formatter={(value) => (value == null ? "—" : `$${Number(value).toFixed(2)}`)}
          labelFormatter={(d) => `Day ${d}`}
        />
        <Legend />
        <ReferenceLine
          y={referenceAmount}
          stroke="#94a3b8"
          strokeDasharray="4 4"
          label={{ value: "Principal recouped", position: "insideTopLeft", fontSize: 10, fill: "#64748b" }}
        />
        <ReferenceLine
          y={returnCapDollarAmount}
          stroke="#059669"
          strokeDasharray="4 4"
          label={{ value: "Return cap", position: "insideTopLeft", fontSize: 10, fill: "#059669" }}
        />
        <Area
          type="monotone"
          dataKey="observed"
          name="Based on this app's real history"
          stroke="#0f172a"
          fill="url(#observedFill)"
          strokeWidth={2}
          connectNulls={false}
        />
        <Area
          type="monotone"
          dataKey="projected"
          name="Estimated beyond observed history"
          stroke="#0f172a"
          strokeDasharray="5 5"
          fill="url(#projectedFill)"
          strokeWidth={2}
          connectNulls
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
