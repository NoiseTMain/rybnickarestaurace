// End-to-end test HomeOS v lokálním režimu: reálný prohlížeč, reálný server, reálné ukládání.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { goldPng, invoicePdf } from "./make-pdf.mjs";

const B = process.env.BASE_URL ?? "http://localhost:3100";
const SHOTS = process.env.SHOTS_DIR ?? "test-results";
mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "cs-CZ", timezoneId: "Europe/Prague" });
const page = await ctx.newPage();
// průvodce po aplikaci se testuje jen v hlavním kontextu – ostatní ho mají „hotový“
{
  const orig = browser.newContext.bind(browser);
  browser.newContext = async (o) => { const c = await orig(o); await c.addCookies([{ name: "homeos_tour", value: "done", url: process.env.BASE_URL ?? "http://localhost:3100" }]); return c; };
}
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`); });

const step = (name) => console.log(`→ ${name}`);
const num = (s) => Number(s.replace(/[^\d,−-]/g, "").replace("−", "-").replace(",", "."));
async function stat(label) {
  const el = page.locator(`div:has(> div:text-is("${label}")) >> .num`).first();
  return num(await el.innerText());
}
async function modalSubmit(text) {
  await page.locator('[role=dialog] button[type=submit]', { hasText: text }).click();
}
async function modalSubmitOn(p, text) {
  await p.locator("[role=dialog] button[type=submit]").click();
  await p.locator("[role=status]", { hasText: text }).first().waitFor();
  await p.locator("[role=dialog]").waitFor({ state: "detached" });
}
async function toast(text) {
  try {
    await page.locator('[role=status]', { hasText: text }).first().waitFor({ timeout: 15000 });
  } catch (e) {
    console.log("Obsah dialogu:", await page.locator("[role=dialog]").innerText().catch(() => "(žádný)"), errors);
    throw e;
  }
}

step("registrace");
await page.goto(B + "/registrace");
await page.fill("input[name=email]", "jana@example.cz");
await page.fill("input[name=password]", "tajneheslo1");
await page.fill("input[name=password2]", "tajneheslo1");
await page.check("input[name=terms]");
await page.click("button[type=submit]");
await page.waitForURL(/\/uvod/);

step("úvodní nastavení");
await page.getByText("Nastavit moji domácnost").click();
await page.getByLabel("Vaše jméno").fill("Jana");
await page.getByRole("button", { name: "Pokračovat" }).click();
await page.getByRole("heading", { name: "Účty a hotovost" }).waitFor();
await page.waitForTimeout(400);
await page.getByLabel("Zůstatek").fill("50 000");
await page.getByRole("button", { name: "Pokračovat" }).click();
await page.getByRole("heading", { name: "Pravidelné příjmy" }).waitFor();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Přidat příjem" }).click();
await page.getByLabel("Název").fill("Mzda");
await page.getByLabel("Částka").fill("30000");
await page.getByRole("button", { name: "Pokračovat" }).click();
// nájem: první řádek – splatnost dnes
await page.getByRole("heading", { name: "Pravidelné výdaje" }).waitFor();
await page.waitForTimeout(400);
await page.getByLabel("Částka").first().fill("15000");
await page.getByRole("button", { name: "Pokračovat" }).click();
await page.getByRole("heading", { name: "Rozpočet a rezerva" }).waitFor();
await page.waitForTimeout(400);
await page.getByLabel("Měsíční rozpočet na jídlo").fill("12000");
await page.getByLabel("Bezpečnostní rezerva na nečekané výdaje").fill("5000");
await page.getByLabel("Vaše IČO").fill("12345679");
await page.getByRole("button", { name: "Pokračovat" }).click();
await page.getByText("Shrnutí").waitFor();
await page.getByRole("button", { name: "Dokončit nastavení" }).click();
await page.waitForURL((u) => u.pathname === "/", { timeout: 30000 });

step("po registraci nabídka Premium – zavřít jde až po 10 vteřinách");
await page.getByText("Vítejte! Vyzkoušejte Premium").waitFor();
assert.equal(await page.getByRole("button", { name: /Pokračovat zdarma \(za/ }).isDisabled(), true, "zavřít hned nejde");
await page.waitForTimeout(3000);
assert.equal(await page.getByText("Vítejte! Vyzkoušejte Premium").isVisible(), true, "okno je stále otevřené");
await page.getByRole("button", { name: "Pokračovat zdarma", exact: true }).click({ timeout: 15000 });
await page.getByText("Vítejte! Vyzkoušejte Premium").waitFor({ state: "detached" });
await page.reload();

step("průvodce po aplikaci: projít kroky, podruhé se už neukáže");
await page.getByRole("dialog").getByText("Vítejte v HomeOS").waitFor();
for (let i = 0; i < 6; i++) await page.getByRole("dialog").getByRole("button", { name: "Další" }).click();
await page.getByRole("dialog").getByText("Zeptejte se asistenta").waitFor();
await page.getByRole("button", { name: "Pustit se do toho" }).click();
await page.getByRole("dialog").waitFor({ state: "detached" });
await page.reload();
await page.getByText("můžete ještě v klidu utratit").waitFor();
assert.equal(await page.getByText("Vítejte! Vyzkoušejte Premium").count(), 0, "nabídka se ukáže jen jednou");

step("jednoduchý přehled: jedna jasná odpověď, přepnutí na podrobný");
await page.getByText("můžete ještě v klidu utratit").waitFor();
await page.goto(B + "/transakce");
await page.getByRole("button", { name: "Zpět" }).click();
await page.waitForURL((u) => u.pathname === "/");
await page.getByText("Co to znamená?").first().click();
await page.getByText(/Je to částka, kterou můžete utratit za cokoli navíc/).waitFor();
await page.getByText("Na účtech teď máte").waitFor();
await page.getByRole("radio", { name: "Podrobný" }).click();
await page.getByText("Skutečně volné").waitFor();

step("verze zdarma: cestování a AI jsou Premium, úvodní stránka pro nepřihlášené");
await page.goto(B + "/cestovani");
await page.getByText("Cestování je součástí Premium").waitFor();
await page.goto(B + "/premium");
await page.getByText("Online platby se právě spouštějí").waitFor();
{
  const anon = await browser.newContext();
  const ap = await anon.newPage();
  await ap.goto(B + "/");
  await ap.waitForURL(/\/vitejte$/);
  await ap.getByRole("link", { name: "Začít zdarma" }).first().waitFor();
  await ap.goto(B + "/podminky");
  await ap.getByText("Podmínky používání HomeOS").waitFor();
  await anon.close();
}

step("administrace: jen správce, přidělení Premium podle e-mailu");
await page.goto(B + "/admin");
await page.getByText("Stránka neexistuje").waitFor();
assert.equal(await page.getByText("Přidat Premium podle e-mailu").count(), 0, "běžný uživatel administraci nevidí");
{
  const adm = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const ap = await adm.newPage();
  await ap.goto(B + "/registrace");
  await ap.fill("input[name=email]", "adamhorvath07@icloud.com");
  await ap.fill("input[name=password]", "spravce-heslo-1");
  await ap.fill("input[name=password2]", "spravce-heslo-1");
  await ap.check("input[name=terms]");
  await ap.click("button[type=submit]");
  await ap.waitForURL(/\/uvod/);
  await ap.getByText("Vyzkoušet s ukázkovými daty").click();
  await ap.waitForURL((u) => u.pathname === "/", { timeout: 30000 });
  await ap.getByRole("link", { name: "Administrace" }).first().click();
  await ap.getByText("jana@example.cz").waitFor();
  await ap.getByLabel("E-mail uživatele").first().fill("jana@example.cz");
  await ap.getByLabel("Na jak dlouho").first().selectOption("1y");
  await ap.getByLabel("Poznámka (jen pro vás)").first().fill("tester");
  await ap.getByRole("button", { name: "Přidat Premium" }).first().click();
  await ap.locator("[role=status]", { hasText: "Premium přidáno: jana@example.cz" }).first().waitFor();
  await ap.reload();
  await ap.locator("tr", { hasText: "jana@example.cz" }).getByText("přiděleno").waitFor();
  await ap.getByText("grant_premium").waitFor();
  await ap.goto(B + "/premium");
  await ap.getByText("Jste správce – Premium máte napořád").waitFor();
  await adm.close();
}
await page.goto(B + "/premium");
await page.getByText("Máte Premium").waitFor();
await page.goto(B + "/");

step("přehled ukazuje zadané údaje (očekávaný příjem se nepočítá)");
assert.equal(await stat("Disponibilní"), 50000);
assert.equal(await stat("Příjem tento měsíc"), 0);
await page.screenshot({ path: `${SHOTS}/01-prehled.png`, fullPage: true });

step("rychlé přidání výdaje 1 234,50 Kč");
await page.getByRole("button", { name: "Rychle přidat" }).click();
await page.getByRole("menuitem", { name: "Přidat výdaj" }).click();
await page.locator("[role=dialog] input[name=amount]").fill("1 234,50");
await page.locator("[role=dialog] select[name=category_id]").selectOption({ label: "Potraviny" });
await page.locator("[role=dialog] input[name=description]").fill("Velký nákup");
await modalSubmit("Přidat výdaj");
await toast("Výdaj uložen");
await page.waitForTimeout(500);
assert.equal(await stat("Disponibilní"), 48766); // přehled zaokrouhluje na celé Kč
await page.goto(B + "/nastaveni#ucty");
await page.getByText("48\u00a0765,50\u00a0Kč").first().waitFor(); // přesně v haléřích
await page.goto(B + "/transakce");
await page.getByText("1\u00a0234,50\u00a0Kč").first().waitFor();

step("storno výdaje vše přepočítá");
await page.goto(B + "/transakce");
page.once("dialog", (d) => d.accept());
await page.locator("li", { hasText: "Velký nákup" }).hover();
await page.locator("li", { hasText: "Velký nákup" }).locator("button").nth(1).click();
await toast("stornována");
await page.goto(B + "/");
assert.equal(await stat("Disponibilní"), 50000);

step("zaplacení nájmu (jen jednou)");
await page.goto(B + "/platby");
await page.locator("li", { hasText: "Nájem" }).getByRole("button", { name: "Zaplaceno" }).first().click();
await modalSubmit("Potvrdit");
await toast("Platba zaznamenána");
await page.goto(B + "/");
assert.equal(await stat("Disponibilní"), 35000);

step("spořicí cíl a vklad");
await page.goto(B + "/sporeni");
await page.getByRole("button", { name: "Nový cíl" }).click();
await page.locator("[role=dialog] input[name=name]").fill("Rezerva");
await page.locator("[role=dialog] input[name=target_amount]").fill("60000");
await page.locator("[role=dialog] input[name=monthly_contribution]").fill("2000");
await modalSubmit("Uložit");
await toast("Cíl vytvořen");
await page.getByRole("button", { name: "Vklad" }).first().click();
await page.locator("[role=dialog] input[name=amount]").fill("3000");
await modalSubmit("Odložit");
await toast("Vklad zaznamenán");
await page.goto(B + "/");
assert.equal(await stat("Disponibilní"), 32000, "odložené peníze nejsou disponibilní");
assert.equal(await stat("Odloženo"), 3000);

step("plánovač: bezpečně k utracení = 32 000 − jídlo 12 000 − rezerva 5 000");
await page.goto(B + "/sporeni");
const safe = num(await page.locator("p:has-text('2. Můžeme bezpečně utratit') + p").innerText());
assert.equal(safe, 15000);

step("nákup a kontrola dostupnosti");
await page.goto(B + "/nakupy");
await page.getByRole("button", { name: "Přidat nákup" }).click();
await page.locator("[role=dialog] input[name=name]").fill("Sedačka");
await page.locator("[role=dialog] input[name=price]").fill("20000");
await modalSubmit("Uložit");
await toast("Nákup přidán");
await page.getByText("Chybí").first().waitFor();
assert.match(await page.locator("text=Chybí").first().innerText(), /5\s000/);

step("asistent odpovídá ze skutečných dat");
await page.goto(B + "/asistent");
await page.getByPlaceholder(/Můžeme si dovolit pračku/).fill("Můžeme si dovolit koupit sedačku za 15 000 Kč?");
await page.getByRole("button", { name: "Odeslat" }).click();
await page.getByText(/^Ano\. Nákup za 15\s000\s*Kč/).waitFor({ timeout: 15000 });
await page.getByPlaceholder(/Můžeme si dovolit pračku/).fill("Můžeme si dovolit auto?");
await page.getByRole("button", { name: "Odeslat" }).click();
await page.getByText("Kolik daná věc stojí?").waitFor();

step("faktura: ruční zadání a úhrada");
await page.goto(B + "/faktury");
await page.getByRole("button", { name: "Nová faktura" }).click();
await page.getByRole("radio", { name: "Vystavená (dostanu)" }).click();
await page.locator("[role=dialog] input[name=number]").fill("2026-001");
await page.locator("[role=dialog] input[name=amount]").fill("8 500");
await page.locator("[role=dialog] input[name=counterparty]").fill("Rohlík.cz");
await page.locator("[role=dialog] input[name=counterparty_ico]").fill("12345678");
await modalSubmit("Uložit fakturu");
await toast("Faktura uložena");
await page.locator("li", { hasText: "2026-001" }).getByRole("button", { name: "Zaplaceno" }).click();
await page.locator("[role=dialog] select[name=mode]").selectOption("create");
await modalSubmit("Označit jako zaplacenou");
await toast("označena jako zaplacená");
await page.goto(B + "/");
assert.equal(await stat("Příjem tento měsíc"), 8500);

step("faktura z PDF: OCR návrh se neuloží bez potvrzení");
await page.goto(B + "/faktury");
await page.getByRole("button", { name: "Nová faktura" }).click();
await page.locator("[role=dialog] input[type=file]").setInputFiles({ name: "faktura.pdf", mimeType: "application/pdf", buffer: invoicePdf() });
await page.locator("[role=dialog] input[name=number]").and(page.locator('[value="2026-0999"]')).waitFor({ timeout: 30000 });
assert.equal(await page.locator("[role=dialog] input[name=amount]").inputValue(), "4321");
assert.equal(await page.locator("[role=dialog] input[name=counterparty_ico]").inputValue(), "27082440");
assert.equal(await page.locator("[role=dialog] input[name=due_date]").inputValue(), "2026-11-16");
assert.equal(await page.locator("[role=dialog] input[name=counterparty]").inputValue(), "Pneuservis Test s.r.o.");
await modalSubmit("Uložit fakturu");
await page.locator("[role=dialog]").getByText("Potvrďte kontrolu údajů").waitFor();
await page.locator("[role=dialog]").getByText("Zkontroloval(a) jsem rozpoznané údaje").click();
await modalSubmit("Uložit fakturu");
await toast("Faktura uložena");
await page.locator("li", { hasText: "2026-0999" }).getByText("OCR potvrzeno").waitFor();
const docLink = await page.locator("li", { hasText: "2026-0999" }).locator('a[href^="/api/files/"]').getAttribute("href");
const pdfResp = await page.request.get(B + docLink);
assert.equal(pdfResp.status(), 200);
assert.equal(pdfResp.headers()["content-type"], "application/pdf");

step("práce: kde pracuji (obecně), směna a výplata");
await page.goto(B + "/prace");
await page.getByText("Kde pracujete?").waitFor();
await page.getByRole("button", { name: /Kurýr \/ řidič/ }).click();
await page.getByLabel("Kde pracujete").fill("Rohlík");
await page.getByLabel("Pozice").fill("kurýr");
await page.getByRole("button", { name: "Uložit nastavení práce" }).click();
await toast("Pracovní nastavení uloženo");
await page.getByRole("heading", { name: "Práce – Rohlík" }).waitFor();
await page.getByRole("button", { name: "Nová směna" }).click();
await page.locator("[role=dialog] input[name=minutes]").fill("8:00");
await page.locator("[role=dialog] input[name=base_earnings]").fill("1600");
await page.locator("[role=dialog] input[name=tips]").fill("150");
await page.locator("[role=dialog] input[name=vehicle_rent]").fill("250");
await modalSubmit("Uložit");
await toast("Směna uložena");
await page.goto(B + "/prace?tab=smeny");
await page.getByText("1 500 Kč").first().waitFor();
await page.goto(B + "/prace?tab=vyplaty");
await page.getByRole("button", { name: "Očekávaná výplata" }).click();
await page.locator("[role=dialog] input[name=label]").fill("Výplata listopad");
await page.locator("[role=dialog] input[name=expected_amount]").fill("1500");
await modalSubmit("Uložit");
await toast("Očekávaná výplata přidána");
await page.getByRole("button", { name: "Přijato" }).click();
await page.locator("[role=dialog] input[name=received_amount]").fill("1450");
await modalSubmit("Potvrdit přijetí");
await toast("rozdíl");
await page.goto(B + "/");
assert.equal(await stat("Příjem tento měsíc"), 9950);

step("export a záloha");
for (const t of ["transakce", "faktury", "smeny", "vyplaty"]) {
  const r = await page.request.get(`${B}/api/export/${t}`);
  assert.equal(r.status(), 200, t);
  assert.match(r.headers()["content-type"], /text\/csv/);
}
const backup = await (await page.request.get(`${B}/api/zaloha`)).json();
assert.equal(backup.format, "homeos-backup");
assert.ok(backup.tables.transactions.length >= 4);

step("obnova zálohy");
await page.goto(B + "/nastaveni#zaloha");
await page.setInputFiles("input[name=file]", { name: "zaloha.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
await page.fill("input[name=confirm]", "OBNOVIT");
await page.getByRole("button", { name: "Obnovit ze zálohy" }).click();
await toast("Záloha obnovena");
await page.goto(B + "/");
assert.equal(await stat("Disponibilní"), 32000 + 8500 + 1450);

step("všechny stránky se načtou");
for (const p of ["/", "/domacnost", "/transakce", "/prace", "/prace?tab=smeny", "/prace?tab=vyplaty", "/prace?tab=nastaveni", "/faktury", "/nakupy", "/sporeni", "/rozpocty", "/platby", "/asistent", "/dokumenty", "/nastaveni"]) {
  const r = await page.goto(B + p);
  assert.equal(r.status(), 200, p);
  await page.screenshot({ path: `${SHOTS}/page${p.replace(/[/?=]/g, "_")}.png`, fullPage: true });
}

step("mobilní zobrazení");
const mobile = await browser.newContext({ ...{ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, storageState: await ctx.storageState() });
const mp = await mobile.newPage();
for (const p of ["/", "/rozpocty", "/transakce"]) {
  await mp.goto(B + p);
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, `vodorovné posouvání na ${p}: ${overflow}px`);
  await mp.screenshot({ path: `${SHOTS}/mobile${p.replace(/\//g, "_")}.png`, fullPage: true });
}
await mobile.close();

step("vzhled: změna barev se projeví hned a vydrží");
await page.goto(B + "/nastaveni#vzhled");
await page.getByRole("button", { name: "Smaragd" }).click();
await toast("Vzhled uložen");
const accentNow = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--color-gold").trim());
assert.equal(await accentNow(), "#6fcf97");
await page.getByRole("button", { name: /Půlnoc/ }).click();
await page.reload();
assert.equal(await accentNow(), "#6fcf97");
assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor), "rgb(7, 10, 18)");
await page.screenshot({ path: `${SHOTS}/vzhled.png`, fullPage: false });
await page.goto(B + "/");
await page.screenshot({ path: `${SHOTS}/vzhled-prehled.png`, fullPage: false });
await page.goto(B + "/nastaveni#vzhled");
await page.getByRole("button", { name: "Champagne" }).click();
await page.getByRole("button", { name: /Antracit/ }).click();
await toast("Vzhled uložen");

