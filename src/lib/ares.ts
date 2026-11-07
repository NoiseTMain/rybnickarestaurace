import "server-only";
import { isValidIco } from "@/lib/invoice-parse";
import type { IcoInfo } from "@/lib/db/types";

const LEGAL_FORMS: Record<string, string> = {
  "101": "Fyzická osoba podnikající (živnostník)",
  "105": "Fyzická osoba podnikající dle jiného zákona",
  "107": "Zemědělský podnikatel",
  "112": "Společnost s ručením omezeným",
  "121": "Akciová společnost",
  "111": "Veřejná obchodní společnost",
  "113": "Komanditní společnost",
  "205": "Družstvo",
  "706": "Spolek",
  "801": "Obec",
};

/** Údaje o subjektu z ARES (Administrativní registr ekonomických subjektů, MF ČR). */
export function parseAres(json: Record<string, unknown>, ico: string): IcoInfo {
  const sidlo = (json.sidlo ?? {}) as { textovaAdresa?: string };
  const form = typeof json.pravniForma === "string" ? json.pravniForma : null;
  return {
    ico,
    name: typeof json.obchodniJmeno === "string" ? json.obchodniJmeno : null,
    address: sidlo.textovaAdresa ?? null,
    legalForm: form ? (LEGAL_FORMS[form] ?? `Právní forma ${form}`) : null,
    dic: typeof json.dic === "string" ? json.dic : null,
    established: typeof json.datumVzniku === "string" ? json.datumVzniku : null,
    verified: true,
    source: "ares",
    checkedAt: new Date().toISOString(),
  };
}

export async function lookupAres(ico: string): Promise<{ ok: true; info: IcoInfo; ceased: boolean } | { ok: false; error: string; notFound?: boolean }> {
  if (!/^\d{8}$/.test(ico)) return { ok: false, error: "IČO má 8 číslic." };
  if (!isValidIco(ico)) return { ok: false, error: "Toto IČO nemá platný kontrolní součet – zkontrolujte číslice." };
  try {
    const res = await fetch(`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (res.status === 404) return { ok: false, error: "Subjekt s tímto IČO v registru ARES neexistuje.", notFound: true };
    if (!res.ok) return { ok: false, error: `Registr ARES je nedostupný (${res.status}). Zkuste to později.` };
    const json = (await res.json()) as Record<string, unknown>;
    return { ok: true, info: parseAres(json, ico), ceased: typeof json.datumZaniku === "string" };
  } catch {
    return { ok: false, error: "Registr ARES teď neodpovídá. Zkuste to za chvíli." };
  }
}
