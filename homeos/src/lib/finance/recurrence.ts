import { addDays, addMonths, parts, type ISODate } from "@/lib/dates";

export type Frequency = "once" | "weekly" | "monthly" | "quarterly" | "yearly";

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  once: "Jednorázově",
  weekly: "Týdně",
  monthly: "Měsíčně",
  quarterly: "Čtvrtletně",
  yearly: "Ročně",
};

/** Kolikrát za měsíc v průměru (pro odhad měsíční zátěže) jako zlomek čitatel/jmenovatel. */
export const FREQUENCY_PER_MONTH: Record<Frequency, [number, number]> = {
  once: [0, 1],
  weekly: [52, 12],
  monthly: [1, 1],
  quarterly: [1, 3],
  yearly: [1, 12],
};

export interface Schedule {
  frequency: Frequency;
  start_date: ISODate;
  end_date?: ISODate | null;
}

function step(s: Schedule, i: number): ISODate {
  const anchorDay = parts(s.start_date).d;
  switch (s.frequency) {
    case "once":
      return s.start_date;
    case "weekly":
      return addDays(s.start_date, 7 * i);
    case "monthly":
      return addMonths(s.start_date, i, anchorDay);
    case "quarterly":
      return addMonths(s.start_date, 3 * i, anchorDay);
    case "yearly":
      return addMonths(s.start_date, 12 * i, anchorDay);
  }
}

/** Všechny termíny splatnosti v intervalu [from, to] (včetně). */
export function occurrences(s: Schedule, from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  if (s.frequency === "once") {
    if (s.start_date >= from && s.start_date <= to) out.push(s.start_date);
    return out;
  }
  for (let i = 0; i < 10_000; i++) {
    const d = step(s, i);
    if (d > to) break;
    if (s.end_date && d > s.end_date) break;
    if (d >= from) out.push(d);
  }
  return out;
}

export function nextOccurrence(s: Schedule, from: ISODate): ISODate | null {
  const horizon = addMonths(from, 13);
  return occurrences(s, from, horizon)[0] ?? null;
}