step("iPhone: ikona a manifest pro přidání na plochu");
const head = await page.content();
assert.match(head, /rel="apple-touch-icon"[^>]*apple-icon/);
assert.equal((await page.request.get(B + "/apple-icon.png")).headers()["content-type"], "image/png");
const manifest = await (await page.request.get(B + "/manifest.webmanifest")).json();
assert.equal(manifest.display, "standalone");

step("demo domácnost je oddělená");
await page.goto(B + "/nastaveni");
await page.getByRole("button", { name: "Vytvořit demo domácnost" }).click();
await page.waitForURL((u) => u.pathname === "/", { timeout: 60000 });
await page.getByText("ukázkovou (DEMO) domácnost").waitFor();
await page.screenshot({ path: `${SHOTS}/02-demo.png`, fullPage: true });

step("cizí uživatel nevidí data");
const other = await browser.newContext();
await other.addCookies([{ name: "homeos_dash", value: "detailed", url: B }]); // podrobný Přehled
const op = await other.newPage();
await op.goto(B + "/registrace");
await op.fill("input[name=email]", "cizi@example.cz");
await op.fill("input[name=password]", "tajneheslo2");
await op.fill("input[name=password2]", "tajneheslo2");
await op.check("input[name=terms]");
await op.click("button[type=submit]");
await op.waitForURL(/\/uvod/);
const r = await op.request.get(`${B}/api/zaloha`);
assert.equal(r.status(), 403, "uživatel bez domácnosti nesmí stáhnout zálohu");
await op.getByText("Nastavit moji domácnost").click();
await op.getByLabel("Vaše jméno").fill("Cizí");
await op.getByRole("button", { name: "Pokračovat" }).click();
await op.getByRole("heading", { name: "Účty a hotovost" }).waitFor();
await op.waitForTimeout(400);
await op.getByLabel("Zůstatek").fill("100");
for (let i = 0; i < 4; i++) { await op.getByRole("button", { name: "Pokračovat" }).click(); await op.waitForTimeout(400); }
await op.getByRole("button", { name: "Dokončit nastavení" }).click();
await op.waitForURL((u) => u.pathname === "/");
await op.getByRole("button", { name: "Pokračovat zdarma", exact: true }).click({ timeout: 20000 });
assert.equal((await op.request.get(B + docLink)).status(), 404, "cizí dokument je nedostupný");
// podvržené cookie s cizí domácností se ignoruje
await other.addCookies([{ name: "homeos_household", value: backup.household.id, url: B }]);
const foreign = await (await op.request.get(`${B}/api/zaloha`)).json();
assert.notEqual(foreign.household.id, backup.household.id, "podvržená domácnost");
assert.equal(foreign.tables.transactions.length, 0);

