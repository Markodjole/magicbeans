"use client";

import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function SpendRevenueChart({ data }: { data: { date: string; spend: number; revenue: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0f172a" stopOpacity={0.5} />
            <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} minTickGap={30} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} width={50} />
        <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
        <Legend />
        <Area type="monotone" dataKey="spend" name="Ad spend" stroke="#94a3b8" fill="url(#spendFill)" strokeWidth={2} />
        <Area type="monotone" dataKey="revenue" name="Attributed revenue" stroke="#0f172a" fill="url(#revenueFill)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
