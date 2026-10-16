import { describe, expect, it } from "vitest";
import { buildMenuEmail } from "@/lib/email/menu-email";
import { formatPrice, mapLinks, telHref } from "@/lib/format";
import { inquirySchema } from "@/lib/inquiry";
import { checkMenuDateRange, MENU_PATH_RE, registerMenuSchema } from "@/lib/menus";

const contact = {
  restaurant_name: "Restaurace Rybníky",
  address_street: "Rybníky 40",
  address_zip: "263 01",
  address_city: "Dobříš",
  phone: "+420 602 163 330",
};

describe("e-mail s menu", () => {
  it("má předepsaný předmět a text", () => {
    const { subject, text, html } = buildMenuEmail("2026-10-16", contact);
    expect(subject).toBe("Denní menu – Restaurace Rybníky – 16. 10. 2026");
    expect(text).toBe(
      [
        "Dobrý den,",
        "",
        "v příloze zasíláme denní menu Restaurace Rybníky pro příslušný den.",
        "",
        "Soubor je připravený k vytištění v restauraci.",
        "",
        "Restaurace Rybníky",
        "Rybníky 40, 263 01 Dobříš",
        "+420 602 163 330",
      ].join("\n"),
    );
    expect(html).toContain("Soubor je připravený k vytištění v restauraci.");
  });
  it("escapuje HTML v údajích", () => {
    expect(buildMenuEmail("2026-10-16", { ...contact, restaurant_name: "<b>x</b>" }).html).not.toContain("<b>x</b>");
  });
});

describe("formát a odkazy", () => {
  it("ceny v Kč", () => {
    expect(formatPrice(145)).toBe("145 Kč");
    expect(formatPrice("39.5")).toBe("39,50 Kč");
    expect(formatPrice(1290)).toMatch(/^1\s290 Kč$/);
    expect(formatPrice(null)).toBeNull();
  });
  it("klikatelný telefon", () => {
    expect(telHref("+420 602 163 330")).toBe("tel:+420602163330");
  });
  it("navigace na adresu", () => {
    const l = mapLinks({ ...contact, latitude: null, longitude: null });
    expect(l.directions).toContain(encodeURIComponent("Rybníky 40, 263 01 Dobříš"));
  });
});

describe("validace menu", () => {
  it("cesta k souboru musí mít přesný formát", () => {
    expect(MENU_PATH_RE.test("2026/10/2026-10-16_0b6f8d0e-6c63-4b61-9df4-7c3ab1e0f2a1.png")).toBe(true);
    expect(MENU_PATH_RE.test("../2026/10/x.png")).toBe(false);
    expect(MENU_PATH_RE.test("2026/10/2026-10-16_0b6f8d0e-6c63-4b61-9df4-7c3ab1e0f2a1.svg")).toBe(false);
  });
  it("odmítne neplatné datum", () => {
    expect(registerMenuSchema.safeParse({ storagePath: "2026/02/2026-02-30_0b6f8d0e-6c63-4b61-9df4-7c3ab1e0f2a1.png", originalFilename: "a.png", menuDate: "2026-02-30" }).success).toBe(false);
  });
  it("rozsah data", () => {
    expect(checkMenuDateRange("2026-10-16", "2026-10-16")).toBeNull();
    expect(checkMenuDateRange("2027-10-16", "2026-10-16")).not.toBeNull();
  });
});

describe("poptávkový formulář", () => {
  const base = { kind: "event", name: "Jan Novák", phone: "+420 777 123 456", consent: true };
  it("přijme minimální poptávku", () => {
    expect(inquirySchema.safeParse(base).success).toBe(true);
  });
  it("vyžaduje souhlas a telefon", () => {
    expect(inquirySchema.safeParse({ ...base, consent: false }).success).toBe(false);
    expect(inquirySchema.safeParse({ ...base, phone: "abc" }).success).toBe(false);
  });
  it("honeypot projde validací (robot dostane falešné „OK“, poptávka se neuloží)", () => {
    const r = inquirySchema.safeParse({ ...base, website: "spam" });
    expect(r.success && r.data.website).toBe("spam");
  });
});