step("pozvánka: připojení k domácnosti přes Nastavení");
// vlastník (Jana) je v DEMO domácnosti – přepne zpět na svou
await page.goto(B + "/nastaveni");
await page.getByRole("button", { name: /Ukázková domácnost/ }).first().click();
await page.getByRole("button", { name: "Naše domácnost" }).click();
await page.getByText("Disponibilní zůstatek").first().waitFor();
await page.goto(B + "/nastaveni#domacnost");
await page.getByRole("button", { name: "Vytvořit pozvánku" }).click();
const code = (await page.locator("code.num").innerText()).trim();
assert.ok(code.length >= 10);
await op.goto(B + "/nastaveni#domacnost");
await op.locator("input[name=code]").fill(code.toLowerCase());
await op.locator("input[name=member_name]").fill("Partner");
await op.getByRole("button", { name: "Přidat se do domácnosti" }).click();
await op.getByText("Disponibilní zůstatek").first().waitFor({ timeout: 30000 });
await op.goto(B + "/nastaveni#clenove");
await op.locator("#clenove li", { hasText: "Jana" }).waitFor(); // vidí členy a data cizí (pozvané) domácnosti
await op.locator("#clenove li", { hasText: "Partner" }).getByText("vy").waitFor();
await op.goto(B + "/faktury");
await op.getByText("2026-0999").first().waitFor(); // faktura vlastníka
await page.reload();
await page.locator("li", { hasText: "Partner" }).getByText("připojen(a)").first().waitFor();
await page.getByText("připojen(a) účtem").first().waitFor();
// stejný kód podruhé nefunguje
await op.goto(B + "/nastaveni#domacnost");
await op.locator("input[name=code]").fill(code);
await op.getByRole("button", { name: "Přidat se do domácnosti" }).click();
await op.getByText("Pozvánka neexistuje nebo vypršela").waitFor();


