// End-to-end test HomeOS v lokálním režimu: reálný prohlížeč, reálný server, reálné ukládání.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { invoicePdf } from "./make-pdf.mjs";

const B = process.env.BASE_URL ?? "http://localhost:3100";
const SHOTS = process.env.SHOTS_DIR ?? "test-results";
mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "cs-CZ", timezoneId: "Europe/Prague" });
const page = await ctx.newPage();
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
await page.getByRole("button", { name: "Pokračovat" }).click();
await page.getByText("Shrnutí").waitFor();
await page.getByRole("button", { name: "Dokončit nastavení" }).click();
await page.waitForURL((u) => u.pathname === "/", { timeout: 30000 });

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

step("práce: směna a výplata");
await page.goto(B + "/prace");
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

step("demo domácnost je oddělená");
await page.goto(B + "/nastaveni");
await page.getByRole("button", { name: "Vytvořit demo domácnost" }).click();
await page.waitForURL((u) => u.pathname === "/", { timeout: 60000 });
await page.getByText("ukázkovou (DEMO) domácnost").waitFor();
await page.screenshot({ path: `${SHOTS}/02-demo.png`, fullPage: true });

step("cizí uživatel nevidí data");
const other = await browser.newContext();
const op = await other.newPage();
await op.goto(B + "/registrace");
await op.fill("input[name=email]", "cizi@example.cz");
await op.fill("input[name=password]", "tajneheslo2");
await op.fill("input[name=password2]", "tajneheslo2");
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


assert.deepEqual(errors, [], "chyby v konzoli prohlížeče");
console.log("✓ Všechny end-to-end kontroly prošly");
await browser.close();
