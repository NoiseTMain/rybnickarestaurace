"use client";
import { FileUp, Upload } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { detectDelimiter, normalizeHeader, parseCSV, toCSV } from "@/lib/csv";
import { parseMoney, formatMoney } from "@/lib/money";
import { formatDate, parseCzechDate } from "@/lib/dates";
import { analyzeBankImport, commitBankImport, type ImportAnalysis } from "@/lib/actions/transactions";
import { importShifts } from "@/lib/actions/work";
import { useLookups } from "@/components/Lookups";
import { Button } from "@/components/ui/Button";
import { FormError, Label, Select } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { ModalButton } from "@/components/ui/ModalButton";
import { useToast } from "@/components/ui/Toast";
import { AccountOptions } from "./common";

async function readText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const utf = new TextDecoder("utf-8").decode(buf);
  // české banky často exportují ve Windows-1250
  if (utf.includes("�")) return new TextDecoder("windows-1250").decode(buf);
  return utf;
}

function guess(headers: string[], patterns: RegExp[]): number {
  const norm = headers.map(normalizeHeader);
  for (const p of patterns) {
    const i = norm.findIndex((h) => p.test(h));
    if (i >= 0) return i;
  }
  return -1;
}

function FilePick({ onText }: { onText: (t: string, name: string) => void }) {
  return (
    <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-ink-2 hover:border-gold/50">
      <FileUp className="h-6 w-6 text-gold" />
      <span>Vyberte soubor CSV</span>
      <span className="text-xs text-ink-3">Oddělovač i kódování (UTF-8 / Windows-1250) se rozpozná automaticky</span>
      <input type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) onText(await readText(f), f.name); }} />
    </label>
  );
}

function ColumnSelect({ label, headers, value, onChange, optional }: { label: string; headers: string[]; value: number; onChange: (v: number) => void; optional?: boolean }) {
  return (
    <Select label={label} value={String(value)} onChange={(e) => onChange(Number(e.target.value))}>
      <option value="-1">{optional ? "— nepoužít —" : "— vyberte sloupec —"}</option>
      {headers.map((h, i) => <option key={i} value={i}>{h || `Sloupec ${i + 1}`}</option>)}
    </Select>
  );
}

// ---------------------------------------------------------------------------
// Bankovní výpis