step("plánování: nákupní seznam jídla → výdaj");
await page.goto(B + "/planovani");
await page.getByRole("button", { name: "Nový seznam" }).click();
await page.locator("[role=dialog] input[name=name]").fill("Víkendový nákup");
await modalSubmit("Vytvořit seznam");
await toast("Seznam vytvořen");
for (const [n, c] of [["Mléko", "24,90"], ["Chleba", "45"]]) {
  await page.getByLabel("Položka").fill(n);
  await page.getByLabel("Odhad ceny").fill(c);
  await page.getByRole("button", { name: "Přidat položku" }).click();
  await page.getByText(n, { exact: true }).waitFor();
}
await page.getByText("69,90\u00a0Kč").first().waitFor(); // odhad
await page.getByRole("button", { name: "Označit jako koupené" }).first().click();
await page.screenshot({ path: `${SHOTS}/planovani-jidlo.png`, fullPage: true });
await page.getByRole("button", { name: "Nakoupeno" }).click();
await page.locator("[role=dialog] input[name=amount]").fill("72,40");
await modalSubmit("Zapsat nákup");
await toast("Nakoupeno");
await page.goto(B + "/transakce");
await page.getByText("Nákup: Víkendový nákup").waitFor();
await page.getByText("72,40\u00a0Kč").first().waitFor();

step("plánování: nábytek s fotkou");
await page.goto(B + "/planovani?tab=domov");
await page.getByRole("button", { name: "Přidat věc" }).click();
await page.locator("[role=dialog] input[type=file][accept='image/*']").setInputFiles({ name: "sedacka.png", mimeType: "image/png", buffer: goldPng() });
await page.locator("[role=dialog] img[alt='Fotka produktu']").waitFor({ timeout: 20000 });
await page.locator("[role=dialog] input[name=url]").fill("http://127.0.0.1/admin");
await page.locator("[role=dialog]").getByRole("button", { name: "Načíst" }).click();
await page.locator("[role=dialog]").getByText("Tento odkaz nelze načíst").waitFor(); // ochrana proti zneužití serveru
await page.locator("[role=dialog] input[name=url]").fill("");
await page.locator("[role=dialog] input[name=name]").fill("Rohová sedačka");
await page.locator("[role=dialog] input[name=price]").fill("18 990");
await page.locator("[role=dialog] input[name=room]").fill("Obývací pokoj");
await modalSubmit("Uložit");
await toast("Nákup přidán");
const img = page.locator("img[alt='Rohová sedačka']");
await img.waitFor();
assert.ok(await img.evaluate((el) => el.complete && el.naturalWidth > 0), "fotka se zobrazí");
await page.getByRole("button", { name: /Obývací pokoj/ }).waitFor();
await page.screenshot({ path: `${SHOTS}/planovani-domov.png`, fullPage: true });

step("cenová paměť: zaplacená cena se nabídne příště");
await page.goto(B + "/planovani");
await page.getByRole("button", { name: "Nový seznam" }).click();
await page.locator("[role=dialog] input[name=name]").fill("Další nákup");
await modalSubmit("Vytvořit seznam");
await toast("Seznam vytvořen");
await page.getByLabel("Položka").first().fill("Mléko");
await page.getByRole("button", { name: /dříve.*24,90/ }).first().waitFor({ timeout: 15000 });
await page.getByRole("button", { name: /dříve.*24,90/ }).first().click().catch(() => undefined);
await page.getByRole("link", { name: "Lidl" }).first().waitFor(); // letáky kupi.cz
assert.equal(await page.getByRole("link", { name: "Lidl" }).first().getAttribute("href"), "https://www.kupi.cz/letaky/lidl");

step("výběr „Komu“ a oprávnění připojeného člena");
await op.goto(B + "/transakce");
await op.getByRole("button", { name: "Příjem", exact: true }).click();
const komu = await op.locator("[role=dialog] select[name=member_id] option").allTextContents();
assert.ok(komu.includes("Jana") && komu.includes("Partner"), `výběr Komu: ${komu}`);
await op.keyboard.press("Escape");
await page.goto(B + "/nastaveni#domacnost");
await page.locator("li", { hasText: "Partner" }).getByRole("button", { name: /Práva/ }).click();
await page.locator("[role=dialog] li", { hasText: "Příjmy, výdaje" }).getByRole("radio", { name: "Jen číst" }).click();
await page.getByRole("button", { name: "Uložit oprávnění" }).click();
await toast("Oprávnění uložena");
await op.goto(B + "/transakce");
await op.getByText("můžete jen prohlížet").waitFor();
await op.getByRole("button", { name: "Výdaj", exact: true }).click();
await op.locator("[role=dialog] input[name=amount]").fill("10");
await op.locator("[role=dialog] input[name=description]").fill("Zakázaný");
await op.locator('[role=dialog] button[type=submit]').click();
await op.locator("[role=dialog]").getByText("Nemáte oprávnění").waitFor();
await op.keyboard.press("Escape");

step("profilová fotka a telefon člena");
await page.goto(B + "/nastaveni#clenove");
await page.locator("#clenove li", { hasText: "Jana" }).getByRole("button").first().click();
await page.locator("[role=dialog] input[type=file]").setInputFiles({ name: "jana.png", mimeType: "image/png", buffer: goldPng() });
await page.locator("[role=dialog] img[alt='Jana']").waitFor({ timeout: 20000 });
await page.locator("[role=dialog] input[name=phone]").fill("+420 777 123 456");
await modalSubmit("Uložit");
await toast("Člen upraven");
await page.locator("#clenove a[href='tel:+420777123456']").waitFor();
await page.locator("#clenove img[alt='Jana']").waitFor();

step("odebrání člena vlastníkem – domácnost mu hned zmizí");
await op.goto(B + "/faktury");
await op.getByText("2026-0999").first().waitFor();
await page.goto(B + "/nastaveni#domacnost");
page.once("dialog", (d) => d.accept());
await page.locator("li", { hasText: "Partner" }).getByRole("button", { name: "Odebrat" }).click();
await toast("Přístup odebrán");
await op.getByText("Přístup k této domácnosti byl odebrán").waitFor({ timeout: 30000 }); // bez obnovení stránky
await op.goto(B + "/faktury");
assert.equal(await op.getByText("2026-0999").count(), 0, "odebraný vidí faktury");
assert.equal((await op.request.get(B + docLink)).status(), 404);
await page.reload();
assert.equal(await page.locator("li", { hasText: "Partner" }).getByRole("button", { name: "Odebrat" }).count(), 0);

