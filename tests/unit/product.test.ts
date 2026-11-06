import { describe, expect, it } from "vitest";
import { parseProductHtml } from "@/lib/product-preview";

describe("náhled produktu z odkazu", () => {
  it("Open Graph", () => {
    const html = `<html><head><title>Fallback</title>
      <meta property="og:title" content="Sedačka KIVIK &amp; podnožka">
      <meta property="og:image" content="/images/kivik.jpg">
      <meta property="product:price:amount" content="15990.00"></head></html>`;
    expect(parseProductHtml(html, "https://www.example.cz/p/kivik")).toEqual({
      title: "Sedačka KIVIK & podnožka", price: 1_599_000, image: "https://www.example.cz/images/kivik.jpg",
    });
  });
  it("schema.org JSON-LD", () => {
    const html = `<title>Komoda | Obchod</title><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Product","name":"Komoda","image":["https://cdn.example.cz/komoda.webp"],"offers":{"@type":"Offer","price":"4499","priceCurrency":"CZK"}}]}</script>`;
    expect(parseProductHtml(html, "https://example.cz/komoda")).toEqual({ title: "Komoda | Obchod", price: 449_900, image: "https://cdn.example.cz/komoda.webp" });
  });
  it("bez údajů", () => {
    expect(parseProductHtml("<html></html>", "https://example.cz")).toEqual({ title: null, price: null, image: null });
  });
});
