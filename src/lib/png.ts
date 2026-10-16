/**
 * Validace PNG souborů denního menu. Funguje v prohlížeči i na serveru
 * (pracuje s Uint8Array). Kontroluje skutečný obsah souboru, ne jen příponu.
 */
export const MENU_MAX_BYTES = 15 * 1024 * 1024; // 15 MB (odpovídá limitu bucketu)
export const MENU_MIN_SIDE = 300;
export const MENU_MAX_SIDE = 12000;
export const MENU_MAX_PIXELS = 80_000_000;

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export type PngCheck =
  | { ok: true; width: number; height: number }
  | { ok: false; error: string };

function readUint32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

/** Ověří signaturu PNG, hlavičku IHDR, rozměry a velikost. */
export function inspectPng(bytes: Uint8Array, size = bytes.byteLength): PngCheck {
  if (size === 0) return { ok: false, error: "Soubor je prázdný." };
  if (size > MENU_MAX_BYTES) {
    return { ok: false, error: `Soubor je příliš velký (${formatBytes(size)}). Maximum je ${formatBytes(MENU_MAX_BYTES)}.` };
  }
  if (bytes.byteLength < 33 || !SIGNATURE.every((b, i) => bytes[i] === b)) {
    return { ok: false, error: "Soubor není platný obrázek PNG. Uložte menu jako PNG a zkuste to znovu." };
  }
  // první chunk musí být IHDR o délce 13 bajtů
  const ihdrLength = readUint32(bytes, 8);
  const type = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (type !== "IHDR" || ihdrLength !== 13) {
    return { ok: false, error: "Soubor PNG je poškozený (chybí hlavička IHDR)." };
  }
  const width = readUint32(bytes, 16);
  const height = readUint32(bytes, 20);
  if (!width || !height) return { ok: false, error: "Obrázek má neplatné rozměry." };
  if (Math.min(width, height) < MENU_MIN_SIDE) {
    return {
      ok: false,
      error: `Obrázek je příliš malý (${width} × ${height} px). Kratší strana musí mít alespoň ${MENU_MIN_SIDE} px, aby bylo menu čitelné.`,
    };
  }
  if (Math.max(width, height) > MENU_MAX_SIDE || width * height > MENU_MAX_PIXELS) {
    return { ok: false, error: `Obrázek má příliš velké rozměry (${width} × ${height} px).` };
  }
  return { ok: true, width, height };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

/** Bezpečný název souboru do e-mailu / ke stažení. */
export function safeFilename(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\.png$/i, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base || "denni-menu"}.png`;
}
