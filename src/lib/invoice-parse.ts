import { parseMoney, type Cents } from "@/lib/money";
import { parseCzechDate, type ISODate } from "@/lib/dates";

/**
 * Vytěžení údajů z textu faktury (výstup OCR nebo textové vrstvy PDF).
 * Výsledek je POUZE NÁVRH – každé pole má míru jistoty a uživatel jej
 * musí před uložením zkontrolovat a potvrdit.
 */
export interface ExtractedField<T> {
  value: T | null;
  confidence: "high" | "low" | "none";
  source?: string;
}

export interface ExtractedInvoice {
  number: ExtractedField<string>;
  counterparty: ExtractedField<string>;
  counterpartyIco: ExtractedField<string>;
  issueDate: ExtractedField<ISODate>;
  dueDate: ExtractedField<ISODate>;
  amount: ExtractedField<Cents>;
  variableSymbol: ExtractedField<string>;
}

const DATE = String.raw`(\d{1,2}\.\s?\d{1,2}\.\s?(?:\d{4}|\d{2})|\d{4}-\d{2}-\d{2})`;
const AMOUNT = String.raw`(-?\d{1,3}(?:[  .]\d{3})*(?:[,.]\d{1,2})?|-?\d+(?:[,.]\d{1,2})?)`;

function strip(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function none<T>(): ExtractedField<T> {
  return { value: null, confidence: "none" };
}

/** Kontrola IČO podle váženého součtu (mod 11). */
export function isValidIco(ico: string): boolean {
  if (!/^\d{8}$/.test(ico)) return false;
  let s = 0;
  for (let i = 0; i < 7; i++) s += Number(ico[i]) * (8 - i);
  const r = s % 11;
  const check = r === 0 ? 1 : r === 1 ? 0 : 11 - r;
  return check === Number(ico[7]);
}

function findDate(text: string, labels: string[]): ExtractedField<ISODate> {
  const norm = strip(text);
  for (const label of labels) {
    const re = new RegExp(`${label}[^\\d\\n]{0,25}${DATE}`, "i");
    const m = re.exec(norm);
    if (m) {
      const d = parseCzechDate(m[1].replace(/\s/g, " ").replace(/\.\s/g, "."));
      if (d) return { value: d, confidence: "high", source: m[0].trim() };
    }
  }
  return none();
}

export function extractInvoice(text: string, ownIco?: string | null): ExtractedInvoice {
  const norm = strip(text);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const normLines = lines.map(strip);

  // číslo faktury
  let number: ExtractedField<string> = none();
  const numM = /(?:faktura|danovy doklad|cislo faktury|c\. faktury|cislo dokladu|invoice(?: no\.?| number)?)\s*(?:c\.|cislo|no\.?|#)?\s*[:.]?\s*([A-Z0-9][A-Z0-9/\-]{2,24})/i.exec(norm);
  if (numM && /\d/.test(numM[1])) number = { value: numM[1].toUpperCase(), confidence: "high", source: numM[0].trim() };

  // variabilní symbol
  let variableSymbol: ExtractedField<string> = none();
  const vsM = /(?:variabilni symbol|var\. symbol|v\.\s?s\.|\bvs)\s*[:.]?\s*(\d{1,10})/i.exec(norm);
  if (vsM) variableSymbol = { value: vsM[1], confidence: "high", source: vsM[0].trim() };
  if (!number.value && variableSymbol.value) number = { value: variableSymbol.value, confidence: "low", source: "variabilní symbol" };

  // IČO – vezmeme první platné, které není naše vlastní
  let counterpartyIco: ExtractedField<string> = none();
  const icoRe = /\bic(?:o)?\s*[:.]?\s*(\d{2}\s?\d{3}\s?\d{3}|\d{8})\b/gi;
  for (const m of norm.matchAll(icoRe)) {
    const ico = m[1].replace(/\s/g, "");
    if (ownIco && ico === ownIco) continue;
    counterpartyIco = { value: ico, confidence: isValidIco(ico) ? "high" : "low", source: m[0].trim() };
    break;
  }

  // protistrana – řádek za „Dodavatel“/„Odběratel“
  let counterparty: ExtractedField<string> = none();
  const labelIdx = (re: RegExp) => normLines.findIndex((l) => re.test(l));
  const candidates = [labelIdx(/^dodavatel\b|\bdodavatel\s*:/), labelIdx(/^odberatel\b|\bodberatel\s*:/)];
  for (const idx of candidates) {
    if (idx < 0) continue;
    const sameLine = lines[idx].split(/:\s*/)[1];
    const name = sameLine && sameLine.length > 2 ? sameLine : lines[idx + 1];
    if (name && !/^(ic|dic|ico)/i.test(strip(name))) {
      counterparty = { value: name.slice(0, 120), confidence: "low", source: lines[idx] };
      break;
    }
  }

  const issueDate = findDate(text, ["datum vystaveni", "vystaveno", "datum vyhotoveni", "issue date", "date of issue"]);
  const dueDate = findDate(text, ["datum splatnosti", "splatnost", "splatno", "due date"]);
  if (issueDate.value == null) {
    const duzp = findDate(text, ["duzp", "datum uskutecneni zdanitelneho plneni", "datum zdanitelneho plneni"]);
    if (duzp.value) Object.assign(issueDate, { ...duzp, confidence: "low" });
  }

  // částka – preferujeme „celkem k úhradě“, jinak největší částka u „celkem“
  let amount: ExtractedField<Cents> = none();
  const strong = new RegExp(`(?:celkem k uhrade|k uhrade|castka k uhrade|celkova castka|total due|amount due)[^\\d\\n-]{0,30}${AMOUNT}`, "i").exec(norm);
  if (strong) {
    const v = parseMoney(strong[1]);
    if (v != null && v > 0) amount = { value: v, confidence: "high", source: strong[0].trim() };
  }
  if (amount.value == null) {
    let best: Cents | null = null;
    let src = "";
    for (const m of norm.matchAll(new RegExp(`(?:celkem|total|suma)[^\\d\\n-]{0,30}${AMOUNT}`, "gi"))) {
      const v = parseMoney(m[1]);
      if (v != null && (best == null || v > best)) {
        best = v;
        src = m[0];
      }
    }
    if (best != null) amount = { value: best, confidence: "low", source: src.trim() };
  }

  return { number, counterparty, counterpartyIco, issueDate, dueDate, amount, variableSymbol };
}
