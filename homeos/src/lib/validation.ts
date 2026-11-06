import { z } from "zod";
import { parseMoney } from "@/lib/money";
import { isISODate } from "@/lib/dates";

/** Pomocné typy pro validaci formulářů (FormData → typované hodnoty). */

const empty = (v: unknown) => v == null || (typeof v === "string" && v.trim() === "");

export const money = (opts: { min?: number; allowNegative?: boolean } = {}) =>
  z.preprocess(
    (v) => (empty(v) ? undefined : typeof v === "number" ? v : parseMoney(String(v)) ?? Number.NaN),
    z.number({ error: "Zadejte částku" })
      .refine((n) => !Number.isNaN(n), "Neplatná částka – použijte např. 1 234,50")
      .refine((n) => Number.isSafeInteger(n), "Částka je příliš velká")
      .refine((n) => opts.allowNegative || n >= (opts.min ?? 0), opts.min ? `Částka musí být alespoň ${opts.min / 100} Kč` : "Částka nesmí být záporná"),
  );

/** Nevyplněné pole = 0 Kč (např. spropitné u směny). */
export const moneyOrZero = () => z.preprocess((v) => (empty(v) ? 0 : v), money());

export const optionalMoney = (opts: { min?: number } = {}) =>
  z.preprocess((v) => (empty(v) ? null : v), z.union([z.null(), money(opts)]));

export const date = () =>
  z.preprocess((v) => (empty(v) ? undefined : v), z.string({ error: "Zadejte datum" }).refine(isISODate, "Neplatné datum"));

export const optionalDate = () => z.preprocess((v) => (empty(v) ? null : v), z.union([z.null(), z.string().refine(isISODate, "Neplatné datum")]));

export const text = (max = 200) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string({ error: "Povinné pole" }).min(1, "Povinné pole").max(max, `Nejvýše ${max} znaků`));

export const optText = (max = 200) =>
  z.preprocess((v) => (empty(v) ? null : String(v).trim()), z.union([z.null(), z.string().max(max, `Nejvýše ${max} znaků`)]));

export const uuid = () => z.string().uuid("Neplatný výběr");
export const optionalUuid = () => z.preprocess((v) => (empty(v) ? null : v), z.union([z.null(), z.string().uuid("Neplatný výběr")]));

export const checkbox = () => z.preprocess((v) => v === "on" || v === "true" || v === true || v === "1", z.boolean());

export const int = (min = 0, max = 1_000_000) =>
  z.preprocess((v) => (empty(v) ? 0 : Number(String(v).replace(",", "."))), z.number().int("Zadejte celé číslo").min(min, `Minimálně ${min}`).max(max, `Maximálně ${max}`));

/** „7:30“, „7,5“ nebo „450“ (minuty) → minuty. */
export const duration = () =>
  z.preprocess((v) => {
    if (empty(v)) return 0;
    const s = String(v).trim();
    const hm = /^(\d{1,2}):(\d{2})$/.exec(s);
    if (hm) return Number(hm[1]) * 60 + Number(hm[2]);
    const h = /^(\d{1,2})(?:[.,](\d{1,2}))?\s*h$/.exec(s) ?? /^(\d{1,2})[.,](\d{1,2})$/.exec(s);
    if (h) return Math.round((Number(h[1]) + Number(`0.${h[2] ?? 0}`)) * 60);
    if (/^\d{1,2}$/.test(s)) return Number(s) * 60;
    if (/^\d{3,4}$/.test(s)) return Number(s);
    return Number.NaN;
  }, z.number().int().min(0, "Neplatný čas").max(1440, "Nejvýše 24 hodin").refine((n) => !Number.isNaN(n), "Zadejte čas jako 7:30 nebo 7,5"));

export const quantity = () =>
  z.preprocess((v) => (empty(v) ? "0" : String(v).trim().replace(",", ".")), z.string().regex(/^\d{1,6}(\.\d)?$/, "Zadejte číslo s nejvýše jedním desetinným místem"));

export const ico = () =>
  z.preprocess((v) => (empty(v) ? null : String(v).replace(/\s/g, "")), z.union([z.null(), z.string().regex(/^\d{8}$/, "IČO má 8 číslic")]));

export const url = () =>
  z.preprocess((v) => (empty(v) ? null : String(v).trim()), z.union([z.null(), z.string().regex(/^https?:\/\/\S+$/i, "Zadejte odkaz začínající https://").max(1000)]));

export function enumOf<const T extends readonly [string, ...string[]]>(values: T) {
  return z.enum(values, { error: "Vyberte možnost" });
}

export function formToObject(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string" && !k.startsWith("$ACTION")) out[k] = v;
  return out;
}
