/**
 * QR platba (formát SPD – Short Payment Descriptor, standard České bankovní asociace).
 * Účet může být IBAN nebo české číslo účtu („předčíslí-číslo/kód banky“).
 */

/** Převod českého čísla účtu na IBAN. Vrací null u neplatného čísla. */
export function czAccountToIban(input: string): string | null {
  const m = /^(?:(\d{1,6})-)?(\d{2,10})\/(\d{4})$/.exec(input.replace(/\s/g, ""));
  if (!m) return null;
  const prefix = (m[1] ?? "").padStart(6, "0");
  const number = m[2].padStart(10, "0");
  // kontrola modulo 11 (váhy podle vyhlášky ČNB)
  const w = [6, 3, 7, 9, 10, 5, 8, 4, 2, 1];
  const mod11 = (s: string) => s.split("").reduce((a, d, i) => a + Number(d) * w[w.length - s.length + i], 0) % 11 === 0;
  if (!mod11(prefix) || !mod11(number)) return null;
  const bban = m[3] + prefix + number;
  const check = 98 - Number(BigInt(bban + "123500") % 97n); // CZ = 12 35, kontrolní 00
  return `CZ${String(check).padStart(2, "0")}${bban}`;
}

export function normalizeIban(input: string): string | null {
  const s = input.replace(/\s/g, "").toUpperCase();
  if (/^\d|\//.test(s)) return czAccountToIban(s);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return null;
  const rearranged = s.slice(4) + s.slice(0, 4);
  const digits = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  return BigInt(digits) % 97n === 1n ? s : null;
}

/** Text pro QR platbu. Částka v haléřích, zpráva bez hvězdiček a diakritiky. */
export function spdString(p: { iban: string; amount: number; message?: string; currency?: string }): string {
  const msg = (p.message ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\*/g, " ").trim().slice(0, 60);
  return ["SPD", "1.0", `ACC:${p.iban}`, `AM:${(p.amount / 100).toFixed(2)}`, `CC:${p.currency ?? "CZK"}`, msg ? `MSG:${msg}` : null].filter(Boolean).join("*");
}
