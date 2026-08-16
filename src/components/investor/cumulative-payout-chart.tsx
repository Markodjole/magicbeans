"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function CumulativePayoutChart({ data }: { data: { date: string; cumulativePaidOut: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="payoutFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0f172a" stopOpacity={0.5} />
            <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} minTickGap={30} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} width={55} />
        <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
        <Area
          type="monotone"
          dataKey="cumulativePaidOut"
          name="Cumulative paid out"
          stroke="#0f172a"
          fill="url(#payoutFill)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
