import "server-only";
import { randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { AppContext } from "@/lib/context";
import { parseMoney } from "@/lib/money";

/**
 * Načtení náhledu produktu z odkazu (název, cena, hlavní fotka).
 * Bezpečnost: jen http(s), žádné interní/privátní adresy (ochrana proti SSRF),
 * omezení času, velikosti a počtu přesměrování. Fotka se stáhne a uloží do
 * soukromého úložiště domácnosti, takže zůstane i když e-shop stránku změní.
 */

const MAX_HTML = 2 * 1024 * 1024;
const MAX_IMAGE = 8 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
}

async function assertPublicUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Neplatný odkaz.");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("Podporované jsou jen odkazy http(s).");
  if (u.username || u.password) throw new Error("Neplatný odkaz.");
  if (u.port && !["80", "443"].includes(u.port)) throw new Error("Nepodporovaný port.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("Tento odkaz nelze načíst.");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new Error("Stránku se nepodařilo najít.");
  if (addrs.some((a) => isPrivateIp(a.address))) throw new Error("Tento odkaz nelze načíst.");
  return u;
}

async function safeFetch(raw: string, accept: string, maxBytes: number): Promise<{ url: URL; type: string; body: Uint8Array }> {
  let url = await assertPublicUrl(raw);
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
      headers: { accept, "user-agent": "Mozilla/5.0 (compatible; HomeOS-preview/1.0)", "accept-language": "cs,en;q=0.8" },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = await assertPublicUrl(new URL(res.headers.get("location")!, url).toString());
      continue;
    }
    if (!res.ok || !res.body) throw new Error(`Stránka odpověděla chybou ${res.status}.`);
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > maxBytes) throw new Error("Soubor je příliš velký.");
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) {
        await reader.cancel();
        if (accept.startsWith("text/html")) break; // stačí začátek stránky (hlavička s meta značkami)
        throw new Error("Soubor je příliš velký.");
      }
      chunks.push(value);
    }
    const body = new Uint8Array(size > maxBytes ? chunks.reduce((a, c) => a + c.length, 0) : size);
    let o = 0;
    for (const c of chunks) {
      body.set(c, o);
      o += c.length;
    }
    return { url, type: (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase(), body };
  }
  throw new Error("Příliš mnoho přesměrování.");
}

function decodeEntities(s: string) {
  return s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).trim();
}

/** Vytažení názvu, ceny a obrázku z HTML (Open Graph, schema.org, Twitter). */
export function parseProductHtml(html: string, base: string): { title: string | null; price: number | null; image: string | null } {
  const meta = (key: string) => {
    const re = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${key}["'][^>]*>`, "i");
    const tag = re.exec(html)?.[0];
    const content = tag && /content=["']([^"']*)["']/i.exec(tag)?.[1];
    return content ? decodeEntities(content) : null;
  };
  const abs = (v: string | null) => {
    if (!v) return null;
    try {
      return new URL(v, base).toString();
    } catch {
      return null;
    }
  };
  let image = abs(meta("og:image:secure_url") ?? meta("og:image") ?? meta("twitter:image") ?? meta("image"));
  let price: number | null = null;
  const rawPrice = meta("product:price:amount") ?? meta("og:price:amount") ?? meta("price");
  if (rawPrice) price = parseMoney(rawPrice.replace(/\s/g, ""));
  // JSON-LD (schema.org Product)
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1]);
      const nodes: Record<string, unknown>[] = [data, ...(Array.isArray(data) ? data : []), ...(Array.isArray(data?.["@graph"]) ? data["@graph"] : [])];
      const product = nodes.find((n) => n && typeof n === "object" && String(n["@type"]).includes("Product"));
      if (product) {
        const img = product.image as unknown;
        if (!image) image = abs(typeof img === "string" ? img : Array.isArray(img) ? String(img[0]) : (img as { url?: string })?.url ?? null);
        const offers = (Array.isArray(product.offers) ? product.offers[0] : product.offers) as { price?: unknown; lowPrice?: unknown } | undefined;
        if (price == null && offers && (offers.price ?? offers.lowPrice) != null) {
          const n = String(offers.price ?? offers.lowPrice);
          price = /^\d+(\.\d{1,2})?$/.test(n) ? Math.round(Number(n) * 100) : parseMoney(n);
        }
      }
    } catch {
      // neplatné JSON-LD ignorujeme
    }
  }
  const title = meta("og:title") ?? (/<title[^>]*>([^<]{1,300})<\/title>/i.exec(html)?.[1] ? decodeEntities(/<title[^>]*>([^<]{1,300})<\/title>/i.exec(html)![1]) : null);
  return { title: title ? title.slice(0, 160) : null, price: price != null && Number.isSafeInteger(price) && price > 0 ? price : null, image };
}

export async function loadProductPreview(ctx: AppContext, rawUrl: string): Promise<{ ok: true; preview: { title: string | null; price: number | null; documentId: string | null } } | { ok: false; error: string }> {
  try {
    const page = await safeFetch(String(rawUrl).trim(), "text/html,application/xhtml+xml", MAX_HTML);
    let html = "";
    let imageUrl: string | null = null;
    let title: string | null = null;
    let price: number | null = null;
    if (IMAGE_TYPES.includes(page.type)) imageUrl = page.url.toString();
    else {
      html = new TextDecoder("utf-8").decode(page.body);
      ({ title, price, image: imageUrl } = parseProductHtml(html, page.url.toString()));
    }
    let documentId: string | null = null;
    if (imageUrl) {
      try {
        const img = await safeFetch(imageUrl, "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.5", MAX_IMAGE);
        if (IMAGE_TYPES.includes(img.type)) {
          const ext = img.type === "image/png" ? "png" : img.type === "image/webp" ? "webp" : "jpg";
          const path = `${ctx.household.id}/${randomUUID()}-produkt.${ext}`;
          await ctx.store.files.upload(path, img.body, img.type);
          const [doc] = await ctx.store.insert("documents", [{
            household_id: ctx.household.id, kind: "other", title: (title ?? "Fotka produktu").slice(0, 200), storage_path: path,
            file_name: `produkt.${ext}`, mime_type: img.type, size_bytes: img.body.length, ocr_text: null, tags: "nákup", uploaded_by: ctx.user.id,
          }]);
          documentId = doc.id;
        }
      } catch {
        documentId = null;
      }
    }
    return { ok: true, preview: { title, price, documentId } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Odkaz se nepodařilo načíst." };
  }
}
