import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function formatUZS(amount: number) {
  return `${new Intl.NumberFormat("ru-RU").format(amount)} сум`;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}М`;
  }
  if (n >= 1_000) return `${Math.round(n / 1000)}К`;
  return String(n);
}

export interface TrendPoint {
  key: string;
  label: string;
  fullLabel: string;
  revenue: number;
}

function TrendTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: TrendPoint }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="border border-hairline bg-paper px-3 py-2 text-xs">
      <p className="capitalize text-graphite">{point.fullLabel}</p>
      <p className="mt-0.5 text-sm font-semibold text-ink">{formatUZS(point.revenue)}</p>
    </div>
  );
}

// Pulled out of Dashboard so recharts (~100KB gzipped) is only fetched
// once this actually renders, behind a Suspense boundary, instead of on
// every single visit to the landing page before the admin even sees it.
export default function RevenueTrendChart({ trend }: { trend: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={trend} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F9511D" stopOpacity={0.16} />
            <stop offset="100%" stopColor="#F9511D" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#E7E1D6" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#5A564F" }}
          axisLine={{ stroke: "#E7E1D6" }}
          tickLine={false}
          interval={1}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#5A564F" }}
          axisLine={false}
          tickLine={false}
          width={44}
          domain={[0, "auto"]}
          tickFormatter={formatCompact}
        />
        <Tooltip content={<TrendTooltip />} cursor={{ stroke: "#1A1A1A", strokeOpacity: 0.12 }} />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#F9511D"
          strokeWidth={2}
          fill="url(#revenueFill)"
          dot={false}
          activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff", fill: "#F9511D" }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
