// Projde aplikaci v sk/en a vypíše zbylé české texty (pro doplnění slovníku) a chyby v konzoli.
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
const B = process.env.BASE_URL ?? "http://localhost:3102";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
const APP = ["/", "/domacnost", "/transakce", "/transakce?zobrazeni=mesice", "/prace", "/faktury", "/nakupy", "/planovani", "/recepty", "/cestovani", "/sporeni", "/vyzvy", "/majetek", "/dane", "/rozpocty", "/platby", "/asistent", "/dokumenty", "/nastaveni", "/premium", "/uzaverka", "/rok", "/nastroje"];
const PUB = ["/vitejte", "/kalkulacky", "/prihlaseni", "/registrace"];
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addCookies([{ name: "homeos_tour", value: "done", url: B }, { name: "homeos_dash", value: "detailed", url: B }]);
const p = await ctx.newPage();
await p.goto(B + "/registrace");
await p.fill("input[name=email]", `i18n${Date.now()}@example.cz`); await p.fill("input[name=password]", "tajneheslo9"); await p.fill("input[name=password2]", "tajneheslo9");
await p.check("input[name=terms]"); await p.click("button[type=submit]");
await p.waitForURL(/\/uvod/);
await p.getByText("Vyzkoušet s ukázkovými daty").click();
await p.waitForURL((u) => u.pathname === "/", { timeout: 60000 });
const shown = await p.getByText("Vítejte! Vyzkoušejte Premium").waitFor({ timeout: 6000 }).then(() => true).catch(() => false);
if (shown) await p.getByRole("button", { name: "Pokračovat zdarma", exact: true }).click({ timeout: 20000 });
await p.goto(B + "/cestovani"); const trip = await p.locator('a[href^="/cestovani/"]').first().getAttribute("href").catch(() => null);
if (trip) APP.push(trip);
const report = {};
const errors = [];
for (const locale of (process.env.LOCALES ?? "en,sk").split(",")) {
  await ctx.addCookies([{ name: "homeos_locale", value: locale, url: B }]);
  const czech = locale === "sk" ? /[ěřůĚŘŮ]/ : /[ěščřžýáíéůúťďňĚŠČŘŽÝÁÍÉŮÚŤĎŇ]/;
  const left = new Map();
  for (const url of [...APP, ...PUB]) {
    const onErr = (m) => { if (m.type() === "error") errors.push(`[${locale}] ${url}: ${m.text().slice(0, 160)}`); };
    p.on("console", onErr);
    await p.goto(B + url, { waitUntil: "networkidle" }).catch(() => undefined);
    await p.waitForTimeout(200);
    const texts = await p.evaluate(() => {
      const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) { const el = n.parentElement; if (!el || el.closest("script,style,code,[data-user]")) continue; const t = n.nodeValue.trim(); if (t) out.push(t); }
      for (const el of document.querySelectorAll("[placeholder],[title],[aria-label]")) for (const a of ["placeholder", "title", "aria-label"]) { const v = el.getAttribute(a); if (v) out.push(v); }
      return out;
    });
    for (const t of texts) if (czech.test(t)) left.set(t, [...new Set([...(left.get(t) ?? []), url])]);
    p.off("console", onErr);
  }
  report[locale] = [...left.entries()].map(([t, urls]) => ({ t, urls }));
  console.log(locale, "zbylých českých textů:", left.size);
}
writeFileSync(process.env.OUT ?? "i18n-report.json", JSON.stringify({ report, errors }, null, 1));
console.log("chyby v konzoli:", errors.length, errors.slice(0, 8));
await browser.close();
