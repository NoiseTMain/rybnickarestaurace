import { describe, expect, it } from "vitest";
import { inspectPng, MENU_MAX_BYTES, safeFilename } from "@/lib/png";

function pngHeader(width: number, height: number): Uint8Array {
  const b = new Uint8Array(64);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  b.set([0, 0, 0, 13], 8);
  b.set([...("IHDR" as string)].map((c) => c.charCodeAt(0)), 12);
  const dv = new DataView(b.buffer);
  dv.setUint32(16, width);
  dv.setUint32(20, height);
  return b;
}

describe("inspectPng", () => {
  it("přijme platné PNG a vrátí rozměry", () => {
    expect(inspectPng(pngHeader(1240, 1754))).toEqual({ ok: true, width: 1240, height: 1754 });
  });
  it("odmítne JPEG přejmenovaný na .png", () => {
    const jpeg = new Uint8Array(64);
    jpeg.set([0xff, 0xd8, 0xff, 0xe0]);
    const r = inspectPng(jpeg);
    expect(r.ok).toBe(false);
  });
  it("odmítne prázdný a příliš velký soubor", () => {
    expect(inspectPng(new Uint8Array(0)).ok).toBe(false);
    expect(inspectPng(pngHeader(1000, 1000), MENU_MAX_BYTES + 1).ok).toBe(false);
  });
  it("odmítne příliš malý obrázek (nečitelné menu)", () => {
    const r = inspectPng(pngHeader(200, 900));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/příliš malý/);
  });
  it("odmítne extrémní rozměry", () => {
    expect(inspectPng(pngHeader(20000, 1000)).ok).toBe(false);
  });
  it("odmítne PNG bez IHDR", () => {
    const b = pngHeader(1000, 1000);
    b[12] = 0x58;
    expect(inspectPng(b).ok).toBe(false);
  });
});

describe("safeFilename", () => {
  it("odstraní diakritiku a nebezpečné znaky", () => {
    expect(safeFilename("Menu pátek 16.10..PNG")).toBe("Menu-patek-16.10..png");
    expect(safeFilename("../../etc/passwd")).toBe("..-..-etc-passwd.png");
    expect(safeFilename("")).toBe("denni-menu.png");
  });
});
