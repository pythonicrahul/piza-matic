"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function hourLabel(h: number): string {
  const am = h < 12;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${am ? "a" : "p"}`;
}

interface HourPoint {
  hour: number;
  count: number;
}

export function HourChart({ data, busiestHour }: { data: HourPoint[]; busiestHour: number | null }) {
  const rows = data.map((d) => ({ ...d, label: hourLabel(d.hour) }));

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={rows} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
        <Tooltip
          cursor={{ fill: "var(--background)" }}
          contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 12 }}
          formatter={(value) => [`${value} order${value === 1 ? "" : "s"}`, ""]}
          labelFormatter={(label, payload) => (payload?.[0]?.payload ? `Hour: ${payload[0].payload.hour}:00 IST` : label)}
        />
        <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={28}>
          {rows.map((d) => (
            <Cell key={d.hour} fill={d.hour === busiestHour ? "#ea580c" : "#fdba74"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
