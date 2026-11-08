import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** TOTP (RFC 6238) pro dvoufázové ověření v lokálním režimu. V Supabase se používá jeho vestavěné MFA. */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.replace(/=+$/, "").toUpperCase().replace(/\s/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const c of clean) {
    const i = ALPHABET.indexOf(c);
    if (i < 0) throw new Error("Neplatný klíč");
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

export function newTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function totpCode(secret: string, time = Date.now(), step = 30): string {
  const counter = Math.floor(time / 1000 / step);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", base32Decode(secret)).update(buf).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, "0");
}

/** Ověří kód s tolerancí ±1 krok (30 s) kvůli nepřesným hodinám. */
export function verifyTotp(secret: string, code: string, time = Date.now()): boolean {
  const c = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(c)) return false;
  for (const d of [-1, 0, 1]) {
    const exp = Buffer.from(totpCode(secret, time + d * 30_000));
    if (timingSafeEqual(exp, Buffer.from(c))) return true;
  }
  return false;
}

export function otpauthUri(secret: string, email: string): string {
  return `otpauth://totp/HomeOS:${encodeURIComponent(email)}?secret=${secret}&issuer=HomeOS&algorithm=SHA1&digits=6&period=30`;
}
