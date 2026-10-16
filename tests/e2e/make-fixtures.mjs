// Vygeneruje testovací PNG menu (jasně označené jako TESTOVACÍ) a neplatné soubory.
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";

const out = new URL("../fixtures/", import.meta.url);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } });
for (const [name, title] of [["menu-test-1.png", "TESTOVACÍ MENU 1"], ["menu-test-2.png", "TESTOVACÍ MENU 2"], ["menu-test-3.png", "TESTOVACÍ MENU 3"]]) {
  await page.setContent(`<html><body style="margin:0;font-family:Georgia,serif;background:#fffdf7;color:#1b1d1a">
    <div style="padding:110px 120px">
      <p style="letter-spacing:.3em;color:#b4771b;font:600 28px Arial">RESTAURACE RYBNÍKY</p>
      <h1 style="font-size:96px;margin:10px 0 50px">${title}</h1>
      <p style="font:32px Arial;color:#a3311f">Pouze pro automatické testy – nejde o skutečnou nabídku.</p>
      ${["Polévka A", "Jídlo 1", "Jídlo 2", "Jídlo 3", "Jídlo 4", "Dezert"].map((d, i) => `<div style="display:flex;justify-content:space-between;font-size:46px;border-bottom:3px dotted #e3d5bb;padding:34px 0"><span>${d}</span><span>${(i + 1) * 10} Kč</span></div>`).join("")}
    </div></body></html>`);
  writeFileSync(new URL(name, out), await page.screenshot({ type: "png" }));
}
const tiny = await browser.newPage({ viewport: { width: 120, height: 120 } });
await tiny.setContent("<body style='background:red'></body>");
writeFileSync(new URL("too-small.png", out), await tiny.screenshot({ type: "png" }));
writeFileSync(new URL("fake.png", out), await page.screenshot({ type: "jpeg" }));
await browser.close();
console.log("fixtures ok");