export function BankImport({ onDone }: { onDone: () => void }) {
  const lk = useLookups();
  const toast = useToast();
  const router = useRouter();
  const [rows, setRows] = useState<string[][] | null>(null);
  const [account, setAccount] = useState(lk.accounts.find((a) => a.include_in_available)?.id ?? "");
  const [map, setMap] = useState({ date: -1, amount: -1, credit: -1, debit: -1, description: -1, counterparty: -1, reference: -1 });
  const [analysis, setAnalysis] = useState<NonNullable<ImportAnalysis["rows"]> | null>(null);
  const [include, setInclude] = useState<Record<number, boolean>>({});
  const [cats, setCats] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const headers = rows?.[0] ?? [];
  const parsed = useMemo(() => {
    if (!rows) return [];
    return rows.slice(1).map((r) => {
      let amount: number | null = null;
      if (map.amount >= 0) amount = parseMoney(r[map.amount]);
      else if (map.credit >= 0 || map.debit >= 0) {
        const c = map.credit >= 0 ? parseMoney(r[map.credit]) ?? 0 : 0;
        const d = map.debit >= 0 ? parseMoney(r[map.debit]) ?? 0 : 0;
        amount = c - Math.abs(d);
      }
      return {
        date: map.date >= 0 ? parseCzechDate(r[map.date]?.trim().split(" ")[0]) : null,
        amount,
        description: map.description >= 0 ? (r[map.description] ?? "").trim().slice(0, 200) : "",
        counterparty: map.counterparty >= 0 ? (r[map.counterparty] ?? "").trim().slice(0, 200) : "",
        reference: map.reference >= 0 ? (r[map.reference] ?? "").trim().slice(0, 100) : "",
      };
    });
  }, [rows, map]);
  const valid = parsed.filter((p) => p.date && p.amount);
  const invalidCount = parsed.length - valid.length;

  function load(text: string) {
    const r = parseCSV(text, detectDelimiter(text));
    if (r.length < 2) return setError("Soubor neobsahuje žádná data.");
    setError(null);
    setRows(r);
    const h = r[0];
    setMap({
      date: guess(h, [/^datum( zauctovani| provedeni)?$/, /datum/, /date/]),
      amount: guess(h, [/^(castka|objem|amount)$/, /castka|objem|amount/]),
      credit: -1, debit: -1,
      description: guess(h, [/zprava pro prijemce/, /popis/, /poznamka/, /description|message/]),
      counterparty: guess(h, [/nazev protiuctu/, /^nazev protistrany$/, /protistran|nazev uctu|counterparty|obchodnik/]),
      reference: guess(h, [/^vs$|variabilni/]),
    });
  }

  const payloadRows = () => valid.map((p) => ({ date: p.date!, amount: p.amount!, description: p.description, counterparty: p.counterparty, reference: p.reference }));

  if (!lk.accounts.length) return <p className="text-sm text-ink-2">Nejdřív přidejte účet v Nastavení.</p>;
  if (!rows) return <div className="space-y-3"><FilePick onText={load} /><FormError error={error ?? undefined} /></div>;

  if (!analysis) {
    return (
      <div className="space-y-4">
        <Select label="Importovat na účet" value={account} onChange={(e) => setAccount(e.target.value)}><AccountOptions /></Select>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <ColumnSelect label="Datum" headers={headers} value={map.date} onChange={(v) => setMap({ ...map, date: v })} />
          <ColumnSelect label="Částka (±)" headers={headers} value={map.amount} onChange={(v) => setMap({ ...map, amount: v })} optional />
          <ColumnSelect label="Popis" headers={headers} value={map.description} onChange={(v) => setMap({ ...map, description: v })} optional />
          <ColumnSelect label="Protistrana" headers={headers} value={map.counterparty} onChange={(v) => setMap({ ...map, counterparty: v })} optional />
          <ColumnSelect label="Variabilní symbol" headers={headers} value={map.reference} onChange={(v) => setMap({ ...map, reference: v })} optional />
          {map.amount < 0 && <>
            <ColumnSelect label="Příjem (kredit)" headers={headers} value={map.credit} onChange={(v) => setMap({ ...map, credit: v })} optional />
            <ColumnSelect label="Výdaj (debet)" headers={headers} value={map.debit} onChange={(v) => setMap({ ...map, debit: v })} optional />
          </>}
        </div>
        <p className="text-sm text-ink-2">Rozpoznáno {valid.length} pohybů{invalidCount ? `, ${invalidCount} řádků bez platného data/částky bude vynecháno` : ""}.</p>
        <Preview rows={valid.slice(0, 5).map((p) => [formatDate(p.date), formatMoney(p.amount!), p.description || p.counterparty])} />
        <FormError error={error ?? undefined} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setRows(null)}>Jiný soubor</Button>
          <Button variant="primary" loading={pending} disabled={!valid.length || !account} onClick={() => start(async () => {
            const r = await analyzeBankImport(JSON.stringify({ account_id: account, rows: payloadRows() }));
            if (!r.ok || !r.rows) return setError(r.error ?? "Analýza selhala");
            setAnalysis(r.rows);
            setInclude(Object.fromEntries(r.rows.map((x) => [x.index, x.status === "new"])));
            setCats(Object.fromEntries(r.rows.map((x) => [x.index, x.categoryId ?? ""])));
          })}>Pokračovat</Button>
        </div>
      </div>
    );
  }

  const statusBadge = { new: <Badge tone="positive">nový</Badge>, imported: <Badge>už importováno</Badge>, possible_duplicate: <Badge tone="warning">možná duplicita</Badge>, before_opening: <Badge tone="info">před poč. zůstatkem</Badge> };
  const selected = analysis.filter((a) => include[a.index]).length;
  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-3">Možné duplicity (stejná částka ±3 dny jako ručně zadaná transakce) a už importované řádky jsou předem odškrtnuté. Pohyby před datem počátečního zůstatku účtu se do zůstatku nepočítají.</p>
      <div className="scroll-thin max-h-[50dvh] overflow-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <tbody>
            {analysis.map((a) => {
              const p = valid[a.index];
              return (
                <tr key={a.index} className="border-b border-white/[0.05] align-top">
                  <td className="p-2"><input type="checkbox" aria-label="Importovat" checked={!!include[a.index]} disabled={a.status === "imported"} onChange={(e) => setInclude({ ...include, [a.index]: e.target.checked })} /></td>
                  <td className="whitespace-nowrap p-2 text-ink-2">{formatDate(p.date)}</td>
                  <td className="min-w-40 p-2">
                    <div className="truncate">{p.description || p.counterparty || "—"}</div>
                    <div className="mt-0.5 flex flex-wrap gap-1">{statusBadge[a.status]}{a.matchDescription && <span className="text-[11px] text-ink-3">{a.matchDescription}</span>}</div>
                  </td>
                  <td className="p-2">
                    <select className="field !py-1 !text-xs" value={cats[a.index] ?? ""} onChange={(e) => setCats({ ...cats, [a.index]: e.target.value })} aria-label="Kategorie">
                      <option value="">—</option>
                      {lk.categories.filter((c) => c.kind === (p.amount! > 0 ? "income" : "expense") && !c.is_archived).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </td>
                  <td className={`whitespace-nowrap p-2 text-right num ${p.amount! > 0 ? "text-pos" : ""}`}>{formatMoney(p.amount!, { sign: true })}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <FormError error={error ?? undefined} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-ink-2">Vybráno {selected}</span>
        <Button variant="primary" loading={pending} disabled={!selected} icon={<Upload className="h-4 w-4" />} onClick={() => start(async () => {
          const rowsOut = payloadRows().map((r, i) => ({ ...r, include: !!include[i], category_id: cats[i] || null }));
          const r = await commitBankImport(JSON.stringify({ account_id: account, rows: rowsOut }));
          if (!r.ok) return setError(r.error ?? "Import selhal");
          toast(r.message ?? "Importováno");
          router.refresh();
          onDone();
        })}>Importovat</Button>
      </div>
    </div>
  );
}

function Preview({ rows }: { rows: (string | undefined)[][] }) {
  if (!rows.length) return null;
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-xs">
        <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-white/[0.05]">{r.map((c, j) => <td key={j} className="whitespace-nowrap p-2 text-ink-2">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function BankImportButton() {
  return <ModalButton label="Import CSV z banky" wide icon={<Upload className="h-4 w-4" />} title="Import bankovních transakcí" render={(close) => <BankImport onDone={close} />} />;
}

// ---------------------------------------------------------------------------
// Směny

const SHIFT_FIELDS: { key: string; label: string; patterns: RegExp[]; required?: boolean }[] = [
  { key: "date", label: "Datum", patterns: [/datum|date|den/], required: true },
  { key: "minutes", label: "Odpracováno (h nebo h:mm)", patterns: [/odpracovan|hodin|cas|hours/] },
  { key: "peak_minutes", label: "Ve špičce", patterns: [/spick|peak/] },
  { key: "regular_routes", label: "Běžné trasy", patterns: [/bezn.*tras|trasy|routes/] },
  { key: "express_routes", label: "Expresní trasy", patterns: [/expres/] },
  { key: "orders", label: "Objednávky", patterns: [/objednav|orders/] },
  { key: "base_earnings", label: "Základní výdělek", patterns: [/vydelek|zaklad|odmena za praci|earnings|mzda/] },
  { key: "tips", label: "Spropitné", patterns: [/spropit|tips|dyska/] },
  { key: "bonuses", label: "Bonusy", patterns: [/bonus/] },
  { key: "rewards", label: "Odměny", patterns: [/^odmeny?$|rewards/] },
  { key: "vehicle_rent", label: "Pronájem vozidla", patterns: [/pronajem|vuz|vozid|auto/] },
  { key: "equipment_cost", label: "Vybavení", patterns: [/vybaven/] },
  { key: "private_km", label: "Soukromé km", patterns: [/soukrom|km/] },
  { key: "other_deductions", label: "Ostatní srážky", patterns: [/srazk|ostatni/] },
  { key: "note", label: "Poznámka", patterns: [/poznam|note/] },
];

export function shiftTemplateCsv() {
  return toCSV([SHIFT_FIELDS.map((f) => f.label), ["6. 11. 2026", "7:30", "2:00", "3", "1", "24", "1450", "120", "0", "0", "250", "0", "12,5", "0", ""]]);
}

export function ShiftImport({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const [rows, setRows] = useState<string[][] | null>(null);
  const [map, setMap] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const headers = rows?.[0] ?? [];
  const out = useMemo(() => (rows ?? []).slice(1).map((r) => {
    const o: Record<string, string> = {};
    for (const f of SHIFT_FIELDS) if ((map[f.key] ?? -1) >= 0) o[f.key] = (r[map[f.key]] ?? "").trim();
    o.date = parseCzechDate(o.date?.split(" ")[0]) ?? "";
    return o;
  }).filter((o) => o.date), [rows, map]);

  if (!rows) {
    return (
      <div className="space-y-3">
        <FilePick onText={(t) => {
          const r = parseCSV(t);
          if (r.length < 2) return setError("Soubor neobsahuje žádná data.");
          setRows(r);
          setMap(Object.fromEntries(SHIFT_FIELDS.map((f) => [f.key, guess(r[0], f.patterns)])));
        }} />
        <a className="inline-block text-xs text-gold hover:underline" href={`data:text/csv;charset=utf-8,${encodeURIComponent(shiftTemplateCsv())}`} download="homeos-smeny-sablona.csv">Stáhnout šablonu CSV</a>
        <FormError error={error ?? undefined} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <Label>Přiřazení sloupců</Label>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {SHIFT_FIELDS.map((f) => <ColumnSelect key={f.key} label={f.label} headers={headers} value={map[f.key] ?? -1} onChange={(v) => setMap({ ...map, [f.key]: v })} optional={!f.required} />)}
      </div>
      <p className="text-sm text-ink-2">Připraveno {out.length} směn. Opakovaný import stejného souboru směny nezdvojí.</p>
      <FormError error={error ?? undefined} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setRows(null)}>Jiný soubor</Button>
        <Button variant="primary" loading={pending} disabled={!out.length} onClick={() => start(async () => {
          const r = await importShifts(JSON.stringify(out));
          if (!r.ok) return setError(r.error ?? "Import selhal");
          toast(r.message ?? "Importováno");
          router.refresh();
          onDone();
        })}>Importovat směny</Button>
      </div>
    </div>
  );
}

export function ShiftImportButton() {
  return <ModalButton label="Import CSV" size="sm" wide icon={<Upload className="h-4 w-4" />} title="Import směn z CSV" render={(close) => <ShiftImport onDone={close} />} />;
}
