// End-to-end test celého toku denního menu v reálném prohlížeči (Chromium)
// proti `next start` a lokálnímu mock backendu (tests/e2e/mock-backend.mjs).
//   node tests/e2e/run.mjs
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const MOCK = process.env.MOCK_URL ?? "http://127.0.0.1:54321";
const SHOTS = process.env.SHOTS_DIR ?? "test-results";
const fixture = (n) => new URL(`../fixtures/${n}`, import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

const mock = async (p) => (await fetch(`${MOCK}${p}`)).json();
let step = 0;
const ok = (msg) => console.log(`  ✓ ${String(++step).padStart(2, "0")} ${msg}`);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });

try {
  // ------------------------------------------------------------ veřejný web bez menu
  const mobile = await browser.newContext({ ...devices["iPhone 13"] });
  let page = await mobile.newPage();
  await page.goto(BASE);
  await page.getByText("Dnešní menu připravujeme").first().waitFor();
  ok("bez nahraného menu web ukazuje „Dnešní menu připravujeme“");
  const bar = page.getByRole("navigation", { name: "Rychlé akce" });
  assert.equal(await bar.getByRole("link", { name: "Zavolat" }).getAttribute("href"), "tel:+420602163330");
  assert.match(await bar.getByRole("link", { name: "Trasa" }).getAttribute("href"), /google\.com\/maps\/dir/);
  assert.equal(await bar.getByRole("link", { name: "Denní menu" }).getAttribute("href"), "/denni-menu");
  ok("mobilní spodní panel: Zavolat (tel:), Denní menu, Trasa");
  for (const name of ["DNEŠNÍ MENU", "NÁPOJOVÝ LÍSTEK", "REZERVOVAT", "ZAVOLAT"]) {
    assert.ok(await page.getByRole("link", { name }).first().isVisible(), name);
  }
  ok("hlavní tlačítka v úvodu jsou viditelná");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, `vodorovné přetečení ${overflow}px`);
  ok("bez vodorovného posouvání na iPhonu");
  await page.screenshot({ path: `${SHOTS}/01-mobil-uvod-bez-menu.png`, fullPage: true });

  // menu na mobilu: otevření a navigace
  await page.getByRole("button", { name: "Otevřít menu" }).click();
  await page.getByRole("navigation", { name: "Mobilní navigace" }).getByRole("link", { name: "Kontakt" }).click();
  await page.waitForURL("**/kontakt");
  assert.equal(await page.locator("#mobile-nav").isHidden(), true);
  ok("mobilní navigace otevře stránku a sama se zavře");
  await mobile.close();

  // ------------------------------------------------------------ ochrana administrace
  const anon = await browser.newContext();
  page = await anon.newPage();
  await page.goto(`${BASE}/admin/menu/nahrat`);
  await page.waitForURL("**/admin/prihlaseni");
  ok("/admin bez přihlášení přesměruje na přihlášení");
  let r = await page.request.post(`${BASE}/api/admin/menus`, { data: {}, headers: { Origin: BASE } });
  assert.equal(r.status(), 401);
  r = await page.request.post(`${BASE}/api/admin/menus/00000000-0000-4000-8000-000000000000/email`, { data: { force: true }, headers: { Origin: BASE } });
  assert.equal(r.status(), 401);
  ok("API pro zveřejnění a e-mail bez přihlášení vrací 401");

  // přihlášený uživatel, který není admin
  await page.getByLabel("E-mail").fill("host@example.cz");
  await page.getByLabel("Heslo").fill("TestovaciHeslo123");
  await page.getByRole("button", { name: "Přihlásit se" }).click();
  await page.waitForTimeout(800);
  r = await page.request.post(`${BASE}/api/admin/menus`, { data: {}, headers: { Origin: BASE } });
  assert.equal(r.status(), 401);
  await page.goto(`${BASE}/admin`);
  await page.waitForURL("**/admin/prihlaseni");
  ok("přihlášený uživatel bez role admin nemá přístup (401 / přesměrování)");
  await anon.close();

  // ------------------------------------------------------------ přihlášení majitele
  const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  page = await adminCtx.newPage();
  page.on("dialog", (d) => d.accept());
  await page.goto(`${BASE}/admin/prihlaseni`);
  await page.getByLabel("E-mail").fill("majitel@example.cz");
  await page.getByLabel("Heslo").fill("špatné");
  await page.getByRole("button", { name: "Přihlásit se" }).click();
  await page.getByText("Nesprávný e-mail nebo heslo.").waitFor();
  await page.getByLabel("Heslo").fill("TestovaciHeslo123");
  await page.getByRole("button", { name: "Přihlásit se" }).click();
  await page.waitForURL(`${BASE}/admin`);
  await page.getByText("NAHRÁT NOVÉ MENU").waitFor();
  ok("majitel se přihlásí, vidí přehled s tlačítkem NAHRÁT NOVÉ MENU");
  await page.screenshot({ path: `${SHOTS}/02-admin-prehled.png`, fullPage: true });

  // ------------------------------------------------------------ validace souboru
  await page.getByText("NAHRÁT NOVÉ MENU").click();
  await page.waitForURL("**/admin/menu/nahrat");
  await page.setInputFiles("#menu-file", fixture("fake.png"));
  await page.getByText("Soubor není platný obrázek PNG").waitFor();
  await page.setInputFiles("#menu-file", fixture("too-small.png"));
  await page.getByText("Obrázek je příliš malý").waitFor();
  assert.equal(await page.getByRole("button", { name: "Zveřejnit menu" }).isDisabled(), true);
  ok("JPEG přejmenovaný na .png i příliš malý obrázek jsou odmítnuty");

  // ------------------------------------------------------------ 1. menu – úspěch
  await page.setInputFiles("#menu-file", fixture("menu-test-1.png"));
  await page.getByAltText("Náhled nahrávaného menu").waitFor();
  await page.screenshot({ path: `${SHOTS}/03-admin-nahled.png`, fullPage: true });
  await page.getByRole("button", { name: "Zveřejnit menu" }).click();
  await page.getByText("Menu je zveřejněné").waitFor({ timeout: 20000 });
  await page.getByText("E-mail k tisku byl odeslán").waitFor();
  ok("nahrání PNG → náhled → Zveřejnit menu → zveřejněno a e-mail odeslán");
  await page.screenshot({ path: `${SHOTS}/04-admin-vysledek.png`, fullPage: true });

  let emails = await mock("/__control/emails");
  assert.equal(emails.length, 1);
  const mail = emails[0];
  assert.deepEqual(mail.to, ["info@rybnickarestaurace.cz"]);
  assert.match(mail.subject, /^Denní menu – Restaurace Rybníky – \d{1,2}\. \d{1,2}\. \d{4}$/);
  assert.match(mail.text, /v příloze zasíláme denní menu Restaurace Rybníky pro příslušný den\./);
  assert.match(mail.text, /Rybníky 40, 263 01 Dobříš\n\+420 602 163 330$/);
  assert.equal(mail.attachments.length, 1);
  assert.equal(mail.attachments[0].content_type ?? mail.attachments[0].contentType, "image/png");
  assert.equal(Buffer.from(mail.attachments[0].content, "base64").equals(readFileSync(fixture("menu-test-1.png"))), true);
  ok("e-mail: správný příjemce, předmět, text a originální PNG v příloze (bajt po bajtu)");

  // obnovení stránky nesmí odeslat e-mail znovu
  await page.reload();
  await page.waitForTimeout(1000);
  assert.equal((await mock("/__control/emails")).length, 1);
  ok("obnovení stránky po zveřejnění neodešle e-mail znovu");

  // ------------------------------------------------------------ veřejný web s menu
  const visitor = await browser.newContext({ ...devices["Pixel 7"] });
  const pub = await visitor.newPage();
  await pub.goto(BASE);
  const img = pub.getByAltText(/^Denní menu – /).first();
  await img.waitFor();
  const dims = await img.evaluate((el) => ({ w: el.naturalWidth, h: el.naturalHeight, cw: el.clientWidth, ch: el.clientHeight, vw: window.innerWidth }));
  assert.equal(dims.w, 1240);
  assert.equal(dims.h, 1754);
  assert.ok(Math.abs(dims.cw / dims.ch - 1240 / 1754) < 0.01, "poměr stran zachován");
  assert.ok(dims.cw <= dims.vw, "menu se vejde na šířku displeje");
  await pub.getByText(/^Dnes, /).first().waitFor();
  ok("web zobrazuje skutečné menu z úložiště, s datem, bez deformace a na šířku mobilu");
  await pub.screenshot({ path: `${SHOTS}/05-mobil-uvod-s-menu.png`, fullPage: true });

  await pub.goto(`${BASE}/denni-menu`);
  await pub.getByRole("button", { name: "Zvětšit" }).first().click();
  await pub.locator(".yarl__root").waitFor();
  await pub.getByRole("button", { name: "Přiblížit" }).click();
  await pub.waitForTimeout(400);
  await pub.screenshot({ path: `${SHOTS}/06-mobil-lightbox.png` });
  await pub.getByRole("button", { name: "Zavřít" }).click();
  ok("menu lze otevřít ve velkém náhledu a přiblížit");
  const dlHref = await pub.getByRole("link", { name: "Stáhnout" }).getAttribute("href");
  const dl = await pub.request.get(dlHref);
  assert.equal(dl.status(), 200);
  assert.match(dl.headers()["content-disposition"] ?? "", /attachment/);
  assert.equal(Buffer.from(await dl.body()).equals(readFileSync(fixture("menu-test-1.png"))), true);
  ok("tlačítko Stáhnout vrací originální PNG jako přílohu");
  assert.equal(await pub.getByRole("link", { name: "Tisk" }).getAttribute("href"), "/denni-menu/tisk");
  const printPage = await visitor.newPage();
  await printPage.addInitScript(() => (window.print = () => (window.__printed = true)));
  await printPage.goto(`${BASE}/denni-menu/tisk`);
  await printPage.waitForFunction(() => window.__printed === true, null, { timeout: 5000 });
  ok("stránka pro tisk zobrazí menu a otevře dialog tisku");

  // ------------------------------------------------------------ 2. menu – výpadek e-mailu
  await fetch(`${MOCK}/__control/resend?mode=fail`);
  await page.goto(`${BASE}/admin/menu/nahrat`);
  await page.setInputFiles("#menu-file", fixture("menu-test-2.png"));
  await page.getByRole("button", { name: "Zveřejnit menu" }).click();
  await page.getByText("Menu je zveřejněné").waitFor({ timeout: 20000 });
  await page.getByText("E-mail se nepodařilo odeslat").waitFor();
  await page.getByText(/Simulovaný výpadek e-mailové služby/).first().waitFor();
  let state = await mock("/__control/db");
  const second = state.daily_menus.find((m) => m.is_current);
  assert.equal(second.original_filename, "menu-test-2.png");
  assert.equal(second.email_status, "failed");
  assert.equal(second.email_sent_at, null);
  assert.equal(state.menu_email_log.at(-1).status, "failed");
  ok("při výpadku e-mailu je menu přesto zveřejněné, stav = selhalo (ne odesláno), chyba zalogována");
  await page.screenshot({ path: `${SHOTS}/07-admin-chyba-emailu.png`, fullPage: true });

  // veřejný web se sám obnoví na nové menu
  await pub.goto(BASE);
  await pub.waitForTimeout(500);
  const visibleSrc = await pub.getByAltText(/^Denní menu – /).first().getAttribute("src");
  assert.ok(visibleSrc.includes(second.storage_path.split("/").pop()), "web ukazuje nové menu");
  ok("nové menu nahradilo předchozí na veřejném webu");

  await fetch(`${MOCK}/__control/resend?mode=ok`);
  await page.getByRole("button", { name: "Zkusit e-mail odeslat znovu" }).click();
  await page.getByText("E-mail k tisku byl odeslán").waitFor();
  emails = await mock("/__control/emails");
  assert.equal(emails.length, 2);
  assert.equal(Buffer.from(emails[1].attachments[0].content, "base64").equals(readFileSync(fixture("menu-test-2.png"))), true);
  ok("opakované odeslání po chybě uspěje a odešle správné PNG");

  // ------------------------------------------------------------ historie
  await page.goto(`${BASE}/admin/menu/historie`);
  const rows = page.locator("main li.card");
  assert.equal(await rows.count(), 2);
  await page.getByText("V archivu").waitFor();
  await page.getByText("menu-test-1.png").waitFor();
  ok("historie obsahuje obě menu, starší je v archivu (nic se nesmazalo)");
  await page.screenshot({ path: `${SHOTS}/08-admin-historie.png`, fullPage: true });

  const firstRow = rows.filter({ hasText: "menu-test-1.png" });
  await firstRow.getByRole("button", { name: "Znovu zveřejnit" }).click();
  await firstRow.getByText("Menu je znovu zveřejněné na webu.").waitFor();
  state = await mock("/__control/db");
  assert.equal(state.daily_menus.find((m) => m.is_current).original_filename, "menu-test-1.png");
  assert.equal(state.daily_menus.length, 2);
  ok("starší menu lze znovu zveřejnit");

  const firstRowAgain = page.locator("main li.card").filter({ hasText: "menu-test-1.png" });
  await firstRowAgain.getByRole("button", { name: "Znovu odeslat e-mail" }).click(); // potvrzovací dialog se přijme
  await firstRowAgain.getByText(/E-mail odeslán na/).waitFor();
  assert.equal((await mock("/__control/emails")).length, 3);
  ok("znovuodeslání již odeslaného menu vyžaduje potvrzení a proběhne");

  // přímé API bez force nesmí odeslat podruhé
  const id1 = state.daily_menus.find((m) => m.original_filename === "menu-test-1.png").id;
  r = await page.request.post(`${BASE}/api/admin/menus/${id1}/email`, { data: {}, headers: { Origin: BASE } });
  assert.equal(r.status(), 409);
  assert.equal((await mock("/__control/emails")).length, 3);
  ok("bez výslovného potvrzení API odmítne odeslat stejné menu podruhé (409)");

  const secondRow = page.locator("main li.card").filter({ hasText: "menu-test-2.png" });
  await secondRow.getByRole("button", { name: "Smazat" }).click();
  await page.waitForTimeout(800);
  state = await mock("/__control/db");
  assert.equal(state.daily_menus.length, 1);
  assert.ok(!state.storage.some((k) => k.includes(second.storage_path)), "soubor smazán z úložiště");
  ok("smazání menu po potvrzení odstraní záznam i soubor");

  // ------------------------------------------------------------ nastavení e-mailu + otevírací doba
  await page.goto(`${BASE}/admin/nastaveni`);
  await page.getByLabel("Příjemce denního menu").fill("tisk@example.cz");
  await page.getByRole("button", { name: "Uložit e-mail" }).click();
  await page.getByText("Nastavení e-mailu je uložené.").waitFor();
  await page.getByLabel("Pondělí – otevření 1").fill("11:00");
  await page.getByLabel("Pondělí – zavření 1").fill("22:00");
  for (const [i, d] of ["Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota", "Neděle"].entries()) {
    await page.getByLabel(`${d} – otevření 1`).fill("11:00");
    await page.getByLabel(`${d} – zavření 1`).fill(i === 5 ? "20:00" : "23:00");
  }
  await page.getByRole("button", { name: "Uložit otevírací dobu" }).click();
  await page.getByText("Otevírací doba je uložená.").waitFor();
  ok("změna příjemce e-mailu a otevírací doby v administraci");

  await page.goto(`${BASE}/admin/menu/nahrat`);
  await page.getByText("tisk@example.cz").waitFor();
  await page.setInputFiles("#menu-file", fixture("menu-test-3.png"));
  await page.getByRole("button", { name: "Zveřejnit menu" }).click();
  await page.getByText("E-mail k tisku byl odeslán").waitFor({ timeout: 20000 });
  emails = await mock("/__control/emails");
  assert.deepEqual(emails.at(-1).to, ["tisk@example.cz"]);
  ok("další menu odchází na nově nastavenou adresu");

  await pub.goto(`${BASE}/kontakt`);
  await pub.locator("main").getByText("11:00–20:00").waitFor();
  ok("otevírací doba z administrace se zobrazuje na webu");

  // ------------------------------------------------------------ stálá nabídka
  await page.goto(`${BASE}/admin/nabidka?typ=napoje`);
  const beer = page.locator("section").filter({ has: page.getByRole("heading", { name: "Pivo" }) });
  await beer.getByText("+ Přidat položku").click();
  await beer.getByLabel("Název *").fill("Testovací světlý ležák");
  await beer.getByLabel("Cena v Kč").fill("49,50");
  await beer.getByLabel("Množství").fill("0,5 l");
  await beer.getByRole("button", { name: "Přidat položku" }).click();
  await beer.getByText("byla přidána").waitFor();
  await pub.goto(`${BASE}/napojovy-listek`);
  await pub.getByText("Testovací světlý ležák").waitFor();
  await pub.getByText("49,50 Kč").waitFor();
  ok("položka a cena přidaná v administraci se ihned zobrazí v nápojovém lístku");

  // ------------------------------------------------------------ sport
  await page.goto(`${BASE}/admin/sport`);
  await page.getByLabel("Čas *").first().fill("20:45");
  await page.getByLabel("Sport *").first().fill("Fotbal");
  await page.getByLabel("Událost *").first().fill("Testovací zápas A – B");
  await page.getByRole("button", { name: "Přidat přenos" }).click();
  await page.getByText("Přenos byl přidán.").waitFor();
  await pub.goto(`${BASE}/sportovni-prenosy`);
  await pub.getByText("Testovací zápas A – B").waitFor();
  await pub.getByText("20:45").waitFor();
  ok("sportovní přenos (čas v pražském pásmu) se zobrazí na webu");

  // ------------------------------------------------------------ poptávka
  await pub.goto(`${BASE}/rezervace?typ=akce`);
  await pub.getByLabel("Jméno a příjmení *").fill("Test Testovací");
  await pub.getByLabel("Telefon *").fill("+420 777 000 111");
  await pub.getByLabel("Počet osob").fill("40");
  await pub.getByLabel("Prostor", { exact: true }).selectOption("Sál");
  await pub.getByLabel("Popis akce").fill("Oslava narozenin – test");
  await pub.getByRole("checkbox").check();
  await pub.getByRole("button", { name: "Odeslat poptávku" }).click();
  await pub.getByText("Děkujeme, poptávku jsme přijali").waitFor();
  await page.goto(`${BASE}/admin/poptavky`);
  await page.getByText("Oslava narozenin – test").waitFor();
  emails = await mock("/__control/emails");
  assert.match(emails.at(-1).subject, /^Poptávka akce \/ pronájmu – Test Testovací/);
  ok("poptávka pronájmu se uloží, zobrazí v administraci a přijde e-mailem");

  // ------------------------------------------------------------ mobilní administrace
  const phone = await browser.newContext({ ...devices["iPhone 13"], storageState: await adminCtx.storageState() });
  const ph = await phone.newPage();
  await ph.goto(`${BASE}/admin`);
  await ph.getByText("NAHRÁT NOVÉ MENU").waitFor();
  const ov = await ph.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(ov <= 0, `admin přetéká o ${ov}px`);
  await ph.screenshot({ path: `${SHOTS}/09-mobil-admin.png`, fullPage: true });
  await ph.goto(`${BASE}/admin/menu/nahrat`);
  await ph.screenshot({ path: `${SHOTS}/10-mobil-admin-nahrat.png`, fullPage: true });
  ok("administrace je použitelná na telefonu (bez přetékání)");
  await phone.close();

  // ------------------------------------------------------------ odhlášení
  await page.goto(`${BASE}/admin`);
  await page.getByRole("button", { name: "Odhlásit" }).first().click();
  await page.waitForURL("**/admin/prihlaseni");
  await page.goto(`${BASE}/admin/menu/historie`);
  await page.waitForURL("**/admin/prihlaseni");
  ok("po odhlášení je administrace opět nepřístupná");

  // desktop screenshoty veřejného webu
  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const d = await desk.newPage();
  for (const [p, n] of [["/", "11-desktop-uvod"], ["/prostory", "12-desktop-prostory"], ["/kontakt", "13-desktop-kontakt"]]) {
    await d.goto(`${BASE}${p}`);
    await d.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true });
  }
  const tablet = await browser.newContext({ ...devices["iPad (gen 7)"] });
  const tp = await tablet.newPage();
  await tp.goto(BASE);
  await tp.screenshot({ path: `${SHOTS}/14-tablet-uvod.png`, fullPage: true });

  // kontrola odkazů: všechny interní odkazy vrací 200
  const links = new Set();
  for (const p of ["/", "/kontakt", "/prostory"]) {
    await d.goto(`${BASE}${p}`);
    for (const h of await d.$$eval("a[href^='/']", (as) => as.map((a) => a.getAttribute("href")))) links.add(h.split("#")[0] || "/");
  }
  for (const l of links) {
    const res = await d.request.get(`${BASE}${l}`, { maxRedirects: 0 });
    assert.ok([200, 307].includes(res.status()), `${l} → ${res.status()}`);
  }
  ok(`všech ${links.size} interních odkazů funguje`);

  console.log(`\nE2E: všech ${step} kontrol prošlo.`);
} catch (e) {
  console.error("\nE2E SELHAL:", e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