step("člen může domácnost sám opustit");
await page.getByRole("button", { name: "Vytvořit pozvánku" }).click();
const code2 = (await page.locator("code.num").innerText()).trim();
await op.goto(B + "/nastaveni#domacnost");
await op.locator("input[name=code]").fill(code2);
await op.getByRole("button", { name: "Přidat se do domácnosti" }).click();
await op.getByText("Disponibilní zůstatek").first().waitFor();
await op.goto(B + "/nastaveni#domacnost");
op.once("dialog", (d) => d.accept());
await op.getByRole("button", { name: "Opustit domácnost" }).click();
await op.getByText("Disponibilní zůstatek").first().waitFor();
await op.goto(B + "/faktury");
assert.equal(await op.getByText("2026-0999").count(), 0);

step("IČO: bez aktivace jsou Faktury zamčené (Práce je pro každého), aktivace s heslem a ARES");
await op.getByText("Aktivujte IČO").waitFor();
await op.goto(B + "/prace");
await op.getByText("Kde pracujete?").waitFor();
await op.goto(B + "/faktury");
await op.getByRole("link", { name: "Aktivovat IČO" }).click();
await op.locator("#ico input[name=ico]").fill("27082440");
await op.locator("#ico").getByRole("button", { name: "Ověřit" }).click();
const aresOk = await op.locator("#ico").getByText("Alza.cz a.s.").waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
await op.locator("#ico input[name=password]").fill("spatneheslo");
if (!aresOk) await op.locator("#ico").getByText("Registr nedostupný").click();
await op.locator("#ico").getByRole("button", { name: "Aktivovat IČO" }).click();
await op.locator("#ico").getByText("Nesprávné heslo").first().waitFor();
await op.locator("#ico input[name=password]").fill("tajneheslo2");
await op.locator("#ico").getByRole("button", { name: "Aktivovat IČO" }).click();
await op.locator("[role=status]", { hasText: "IČO aktivováno" }).first().waitFor({ timeout: 15000 });
console.log(`   (ARES ${aresOk ? "ověřil subjekt online" : "nebyl dostupný – uloženo neověřené"})`);
await op.reload();
await op.locator("#ico").getByText(/Další změna IČO bude možná/).waitFor();
await op.goto(B + "/faktury");
await op.getByRole("button", { name: "Nová faktura" }).waitFor();

step("historie měsíců");
await page.goto(B + "/transakce?zobrazeni=mesice");
await page.getByText("Předminulý měsíc").waitFor();
await page.getByText(/až 6 měsíců zpětně/).waitFor();

step("asistent: zápis výdaje, navazující otázka, poslední 3 měsíce");
await page.goto(B + "/asistent");
const ask = async (t) => { await page.getByPlaceholder(/Můžeme si dovolit pračku/).fill(t); await page.getByRole("button", { name: "Odeslat" }).click(); };
await ask("89 kafe");
await page.getByRole("button", { name: "Zapsat výdaj" }).click();
await toast("Výdaj uložen");
await ask("Můžeme si dovolit pračku za 9 000 Kč?");
await page.getByText(/9\s000\s*Kč/).first().waitFor();
await ask("A za 900 000?");
await page.getByText(/Nákup za 900\s000\s*Kč teď ne/).waitFor();
await ask("Co je RPSN?");
await page.getByText(/RPSN je roční procentní sazba nákladů/).waitFor();
await ask("Jak přidám pravidelnou platbu?");
await page.getByText(/Pravidelné platby \(nájem, energie, předplatné\)/).first().waitFor();
await ask("Jak jsme na tom za poslední 3 měsíce?");
await page.getByText("Za poslední 3 měsíce zatím nemám žádná data").first().waitFor(); // evidence začala dnes
await page.getByText("Poslední 3 měsíce", { exact: true }).first().waitFor();
await page.getByText("Neobvyklé věci").waitFor();

