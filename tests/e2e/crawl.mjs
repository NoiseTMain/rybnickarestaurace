// Kontrola celé aplikace: každá stránka (desktop + mobil, cs/sk/en, demo + vlastní domácnost)
// – chyby v konzoli, chybové stránky, vodorovné posouvání na mobilu.
import { chromium } from "playwright";
const B = process.env.BASE_URL ?? "http://localhost:3102";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
const problems = [];
const APP = ["/", "/domacnost", "/transakce", "/transakce?zobrazeni=mesice", "/prace", "/faktury", "/nakupy", "/planovani", "/recepty", "/cestovani", "/sporeni", "/majetek", "/dane", "/rozpocty", "/platby", "/asistent", "/dokumenty", "/nastaveni", "/premium", "/uzaverka"];
const PUBLIC = ["/vitejte", "/kalkulacky", "/clanky", "/clanky/kapesne", "/clanky/hypoteka", "/podminky", "/soukromi", "/prihlaseni", "/registrace", "/neexistuje-xyz"];

async function check(page, url, label, mobile) {
  const errs = [];
  const onConsole = (m) => { if (m.type() === "error" && !/favicon|Failed to load resource: the server responded with a status of 404/.test(m.text())) errs.push(m.text().slice(0, 200)); };
  const onPageError = (e) => errs.push("pageerror: " + e.message.slice(0, 200));
  page.on("console", onConsole); page.on("pageerror", onPageError);
  const res = await page.goto(B + url, { waitUntil: "networkidle" }).catch((e) => ({ status: () => 0, err: e.message }));
  await page.waitForTimeout(300);
  const body = await page.locator("body").innerText().catch(() => "");
  if (/Něco se pokazilo|Application error|Internal Server Error/.test(body)) errs.push("chybová stránka");
  if (res.status() >= 500 || res.status() === 0) errs.push(`HTTP ${res.status()}`);
  if (mobile) {
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (over > 2) errs.push(`vodorovné přetečení ${over}px`);
  }
  page.off("console", onConsole); page.off("pageerror", onPageError);
  if (errs.length) problems.push(`${label} ${url}: ${[...new Set(errs)].join(" | ")}`);
  return body;
}

async function registered(email, demo) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addCookies([{ name: "homeos_tour", value: "done", url: B }, { name: "homeos_dash", value: "detailed", url: B }]);
  const p = await ctx.newPage();
  await p.goto(B + "/registrace");
  await p.fill("input[name=email]", email); await p.fill("input[name=password]", "tajneheslo9"); await p.fill("input[name=password2]", "tajneheslo9");
  await p.check("input[name=terms]"); await p.click("button[type=submit]");
  await p.waitForURL(/\/uvod/);
  if (demo) {
    await p.getByText("Vyzkoušet s ukázkovými daty").click();
    await p.waitForURL((u) => u.pathname === "/", { timeout: 60000 });
  } else {
    await p.getByText("Nastavit moji domácnost").click();
    await p.getByLabel("Vaše jméno").fill("Test");
    await p.getByRole("button", { name: "Pokračovat" }).click();
    await p.getByRole("heading", { name: "Účty a hotovost" }).waitFor();
    await p.waitForTimeout(400);
    await p.getByLabel("Zůstatek").fill("100");
    for (let i = 0; i < 4; i++) { await p.getByRole("button", { name: "Pokračovat" }).click(); await p.waitForTimeout(400); }
    await p.getByRole("button", { name: "Dokončit nastavení" }).click();
    await p.waitForURL((u) => u.pathname === "/");
  }
  // nabídku Premium označíme jako viděnou (zavřít jde po 10 s)
  const promo = p.getByRole("button", { name: "Pokračovat zdarma", exact: true });
  if (await p.getByText("Vítejte! Vyzkoušejte Premium").count()) await promo.click({ timeout: 15000 });
  return { ctx, p };
}

const t0 = Date.now();
for (const demo of [true, false]) {
  const { ctx, p } = await registered(`crawl${demo ? "demo" : "own"}${Date.now()}@example.cz`, demo);
  const tag = demo ? "demo" : "vlastní";
  // detail cesty a receptu (demo má cesty)
  const extra = [];
  await p.goto(B + "/cestovani");
  const trip = await p.locator('a[href^="/cestovani/"]').first().getAttribute("href").catch(() => null);
  if (trip) extra.push(trip);
  await p.goto(B + "/recepty");
  const rec = await p.locator('a[href^="/recepty/"]').first().getAttribute("href").catch(() => null);
  if (rec) extra.push(rec);
  for (const locale of ["cs", "sk", "en"]) {
    await ctx.addCookies([{ name: "homeos_locale", value: locale, url: B }]);
    for (const url of [...APP, ...extra]) await check(p, url, `[${tag} desktop ${locale}]`, false);
  }
  await ctx.addCookies([{ name: "homeos_locale", value: "cs", url: B }]);
  const mob = await browser.newContext({ viewport: { width: 375, height: 760 }, isMobile: true, hasTouch: true, storageState: await ctx.storageState() });
  const mp = await mob.newPage();
  for (const url of [...APP, ...extra, ...PUBLIC.filter((u) => !/prihlaseni|registrace/.test(u))]) await check(mp, url, `[${tag} mobil]`, true);
  await mob.close();
  if (process.env.CLEANUP === "1") {
    // testovací účet po sobě smažeme (produkční kontrola)
    await p.goto(B + "/nastaveni#ucet");
    await p.getByRole("button", { name: "Smazat účet…" }).click();
    await p.getByLabel("Vaše heslo").fill("tajneheslo9");
    await p.getByLabel("Pro potvrzení napište SMAZAT").fill("SMAZAT");
    await p.getByRole("button", { name: "Trvale smazat účet" }).click();
    await p.waitForURL(/\/vitejte/);
    console.log("smazán testovací účet", tag);
  }
  await ctx.close();
}
const anon = await browser.newContext({ viewport: { width: 375, height: 760 }, isMobile: true });
const ap = await anon.newPage();
for (const url of PUBLIC) await check(ap, url, "[anonym mobil]", true);
await anon.close();
await browser.close();
console.log(`Zkontrolováno za ${Math.round((Date.now() - t0) / 1000)} s`);
if (problems.length) { console.log("PROBLÉMY:\n" + problems.join("\n")); process.exit(1); }
console.log("✓ Žádné problémy");
