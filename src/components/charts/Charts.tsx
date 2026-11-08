"use client";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/money";
import { formatDate, shortMonth } from "@/lib/dates";

/** Aktuální barva zvýraznění (mění se podle zvoleného vzhledu). */
function useAccent(): { gold: string; bright: string } {
  const [c, setC] = useState({ gold: "#d4b483", bright: "#ecd3a2" });
  useEffect(() => {
    const read = () => {
      const st = getComputedStyle(document.documentElement);
      setC({ gold: st.getPropertyValue("--color-gold").trim() || "#d4b483", bright: st.getPropertyValue("--color-gold-bright").trim() || "#ecd3a2" });
    };
    read();
    window.addEventListener("homeos-theme", read);
    return () => window.removeEventListener("homeos-theme", read);
  }, []);
  return c;
}

const AXIS = { stroke: "var(--chart-axis)", fontSize: 11, tickLine: false, axisLine: false } as const;
const kc = (c: number) => formatMoney(c, { decimals: "never" });
const compact = (c: number) => {
  const v = c / 100;
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} mil`;
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)} tis`;
  return `${Math.round(v)}`;
};

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: number; color?: string }[] }) {
  return (
    <div className="glass-strong rounded-xl px-3 py-2 text-xs">
      <div className="mb-1 text-ink-3">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          {r.color && <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />}
          <span className="text-ink-2">{r.label}</span>
          <span className="num ml-auto pl-3 text-ink">{kc(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="mb-2 flex flex-wrap gap-3 text-xs text-ink-2">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ background: i.dashed ? `repeating-linear-gradient(90deg, ${i.color} 0 4px, transparent 4px 7px)` : i.color, height: i.dashed ? 2 : 8, width: i.dashed ? 16 : 8, borderRadius: i.dashed ? 0 : 999 }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** Vývoj zůstatku (jedna řada → bez legendy, název nese karta). */
export function BalanceChart({ data }: { data: { date: string; total: number; liquid: number }[] }) {
  const { gold } = useAccent();
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="balFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={gold} stopOpacity={0.35} />
              <stop offset="100%" stopColor={gold} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="date" {...AXIS} tickFormatter={(d: string) => `${Number(d.slice(8))}. ${Number(d.slice(5, 7))}.`} minTickGap={40} />
          <YAxis {...AXIS} width={52} tickFormatter={compact} />
          <Tooltip cursor={{ stroke: "rgba(244,239,230,0.3)" }} content={({ active, payload }) => active && payload?.length ? (
            <TooltipBox title={formatDate(payload[0].payload.date)} rows={[{ label: "Celkem", value: payload[0].payload.total }, { label: "Běžné účty", value: payload[0].payload.liquid }]} />
          ) : null} />
          <Area type="monotone" dataKey="total" stroke={gold} strokeWidth={2} fill="url(#balFill)" dot={false} activeDot={{ r: 4, stroke: "#121214", strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

const INCOME = "#c98500";
const EXPENSE = "#3987e5";

export function IncomeExpenseChart({ data }: { data: { month: string; start: string; income: number; expense: number }[] }) {
  return (
    <div className="w-full">
      <Legend items={[{ label: "Příjmy", color: INCOME }, { label: "Výdaje", color: EXPENSE }]} />
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barGap={2} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="start" {...AXIS} tickFormatter={shortMonth} />
            <YAxis {...AXIS} width={52} tickFormatter={compact} />
            <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={({ active, payload }) => active && payload?.length ? (
              <TooltipBox title={shortMonth(payload[0].payload.start)} rows={[
                { label: "Příjmy", value: payload[0].payload.income, color: INCOME },
                { label: "Výdaje", value: payload[0].payload.expense, color: EXPENSE },
                { label: "Rozdíl", value: payload[0].payload.income - payload[0].payload.expense },
              ]} />
            ) : null} />
            <Bar dataKey="income" fill={INCOME} radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar dataKey="expense" fill={EXPENSE} radius={[4, 4, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export const CATEGORY_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9"];
const OTHER = "#6b665e";

/** Výdaje podle kategorií – max. 7 barev + „Ostatní“, vždy s legendou a hodnotami. */
export function CategoryDonut({ data }: { data: { name: string; amount: number }[] }) {
  const sorted = [...data].sort((a, b) => b.amount - a.amount);
  const top = sorted.slice(0, 7);
  const rest = sorted.slice(7).reduce((a, x) => a + x.amount, 0);
  const items = [...top.map((d, i) => ({ ...d, color: CATEGORY_COLORS[i] })), ...(rest > 0 ? [{ name: "Ostatní", amount: rest, color: OTHER }] : [])];
  const total = items.reduce((a, x) => a + x.amount, 0);
  if (!total) return <p className="py-8 text-center text-sm text-ink-3">Tento měsíc zatím žádné výdaje.</p>;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-40 w-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={items} dataKey="amount" nameKey="name" innerRadius="68%" outerRadius="100%" stroke="#141414" strokeWidth={2} paddingAngle={1}>
              {items.map((i) => <Cell key={i.name} fill={i.color} />)}
            </Pie>
            <Tooltip content={({ active, payload }) => active && payload?.length ? <TooltipBox title={String(payload[0].name)} rows={[{ label: `${Math.round((Number(payload[0].value) / total) * 100)} %`, value: Number(payload[0].value), color: (payload[0].payload as { color: string }).color }]} /> : null} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] uppercase tracking-wider text-ink-3">Celkem</span>
          <span className="num text-sm font-semibold">{kc(total)}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-1.5 text-sm">
        {items.map((i) => (
          <li key={i.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: i.color }} />
            <span className="min-w-0 flex-1 truncate text-ink-2">{i.name}</span>
            <span className="text-xs text-ink-3">{Math.round((i.amount / total) * 100)} %</span>
            <span className="num w-24 text-right">{kc(i.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Kumulativní útrata na jídlo vs. rovnoměrný plán. */
export function FoodPaceChart({ data }: { data: { day: number; plan: number; actual: number | null }[] }) {
  const { gold } = useAccent();
  return (
    <div className="w-full">
      <Legend items={[{ label: "Skutečnost", color: gold }, { label: "Plán", color: "#8e877b", dashed: true }]} />
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="day" {...AXIS} tickFormatter={(d: number) => `${d}.`} minTickGap={24} />
            <YAxis {...AXIS} width={52} tickFormatter={compact} />
            <Tooltip cursor={{ stroke: "rgba(244,239,230,0.3)" }} content={({ active, payload }) => active && payload?.length ? (
              <TooltipBox title={`${payload[0].payload.day}. den`} rows={[
                ...(payload[0].payload.actual != null ? [{ label: "Utraceno", value: payload[0].payload.actual as number, color: gold }] : []),
                { label: "Plán", value: payload[0].payload.plan, color: "#8e877b" },
              ]} />
            ) : null} />
            <Line type="monotone" dataKey="plan" stroke="#8e877b" strokeWidth={2} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="actual" stroke={gold} strokeWidth={2} dot={false} connectNulls={false} activeDot={{ r: 4, stroke: "#121214", strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Čistý pracovní výsledek v čase (jedna řada). */
export function WorkChart({ data }: { data: { label: string; net: number; hours: number }[] }) {
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" {...AXIS} minTickGap={12} />
          <YAxis {...AXIS} width={52} tickFormatter={compact} />
          <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={({ active, payload }) => active && payload?.length ? (
            <TooltipBox title={`${payload[0].payload.label} · ${payload[0].payload.hours.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} h`} rows={[{ label: "Čistý výsledek", value: payload[0].payload.net }]} />
          ) : null} />
          <Bar dataKey="net" radius={[4, 4, 0, 0]} maxBarSize={28}>
            {data.map((d, i) => <Cell key={i} fill={d.net < 0 ? "#e66767" : i === data.length - 1 ? "#ecd3a2" : "#c98500"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Útrata po dnech cesty, s čarou denního limitu. */
export function TripDaysChart({ data, limit }: { data: { label: string; amount: number }[]; limit: number | null }) {
  const { gold } = useAccent();
  return (
    <div className="w-full">
      {limit != null && <Legend items={[{ label: "Utraceno za den", color: gold }, { label: "Denní limit", color: "#8e877b", dashed: true }]} />}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data.map((d) => ({ ...d, limit }))} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="label" {...AXIS} minTickGap={8} />
            <YAxis {...AXIS} width={52} tickFormatter={compact} />
            <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={({ active, payload }) => active && payload?.length ? (
              <TooltipBox title={String(payload[0].payload.label)} rows={[{ label: "Utraceno", value: payload[0].payload.amount, color: gold }, ...(limit != null ? [{ label: "Limit", value: limit, color: "#8e877b" }] : [])]} />
            ) : null} />
            <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={32}>
              {data.map((d, i) => <Cell key={i} fill={limit != null && d.amount > limit ? "#e66767" : gold} />)}
            </Bar>
            {limit != null && <Line type="monotone" dataKey="limit" stroke="#8e877b" strokeDasharray="4 3" dot={false} isAnimationActive={false} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Srovnání cest: útrata na osobu a den. */
export function TripCompareChart({ data }: { data: { label: string; perPersonDay: number; total: number }[] }) {
  const { gold } = useAccent();
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" {...AXIS} interval={0} tick={{ fontSize: 10 }} />
          <YAxis {...AXIS} width={52} tickFormatter={compact} />
          <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={({ active, payload }) => active && payload?.length ? (
            <TooltipBox title={String(payload[0].payload.label)} rows={[{ label: "Na osobu a den", value: payload[0].payload.perPersonDay, color: gold }, { label: "Celkem", value: payload[0].payload.total }]} />
          ) : null} />
          <Bar dataKey="perPersonDay" radius={[4, 4, 0, 0]} maxBarSize={36} fill={gold} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
