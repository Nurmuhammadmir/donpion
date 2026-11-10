import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function formatUZS(amount: number) {
  return `${new Intl.NumberFormat("ru-RU").format(Math.round(amount))} сум`;
}

function formatCompact(amount: number) {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace(/\.0$/, "")}М`;
  if (abs >= 1_000) return `${Math.round(amount / 1_000)}К`;
  return `${Math.round(amount)}`;
}

const HERMES_500 = "#F9511D";

export interface ExpenseChartDatum {
  key: string;
  label: string;
  fullLabel: string;
  amount: number;
}

// Pulled out of Finance so recharts (~100KB gzipped) is only fetched once
// this actually renders, behind a Suspense boundary, instead of on every
// single visit to Финансы before the admin even scrolls to it.
export default function ExpenseBreakdownChart({ data }: { data: ExpenseChartDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 44)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: 4 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="label" width={104} tickLine={false} axisLine={false} tick={{ fill: "#5A564F", fontSize: 12 }} />
        <Tooltip
          cursor={{ fill: "#FAF9F6" }}
          separator=": "
          formatter={(value) => formatUZS(Number(value))}
          labelFormatter={(label) => data.find((d) => d.label === label)?.fullLabel ?? label}
          contentStyle={{ borderRadius: 2, border: "1px solid #E7E1D6", background: "#FFFFFF", boxShadow: "none", fontSize: 12 }}
          labelStyle={{ color: "#1A1A1A", fontWeight: 600, marginBottom: 2 }}
          itemStyle={{ color: "#5A564F" }}
        />
        <Bar dataKey="amount" name="Сумма" fill={HERMES_500} radius={[0, 4, 4, 0]} barSize={20}>
          <LabelList dataKey="amount" position="right" formatter={(value) => formatCompact(Number(value))} style={{ fill: "#1A1A1A", fontSize: 11 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