step("cestování: cesta, účastníci, hotovost, trasa, program, výdaje, vyrovnání, příprava, kopie");
{
  const iso = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague" }).format(d);
  const t0 = iso(new Date());
  const t2 = iso(new Date(Date.now() + 2 * 86400000));
  const dlg = page.locator("[role=dialog]");
  const tab = async (name) => { await page.getByRole("button", { name: new RegExp(`^${name}`) }).click(); await page.waitForURL(new RegExp(name === "Přehled" ? "/cestovani/[0-9a-f-]{36}$" : "tab=")); };
  await page.goto(B + "/cestovani");
  await page.getByText("Žádná naplánovaná cesta").waitFor();
  await page.getByRole("button", { name: "Nová cesta" }).click();
  await dlg.getByLabel("Název cesty").fill("Test Vídeň");
  await dlg.getByLabel("Kam").fill("Vídeň");
  await dlg.getByLabel("Země").fill("Rakousko");
  await dlg.getByLabel("Odjezd").fill(t0);
  await dlg.getByLabel("Návrat").fill(t2);
  await dlg.getByLabel("Rozpočet celkem").fill("10 000");
  await dlg.getByLabel("Osob").fill("2");
  await modalSubmit("Vytvořit cestu");
  await page.waitForURL(/\/cestovani\/[0-9a-f-]{36}$/, { timeout: 20000 });
  const tripUrl = page.url();
  await page.getByText("Právě jste na cestě").waitFor();

  // účastníci
  for (const n of ["Jana", "Petr"]) {
    await page.getByLabel("Jméno účastníka").fill(n);
    await page.getByRole("button", { name: "Přidat", exact: true }).first().click();
    await toast("Účastník přidán");
    await page.locator("span", { hasText: new RegExp(`^${n}$`) }).first().waitFor();
  }
  // hotovost v eurech
  await page.getByRole("button", { name: "Výměna / bankomat" }).click();
  await dlg.getByLabel("Částka (EUR)").fill("100");
  await dlg.getByLabel(/Kurz/).fill("25");
  await dlg.getByText("= 2 500 Kč").waitFor();
  await modalSubmit("Zapsat");
  await toast("Hotovost zapsána");
  await page.getByText("100 EUR").first().waitFor();

  // trasa a program
  await tab("Trasa a program");
  await page.getByRole("button", { name: "Přidat úsek" }).click();
  await dlg.getByLabel("Odkud").fill("Praha");
  await dlg.getByLabel("Kam").fill("Vídeň");
  await dlg.getByLabel("Dopravce").fill("RegioJet");
  await dlg.getByLabel("Cena (Kč)").fill("798");
  await modalSubmit("Přidat úsek");
  await toast("Úsek přidán");
  await page.getByRole("link", { name: /IDOS/ }).waitFor();
  await page.getByText("nezaplaceno").waitFor();
  await page.getByRole("button", { name: "Zaplaceno" }).click();
  assert.equal(await dlg.getByLabel("Kdo platil").inputValue() !== "", true, "plátce předvyplněn");
  await modalSubmit("Zapsat výdaj");
  await toast("Výdaj zapsán k cestě i do výdajů domácnosti");
  await page.getByText("zaplaceno", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Přidat", exact: true }).click();
  await dlg.getByLabel("Ubytování").fill("Hotel Sacher");
  await dlg.getByLabel("Adresa").fill("Philharmoniker Str. 4, Wien");
  await modalSubmit("Přidat");
  await toast("Přidáno do programu");
  await page.getByText("Hotel Sacher").waitFor();
  await page.getByText("1. den", { exact: false }).first().waitFor();

  // výdaje: kartou v eurech (Jana) a z hotovosti (Petr)
  await tab("Výdaje");
  await page.getByRole("button", { name: "Výdaj", exact: true }).click();
  await dlg.getByLabel("Za co").fill("Řízek");
  await dlg.getByLabel("Částka (EUR)").fill("23,20");
  await page.waitForFunction(() => /kurz ČNB/.test(document.querySelector("[role=dialog]")?.textContent ?? ""), null, { timeout: 15000 });
  await dlg.getByLabel(/Kurz \(Kč/).fill("25,2");
  await dlg.getByText(/584,64/).waitFor();
  await dlg.getByLabel("Kdo platil").selectOption({ label: "Jana" });
  await modalSubmit("Zapsat výdaj");
  await toast("Výdaj zapsán");
  await page.getByRole("button", { name: "Výdaj", exact: true }).click();
  await dlg.getByLabel("Za co").fill("Kafe");
  await dlg.getByLabel("Částka (EUR)").fill("10");
  await dlg.getByText("Placeno z hotovosti v EUR").click();
  await dlg.getByText("= 250 Kč").waitFor();
  await dlg.getByLabel("Kdo platil").selectOption({ label: "Petr" });
  await modalSubmit("Zapsat výdaj");
  await page.locator('[role=status]', { hasText: /^Výdaj zapsán k cestě$/ }).first().waitFor({ timeout: 15000 });
  await page.getByText(/z hotovosti · platil\(a\) Petr/).waitFor();

  // přehled: vyrovnání a peněženka
  await tab("Přehled");
  await page.getByText("90 EUR").first().waitFor();
  const ov = await page.locator("main").innerText();
  assert.match(ov, /Petr\s*Jana\s*566,32\s*Kč/, "Petr dluží Janě (798 + 584,64 − 250) / 2");
  await page.getByText(/je teď drženo stranou jako rezerva na cestu/).waitFor();
  // účet pro QR platbu, QR kód a označení vyrovnání
  await page.getByRole("button", { name: "Jana", exact: true }).click();
  await dlg.getByLabel("Číslo účtu pro QR platbu").fill("19-2000145399/0800");
  await dlg.getByRole("button", { name: "Uložit" }).click();
  await toast("Uloženo");
  await page.getByRole("button", { name: "QR" }).click();
  await dlg.getByRole("img", { name: "QR platba" }).waitFor();
  await dlg.getByText("CZ6508000000192000145399").waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Vyrovnáno" }).click();
  await toast("Označeno jako vyrovnané");
  await page.getByText("Vše je vyrovnané").waitFor();
  await page.getByText("Už vyrovnáno").waitFor();
  // sdílení odkazem jen pro čtení
  await page.getByRole("button", { name: "Vytvořit odkaz" }).click();
  await toast("Odkaz pro sdílení vytvořen");
  const shareUrl = await page.getByLabel("Odkaz pro sdílení").inputValue();
  {
    const anon = await browser.newContext();
    const ap = await anon.newPage();
    await ap.goto(B + shareUrl);
    await ap.getByText("Sdílená cesta · jen pro čtení").waitFor();
    await ap.getByRole("heading", { name: "Test Vídeň" }).waitFor();
    await ap.getByText("Hotel Sacher").waitFor();
    await anon.close();
  }
  // rozpočet po kategoriích
  await page.getByRole("button", { name: "Upravit" }).first().click();
  await dlg.getByText("Rozpočet po kategoriích (nepovinné)").click();
  await dlg.getByLabel("Jídlo a pití").fill("300");
  await modalSubmit("Uložit");
  await toast("Cesta upravena");
  await page.getByText("Rozpočet po kategoriích", { exact: true }).waitFor();
  await page.getByText(/přes limit o/).first().waitFor();
  await page.screenshot({ path: `${SHOTS}/30-cesta.png`, fullPage: true });

  // souhrn
  await tab("Souhrn");
  assert.match(await page.locator("main").innerText(), /1\s633\s*Kč/, "utraceno 798 + 584,64 + 250");

  // příprava
  await tab("Příprava");
  await page.getByRole("button", { name: "Doplnit podle typu cesty" }).click();
  await toast("podle typu cesty");
  await page.getByRole("button", { name: "Cestovní pojištění" }).click();
  await page.getByText(/Hotovo 1 z/).waitFor();

  // offline: výdaj se uloží v telefonu a odešle po připojení
  await tab("Výdaje");
  await ctx.setOffline(true);
  await page.getByRole("button", { name: "Výdaj", exact: true }).click();
  await dlg.getByLabel("Za co").fill("Offline kafe");
  await dlg.getByLabel("Měna").selectOption("CZK");
  await dlg.getByLabel("Částka (Kč)").fill("50");
  await modalSubmit("Zapsat výdaj");
  await toast("Jste offline");
  await page.getByText(/1 čeká na odeslání/).waitFor();
  await ctx.setOffline(false);
  await toast("Odesláno 1");
  await page.getByText("Offline kafe").waitFor({ timeout: 20000 });

  // výdaje v příjmech a výdajích: výměna jednou, kafe z hotovosti ne
  await page.goto(B + "/transakce");
  await page.getByText("Test Vídeň: Řízek").first().waitFor();
  await page.getByText(/Test Vídeň: výměna \/ výběr 100 EUR/).first().waitFor();
  assert.equal(await page.getByText("Test Vídeň: Kafe").count(), 0, "platba z hotovosti se neodečítá znovu");

  // smazání výdaje stornuje platbu
  await page.goto(tripUrl + "?tab=vydaje");
  page.once("dialog", (d) => d.accept());
  await page.locator("li", { hasText: "Řízek" }).getByRole("button").last().click();
  await toast("Výdaj smazán a platba stornována");

  // rychlé + během cesty
  await page.goto(B + "/");
  await page.getByText("Dnes můžete utratit").waitFor();
  await page.getByText(/Test Vídeň – 1\. den z 3/).waitFor();
  await page.getByRole("heading", { name: "Cestování" }).waitFor();
  await page.getByRole("button", { name: "Rychle přidat" }).first().click();
  await page.getByRole("menuitem", { name: "Výdaj na cestě" }).click();
  await dlg.getByLabel("Za co").fill("Voda");
  await dlg.getByLabel("Měna").selectOption("CZK");
  await dlg.getByLabel("Částka (Kč)").fill("30");
  await modalSubmit("Zapsat výdaj");
  await toast("Výdaj zapsán");

  // kopie cesty
  await page.goto(tripUrl);
  await page.getByRole("button", { name: "Kopie" }).click();
  await modalSubmit("Zkopírovat");
  await page.waitForURL((u) => /\/cestovani\/[0-9a-f-]{36}$/.test(u.pathname) && u.href !== tripUrl, { timeout: 20000 });
  await page.getByText("Zatím jen nápad").waitFor();
  await tab("Trasa a program");
  await page.getByText("RegioJet").first().waitFor();
  await page.getByText("Hotel Sacher").waitFor();

  await page.goto(B + "/cestovani?tab=navstivene");
  await page.getByText("Zatím žádná dokončená cesta").waitFor();
  await page.goto(B + "/uzaverka");
  await page.getByRole("heading", { name: /Uzávěrka:/ }).waitFor();
}

step("recepty: filtr kuchyně, detail s porcemi, suroviny do nákupního seznamu");
await page.goto(B + "/recepty?kuchyne=recka");
await page.getByText(/Nalezeno \d+ receptů/).waitFor();
await page.getByText("Řecký salát s kuřecím masem a quinoou").click();
await page.getByText("kuřecí prsa").waitFor();
await page.getByText("300 g").first().waitFor(); // 2 porce
await page.getByRole("button", { name: "Více porcí" }).click();
await page.getByText("450 g").first().waitFor();
await page.getByRole("button", { name: "Do nákupního seznamu" }).click();
await toast("Suroviny přidány do nákupního seznamu");
await page.waitForURL(/\/planovani/);
await page.getByText("Řecký salát s kuřecím masem a quinoou").first().waitFor();

step("vzhled: interiér na pozadí (DEMO)");
await page.goto(B + "/nastaveni#vzhled");
const shot = async () => (await page.screenshot({ clip: { x: 1300, y: 940, width: 120, height: 50 } })).toString("base64");
const before = await shot();
await page.getByRole("button", { name: /Obývák v teplém světle/ }).click();
await toast("Vzhled uložen");
assert.match(await page.locator("#ambient-scene").evaluate((el) => el.style.backgroundImage), /obyvak\.svg/);
await page.waitForTimeout(600);
assert.notEqual(await shot(), before, "pozadí s interiérem je opravdu vidět");
await page.reload();
assert.notEqual(await shot(), before, "pozadí vydrží po obnovení stránky");
await page.getByRole("button", { name: /Bez obrázku/ }).click();

step("reset domácnosti s heslem a dvojím potvrzením");
await page.getByRole("button", { name: "Resetovat domácnost" }).click();
await page.locator("[role=dialog] label", { hasText: "Nákupy a plánování" }).click();
await page.locator("[role=dialog]").getByRole("button", { name: "Pokračovat" }).first().click();
await page.locator("[role=dialog]").getByText("NEPŮJDOU vrátit").waitFor();
await page.locator("[role=dialog]").getByText("Rozumím, že smazaná data").click();
await page.locator("[role=dialog] input[name=confirm]").fill("VYNULOVAT");
await page.locator("[role=dialog] input[name=password]").fill("spatneheslo");
await page.locator("[role=dialog]").getByRole("button", { name: "Pokračovat" }).last().click();
await page.getByRole("button", { name: "Ano, trvale smazat" }).click();
await page.locator("[role=dialog]").getByText("Nesprávné heslo").filter({ visible: true }).first().waitFor();
await page.getByRole("button", { name: "Ne, zpět" }).click();
await page.locator("[role=dialog] input[name=password]").fill("tajneheslo1");
await page.locator("[role=dialog]").getByRole("button", { name: "Pokračovat" }).last().click();
await page.getByRole("button", { name: "Ano, trvale smazat" }).click();
await toast("Vynulováno");
await page.goto(B + "/planovani?tab=domov");
assert.equal(await page.getByText("Rohová sedačka").count(), 0, "nákupy po resetu zmizely");
await page.goto(B + "/transakce");
await page.getByText("Nákup: Víkendový nákup").waitFor(); // pohyby zůstaly

step("tovární reset – domácnost jako nově založená (IČO zůstane)");
await op.goto(B + "/transakce");
await op.getByRole("button", { name: "Výdaj", exact: true }).click();
await op.locator("[role=dialog] input[name=amount]").fill("100");
await op.locator("[role=dialog] input[name=description]").fill("Před resetem");
await op.locator('[role=dialog] button[type=submit]').click();
await op.locator("[role=status]", { hasText: "Výdaj uložen" }).first().waitFor();
await op.goto(B + "/nastaveni#domacnost");
await op.getByRole("button", { name: "Resetovat domácnost" }).click();
await op.getByRole("radio", { name: "Tovární reset" }).click();
await op.locator("[role=dialog]").getByRole("button", { name: "Pokračovat" }).first().click();
await op.locator("[role=dialog]").getByText("Rozumím, že smazaná data").click();
await op.locator("[role=dialog] input[name=confirm]").fill("tovární reset");
await op.locator("[role=dialog] input[name=password]").fill("tajneheslo2");
await op.locator("[role=dialog]").getByRole("button", { name: "Pokračovat" }).last().click();
await op.getByRole("button", { name: "Ano, trvale smazat" }).click();
await op.locator("[role=status]", { hasText: "Tovární reset dokončen" }).first().waitFor({ timeout: 20000 });
await op.waitForURL((u) => !u.pathname.startsWith("/nastaveni"));
await op.locator("[role=dialog]").waitFor({ state: "detached" });
const after = await (await op.request.get(`${B}/api/zaloha`)).json();
assert.equal(after.tables.transactions.length, 0);
assert.equal(after.tables.accounts.length, 0);
assert.equal(after.tables.categories.length, 19, "výchozí kategorie");
assert.equal(after.tables.household_settings[0].billing_ico, "27082440", "IČO zůstalo");

step("životní situace: student skryje Faktury a Domácnost, sekci jde vrátit");
await op.goto(B + "/nastaveni#situace");
await op.getByRole("button", { name: /Student\/ka/ }).click();
await op.locator("[role=status]", { hasText: "Uloženo" }).first().waitFor();
await op.reload();
assert.equal(await op.locator("aside nav").getByRole("link", { name: "Faktury" }).count(), 0, "faktury skryté");
await op.locator("#situace label", { hasText: /^Faktury/ }).click();
await op.locator("[role=status]", { hasText: "Uloženo" }).first().waitFor();
await op.reload();
await op.locator("aside nav").getByRole("link", { name: "Faktury" }).waitFor();

step("jazyk: slovenčina a angličtina, zpět čeština");
await op.goto(B + "/nastaveni#jazyk");
await op.getByRole("radio", { name: "Slovenčina" }).first().click();
await op.locator("aside nav").getByRole("link", { name: "Príjmy a výdavky" }).waitFor();
await op.getByRole("radio", { name: "English" }).first().click();
await op.locator("aside nav").getByRole("link", { name: "Income & expenses" }).waitFor();
await op.goto(B + "/");
await op.getByRole("radio", { name: "Simple" }).click();
await op.getByText("you can still safely spend").waitFor();
await op.goto(B + "/nastaveni#jazyk");
await op.getByRole("radio", { name: "Čeština" }).first().click();
await op.locator("aside nav").getByRole("link", { name: "Příjmy a výdaje" }).waitFor();
{
  const sk = await browser.newContext({ locale: "sk-SK" });
  const sp = await sk.newPage();
  await sp.goto(B + "/vitejte");
  await sp.getByText("Viete, koľko si môžete dovoliť.").waitFor();
  await sk.close();
}

step("majetek: čisté jmění, plán splacení, hlídač termínů, daně OSVČ");
{
  await op.goto(B + "/majetek");
  await op.getByText("Majetek, dluhy a termíny jsou součástí Premium").waitFor();
  await page.goto(B + "/majetek");
  const before = num(await page.getByTestId("net-worth").innerText());
  await page.getByRole("button", { name: "Majetek", exact: true }).click();
  await page.locator("[role=dialog] input[name=name]").fill("ETF");
  await page.locator("[role=dialog] input[name=value]").fill("100000");
  await modalSubmitOn(page, "Majetek přidán");
  await page.getByRole("button", { name: "Dluh", exact: true }).click();
  await page.locator("[role=dialog] input[name=name]").fill("Kreditka");
  await page.locator("[role=dialog] input[name=balance]").fill("30000");
  await page.locator("[role=dialog] input[name=rate]").fill("20");
  await page.locator("[role=dialog] input[name=min_payment]").fill("1500");
  await modalSubmitOn(page, "Dluh přidán");
  await page.getByRole("button", { name: "Dluh", exact: true }).click();
  await page.locator("[role=dialog] input[name=name]").fill("Půjčka");
  await page.locator("[role=dialog] input[name=balance]").fill("10000");
  await page.locator("[role=dialog] input[name=rate]").fill("8");
  await page.locator("[role=dialog] input[name=min_payment]").fill("1000");
  await modalSubmitOn(page, "Dluh přidán");
  await page.getByTestId("net-worth").filter({ hasText: /\d/ }).waitFor();
  await page.waitForFunction((b) => { const t = document.querySelector("[data-testid=net-worth]")?.textContent ?? ""; return Number(t.replace(/[^\d−-]/g, "").replace("−", "-")) === b + 100000 - 40000; }, before);
  await page.getByTestId("plan-avalanche").getByText("Bez dluhů za").waitFor();
  assert.match(await page.getByTestId("plan-snowball").innerText(), /1\. Půjčka/);
  await page.getByRole("button", { name: "Termín", exact: true }).click();
  await page.locator("[role=dialog] input[name=title]").fill("STK auto");
  await page.locator("[role=dialog] select[name=kind]").selectOption("stk");
  const soon = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
  await page.locator("[role=dialog] input[name=due_date]").fill(soon);
  await modalSubmitOn(page, "Termín přidán");
  await page.getByTestId("reminders").getByText("za 5 dní").waitFor();
  await page.goto(B + "/");
  await page.getByText("STK auto").first().waitFor();
  await page.goto(B + "/dane");
  await page.getByLabel("Příjmy za rok (Kč)").fill("1000000");
  await page.getByTestId("tax-result").getByText(/29\s160/).first().waitFor();
  // veřejné kalkulačky a články (bez přihlášení)
  const anon = await browser.newContext();
  const an = await anon.newPage();
  await an.goto(B + "/kalkulacky");
  await an.getByLabel("Výše úvěru").fill("4000000");
  await an.getByLabel("Úrok").fill("5");
  await an.getByLabel("Doba splácení").fill("30");
  await an.getByText(/21\s473 Kč/).waitFor();
  await an.getByRole("link", { name: "Články" }).first().click();
  await an.getByRole("link", { name: /Kapesné pro děti/ }).click();
  await an.getByRole("heading", { name: /Kapesné pro děti/ }).waitFor();
  assert.match(await (await an.request.get(B + "/sitemap.xml")).text(), /clanky\/kapesne/);
  assert.match(await (await an.request.get(B + "/robots.txt")).text(), /Sitemap:/);
  await anon.close();
  // úspěchy na podrobném přehledu
  await page.context().addCookies([{ name: "homeos_dash", value: "detailed", url: B }]);
  await page.goto(B + "/");
  await page.getByTestId("badges").getByLabel(/^První zápis/).waitFor();
}

step("výzvy a můj rok v číslech");
{
  await page.goto(B + "/vyzvy");
  const card = page.locator("div.rounded-2xl", { hasText: "Dny bez utrácení" }).last();
  await card.getByLabel("Cíl výzvy").fill("5");
  await card.getByRole("button", { name: "Přijmout" }).click();
  await page.locator("[role=status]", { hasText: "Výzva přijata" }).first().waitFor();
  await page.getByTestId("challenges").getByText("5 dní bez utrácení").waitFor();
  await page.goto(B + "/rok");
  await page.getByTestId("year-tiles").getByText("zapsaných pohybů").waitFor();
}

step("doporuč kamarádovi: odkaz s kódem, registrace přes doporučení");
{
  await op.goto(B + "/premium#doporuc");
  const link = (await op.getByTestId("referral-link").innerText()).trim();
  assert.match(link, /\/registrace\?ref=[A-Z0-9]{6,12}$/);
  const fr = await browser.newContext();
  const fp = await fr.newPage();
  await fp.goto(link.replace(/^https?:\/\/[^/]+/, B));
  await fp.getByText("Registrujete se přes doporučení").waitFor();
  await fp.fill("input[name=email]", "kamarad@example.cz");
  await fp.fill("input[name=password]", "tajneheslo3");
  await fp.fill("input[name=password2]", "tajneheslo3");
  await fp.check("input[name=terms]");
  await fp.click("button[type=submit]");
  await fp.waitForURL(/\/uvod/);
  await fr.close();
  await op.reload();
  await op.getByTestId("referral-stats").getByText("Čeká: 1").waitFor();
}

step("zabezpečení: 2FA (TOTP), limit pokusů, záznam chyb");
{
  const { createHmac } = await import("node:crypto");
  const totp = (b32) => {
    const al = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = "";
    for (const c of b32.replace(/=+$/, "").toUpperCase()) bits += al.indexOf(c).toString(2).padStart(5, "0");
    const key = Buffer.from(bits.match(/.{8}/g).map((x) => parseInt(x, 2)));
    const ctr = Buffer.alloc(8); ctr.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
    const h = createHmac("sha1", key).update(ctr).digest(); const o = h[19] & 15;
    return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, "0");
  };
  await op.goto(B + "/nastaveni#zabezpeceni");
  await op.getByRole("button", { name: "Zapnout dvoufázové ověření" }).click();
  const secret = (await op.getByTestId("totp-secret").innerText()).trim();
  await op.getByLabel("Kód z aplikace").fill("000000");
  await op.getByRole("button", { name: "Potvrdit" }).click();
  await op.getByText("Nesprávný kód").waitFor();
  await op.getByLabel("Kód z aplikace").fill(totp(secret));
  await op.getByRole("button", { name: "Potvrdit" }).click();
  await op.getByText("Dvoufázové ověření je zapnuté").waitFor();
  // nové přihlášení vyžaduje kód
  const z = await browser.newContext();
  const zp = await z.newPage();
  await zp.goto(B + "/prihlaseni");
  await zp.fill("input[name=email]", "cizi@example.cz");
  await zp.fill("input[name=password]", "tajneheslo2");
  await zp.click("button[type=submit]");
  await zp.waitForURL(/\/prihlaseni\/overeni/);
  await zp.goto(B + "/transakce");
  await zp.waitForURL(/\/prihlaseni\/overeni/);
  assert.equal((await zp.request.get(`${B}/api/zaloha`)).ok(), false, "bez druhého faktoru nejsou data");
  await zp.getByLabel("Kód").fill(totp(secret));
  await zp.getByRole("button", { name: "Ověřit" }).click();
  await zp.waitForURL((u) => u.pathname === "/");
  // odhlásit všechna zařízení → i původní relace (op) končí
  await zp.goto(B + "/nastaveni#zabezpeceni");
  await zp.getByRole("button", { name: "Odhlásit ze všech zařízení" }).click();
  await zp.waitForURL(/\/prihlaseni/);
  await z.close();
  await op.goto(B + "/transakce");
  await op.waitForURL(/\/prihlaseni/);
  await op.fill("input[name=email]", "cizi@example.cz");
  await op.fill("input[name=password]", "tajneheslo2");
  await op.click("button[type=submit]");
  await op.waitForURL(/\/prihlaseni\/overeni/);
  await op.getByLabel("Kód").fill(totp(secret));
  await op.getByRole("button", { name: "Ověřit" }).click();
  await op.waitForURL((u) => u.pathname === "/");
  await op.goto(B + "/nastaveni#zabezpeceni");
  await op.getByLabel("Heslo pro vypnutí").fill("tajneheslo2");
  await op.getByRole("button", { name: "Vypnout 2FA" }).click();
  await op.getByRole("button", { name: "Zapnout dvoufázové ověření" }).waitFor();
  // limit chybných přihlášení
  const g = await browser.newContext();
  const gp = await g.newPage();
  for (let i = 0; i < 6; i++) {
    await gp.goto(B + "/prihlaseni");
    await gp.fill("input[name=email]", "nikdo@example.cz");
    await gp.fill("input[name=password]", "spatneheslo" + i);
    await gp.click("button[type=submit]");
    await gp.getByText(i < 5 ? "Nesprávný e-mail nebo heslo." : "Příliš mnoho neúspěšných pokusů").waitFor();
  }
  // chyba z prohlížeče se zapíše (admin ji vidí v přehledu)
  const lr = await gp.request.post(`${B}/api/log-error`, { data: { message: "e2e testovací chyba", path: "/e2e" } });
  assert.equal(lr.ok(), true);
  await g.close();
}

step("smazání účtu (GDPR)");
await op.goto(B + "/nastaveni#ucet");
await op.getByRole("button", { name: "Smazat účet…" }).click();
await op.getByLabel("Vaše heslo").fill("tajneheslo2");
await op.getByLabel("Pro potvrzení napište SMAZAT").fill("SMAZAT");
await op.getByRole("button", { name: "Trvale smazat účet" }).click();
await op.waitForURL(/\/vitejte/);
await op.goto(B + "/prihlaseni");
await op.fill("input[name=email]", "cizi@example.cz");
await op.fill("input[name=password]", "tajneheslo2");
await op.click("button[type=submit]");
await op.getByText("Nesprávný e-mail nebo heslo.").waitFor();

assert.deepEqual(errors, [], "chyby v konzoli prohlížeče");
console.log("✓ Všechny end-to-end kontroly prošly");
await browser.close();
