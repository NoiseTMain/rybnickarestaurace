/**
 * Suroviny: nutriční hodnoty na 100 g (syrové / suché, běžné tabulkové hodnoty)
 * a orientační cena za kg v ČR. Ceny jsou jen odhad pro plánování – skutečné se liší podle obchodu.
 */
export interface Ingredient {
  name: string;
  kcal: number; p: number; c: number; f: number;
  /** Orientační cena Kč za kg. */
  price: number;
  /** Gramů na 1 kus (pro zobrazení v kusech). */
  piece?: number;
  /** Tvar „s …“ (do názvu receptu). */
  with?: string;
  /** Tvar „a …“ (příloha / doplněk do názvu). */
  and?: string;
  /** Tvar pro postup (4. pád). */
  acc?: string;
  /** Krok přípravy, když je surovina hlavní nebo příloha. */
  prep?: string;
  tags?: ("meat" | "fish" | "veg" | "vegan" | "dairy")[];
}

export const ING: Record<string, Ingredient> = {
  // bílkoviny
  chicken: { name: "kuřecí prsa", kcal: 110, p: 23, c: 0, f: 1.5, price: 180, with: "s kuřecím masem", acc: "kuřecí maso", prep: "Kuřecí maso nakrájejte na kousky, osolte, opepřete a opečte na pánvi s kapkou oleje 6–8 minut, až je propečené.", tags: ["meat"] },
  turkey: { name: "krůtí prsa", kcal: 105, p: 24, c: 0, f: 1, price: 220, with: "s krůtím masem", acc: "krůtí maso", prep: "Krůtí maso nakrájejte na kousky, osolte a opečte na pánvi 6–8 minut.", tags: ["meat"] },
  beef: { name: "libové hovězí", kcal: 150, p: 21, c: 0, f: 7, price: 300, with: "s hovězím masem", acc: "hovězí", prep: "Hovězí nakrájejte na nudličky (nebo použijte libové mleté) a prudce opečte 4–5 minut.", tags: ["meat"] },
  pork: { name: "vepřová panenka", kcal: 120, p: 21, c: 0, f: 3.5, price: 200, with: "s vepřovou panenkou", acc: "panenku", prep: "Panenku nakrájejte na medailonky, osolte a opečte z obou stran 3–4 minuty.", tags: ["meat"] },
  salmon: { name: "losos", kcal: 200, p: 20, c: 0, f: 13, price: 450, with: "s lososem", acc: "lososa", prep: "Lososa osolte a opečte na pánvi nebo upečte (200 °C, 12 minut).", tags: ["fish"] },
  tuna: { name: "tuňák ve vlastní šťávě (okapaný)", kcal: 110, p: 25, c: 0, f: 1, price: 350, with: "s tuňákem", acc: "tuňáka", prep: "Tuňáka sceďte a rozdělte vidličkou.", tags: ["fish"] },
  cod: { name: "treska", kcal: 80, p: 18, c: 0, f: 0.7, price: 350, with: "s treskou", acc: "tresku", prep: "Tresku osolte, pokapejte citronem a upečte (200 °C, 12–15 minut).", tags: ["fish"] },
  shrimp: { name: "krevety", kcal: 85, p: 20, c: 0, f: 0.5, price: 500, with: "s krevetami", acc: "krevety", prep: "Krevety opečte na pánvi 2–3 minuty, dokud nezrůžoví.", tags: ["fish"] },
  eggs: { name: "vejce", kcal: 143, p: 12.6, c: 0.7, f: 9.5, price: 80, piece: 60, with: "s vejci", acc: "vejce", prep: "Vejce připravte na pánvi (nebo uvařte natvrdo 9 minut).", tags: ["veg", "dairy"] },
  egg_whites: { name: "vaječné bílky", kcal: 52, p: 11, c: 0.7, f: 0.2, price: 110, with: "s bílky", acc: "bílky", prep: "Bílky prošlehejte vidličkou se špetkou soli.", tags: ["veg"] },
  tofu: { name: "tofu", kcal: 120, p: 13, c: 2, f: 7, price: 160, with: "s tofu", acc: "tofu", prep: "Tofu osušte, nakrájejte na kostky a opečte dozlatova 6–8 minut.", tags: ["veg", "vegan"] },
  chickpeas: { name: "cizrna (vařená/z konzervy)", kcal: 140, p: 7.5, c: 21, f: 2.5, price: 80, with: "s cizrnou", acc: "cizrnu", prep: "Cizrnu sceďte, propláchněte a krátce opečte s kořením.", tags: ["veg", "vegan"] },
  beans: { name: "červené fazole (z konzervy, okapané)", kcal: 130, p: 8, c: 23, f: 0.5, price: 70, with: "s fazolemi", acc: "fazole", prep: "Fazole sceďte a propláchněte.", tags: ["veg", "vegan"] },
  black_beans: { name: "černé fazole (okapané)", kcal: 130, p: 8, c: 23, f: 0.5, price: 80 , with: "s černými fazolemi", acc: "černé fazole", tags: ["veg", "vegan"] },
  red_lentils: { name: "červená čočka (suchá)", kcal: 340, p: 25, c: 50, f: 2, price: 70, with: "s červenou čočkou", acc: "čočku", prep: "Čočku propláchněte a vařte 12–15 minut doměkka.", tags: ["veg", "vegan"] },
  cottage: { name: "cottage sýr", kcal: 100, p: 12, c: 3, f: 4.5, price: 160, with: "s cottage sýrem", acc: "cottage sýr", tags: ["veg", "dairy"] },
  greek_yogurt: { name: "řecký jogurt 0 %", kcal: 60, p: 10, c: 4, f: 0.2, price: 120, with: "s řeckým jogurtem", acc: "jogurt", tags: ["veg", "dairy"] },
  skyr: { name: "skyr", kcal: 63, p: 11, c: 4, f: 0.2, price: 130, with: "se skyrem", acc: "skyr", tags: ["veg", "dairy"] },
  tvaroh: { name: "tvaroh odtučněný", kcal: 70, p: 12, c: 4, f: 0.5, price: 100, with: "s tvarohem", acc: "tvaroh", tags: ["veg", "dairy"] },
  protein: { name: "syrovátkový protein", kcal: 380, p: 75, c: 8, f: 5, price: 600, with: "s proteinem", acc: "protein", tags: ["veg", "dairy"] },
  halloumi: { name: "halloumi", kcal: 320, p: 22, c: 2, f: 25, price: 400, with: "s halloumi", acc: "halloumi", prep: "Halloumi nakrájejte na plátky a opečte na suché pánvi 2 minuty z každé strany.", tags: ["veg", "dairy"] },
  mozzarella: { name: "mozzarella light", kcal: 165, p: 20, c: 2, f: 9, price: 200, with: "s mozzarellou", acc: "mozzarellu", tags: ["veg", "dairy"] },
  edamame: { name: "edamame (loupané)", kcal: 120, p: 11, c: 9, f: 5, price: 200, with: "s edamame", acc: "edamame", prep: "Edamame povařte 4 minuty.", tags: ["veg", "vegan"] },
  feta: { name: "feta", kcal: 265, p: 14, c: 4, f: 21, price: 250, with: "s fetou", acc: "fetu", tags: ["dairy"] },
  parmesan: { name: "parmazán", kcal: 400, p: 35, c: 0, f: 28, price: 600, tags: ["dairy"] },
  cheese: { name: "eidam 30 %", kcal: 270, p: 30, c: 0, f: 16, price: 200, with: "se sýrem", acc: "sýr", tags: ["dairy"] },
  // přílohy
  rice: { name: "rýže (suchá)", kcal: 350, p: 7, c: 78, f: 0.6, price: 50, and: "a rýží", acc: "rýži", prep: "Rýži propláchněte a uvařte (12–15 minut)." },
  basmati: { name: "basmati rýže (suchá)", kcal: 350, p: 8, c: 77, f: 0.6, price: 75, and: "a basmati rýží", acc: "rýži", prep: "Rýži basmati propláchněte a uvařte (12 minut)." },
  quinoa: { name: "quinoa (suchá)", kcal: 370, p: 14, c: 64, f: 6, price: 150, and: "a quinoou", acc: "quinou", prep: "Quinou propláchněte a vařte 15 minut." },
  bulgur: { name: "bulgur (suchý)", kcal: 340, p: 12, c: 76, f: 1.3, price: 80, and: "a bulgurem", acc: "bulgur", prep: "Bulgur zalijte dvojnásobkem vody a vařte 10 minut." },
  couscous: { name: "kuskus (suchý)", kcal: 360, p: 12, c: 72, f: 2, price: 70, and: "a kuskusem", acc: "kuskus", prep: "Kuskus zalijte vroucí vodou, přikryjte a nechte 5 minut nabobtnat." },
  pasta_ww: { name: "celozrnné těstoviny (suché)", kcal: 350, p: 13, c: 65, f: 2.5, price: 70, and: "a těstovinami", acc: "těstoviny" },
  potatoes: { name: "brambory", kcal: 77, p: 2, c: 17, f: 0.1, price: 20, and: "a bramborami", acc: "brambory", prep: "Brambory oloupejte, nakrájejte a uvařte doměkka (20 minut) nebo upečte." },
  sweet_potato: { name: "batáty", kcal: 86, p: 1.6, c: 20, f: 0.1, price: 60, and: "a batáty", acc: "batáty", prep: "Batáty nakrájejte na kostky a upečte na 200 °C asi 25 minut." },
  oats: { name: "ovesné vločky", kcal: 380, p: 13, c: 60, f: 7, price: 40 },
  bread: { name: "celozrnný chléb", kcal: 240, p: 10, c: 41, f: 3, price: 80, and: "a celozrnným chlebem", acc: "chléb" },
  tortilla: { name: "celozrnná tortilla", kcal: 300, p: 9, c: 48, f: 7, price: 120, piece: 60, and: "a tortillou", acc: "tortillu", prep: "Tortillu krátce nahřejte na suché pánvi." },
  rice_noodles: { name: "rýžové nudle (suché)", kcal: 360, p: 6, c: 80, f: 0.6, price: 100, and: "a rýžovými nudlemi", acc: "nudle", prep: "Nudle zalijte horkou vodou a nechte 5–8 minut změknout." },
  buckwheat: { name: "pohanka (suchá)", kcal: 345, p: 13, c: 71, f: 3, price: 70, and: "a pohankou", acc: "pohanku", prep: "Pohanku propláchněte a vařte 10 minut." },
  // zelenina a ovoce
  broccoli: { name: "brokolice", kcal: 34, p: 2.8, c: 7, f: 0.4, price: 70, with: "s brokolicí", and: "a brokolicí", acc: "brokolici" },
  spinach: { name: "špenát", kcal: 23, p: 2.9, c: 3.6, f: 0.4, price: 120, and: "a špenátem", acc: "špenát", prep: "Špenát přidejte na konec a nechte jen zavadnout." },
  tomato: { name: "rajčata", kcal: 18, p: 0.9, c: 3.9, f: 0.2, price: 60 },
  cucumber: { name: "okurka", kcal: 15, p: 0.7, c: 3.6, f: 0.1, price: 40 },
  bell_pepper: { name: "paprika", kcal: 31, p: 1, c: 6, f: 0.3, price: 80, and: "a paprikou", acc: "papriku", prep: "Papriku nakrájejte na proužky a přidejte k zelenině." },
  onion: { name: "cibule", kcal: 40, p: 1.1, c: 9.3, f: 0.1, price: 25 },
  red_onion: { name: "červená cibule", kcal: 40, p: 1.1, c: 9.3, f: 0.1, price: 40 },
  garlic: { name: "česnek", kcal: 149, p: 6.4, c: 33, f: 0.5, price: 150 },
  carrot: { name: "mrkev", kcal: 41, p: 0.9, c: 10, f: 0.2, price: 25 },
  zucchini: { name: "cuketa", kcal: 17, p: 1.2, c: 3.1, f: 0.3, price: 50, and: "a cuketou", acc: "cuketu", prep: "Cuketu nakrájejte a krátce opečte." },
  eggplant: { name: "lilek", kcal: 25, p: 1, c: 6, f: 0.2, price: 60 },
  mushrooms: { name: "žampiony", kcal: 22, p: 3.1, c: 3.3, f: 0.3, price: 100, and: "a žampiony", acc: "žampiony", prep: "Žampiony nakrájejte na plátky a opečte do zlatova.", with: "se žampiony" },
  lettuce: { name: "listový salát", kcal: 15, p: 1.4, c: 2.9, f: 0.2, price: 80 },
  cabbage: { name: "zelí", kcal: 25, p: 1.3, c: 6, f: 0.1, price: 20 },
  cauliflower: { name: "květák", kcal: 25, p: 1.9, c: 5, f: 0.3, price: 50 },
  green_beans: { name: "zelené fazolky", kcal: 31, p: 1.8, c: 7, f: 0.2, price: 90 },
  peas: { name: "hrášek (mražený)", kcal: 81, p: 5, c: 14, f: 0.4, price: 60, and: "a hráškem", acc: "hrášek", prep: "Hrášek přidejte posledních 5 minut." },
  corn: { name: "kukuřice (konzerva)", kcal: 86, p: 3.2, c: 19, f: 1.2, price: 80, and: "a kukuřicí", acc: "kukuřici", prep: "Kukuřici sceďte." },
  avocado: { name: "avokádo", kcal: 160, p: 2, c: 9, f: 15, price: 200 },
  olives: { name: "olivy", kcal: 115, p: 0.8, c: 6, f: 11, price: 250 },
  lemon: { name: "citron (šťáva)", kcal: 29, p: 1.1, c: 9, f: 0.3, price: 60 },
  lime: { name: "limetka (šťáva)", kcal: 30, p: 0.7, c: 10, f: 0.2, price: 120 },
  passata: { name: "rajčatová passata", kcal: 30, p: 1.5, c: 5.5, f: 0.2, price: 50 },
  canned_tomatoes: { name: "drcená rajčata (konzerva)", kcal: 22, p: 1.1, c: 3.5, f: 0.2, price: 50 },
  bok_choy: { name: "pak choi", kcal: 13, p: 1.5, c: 2.2, f: 0.2, price: 100, and: "a pak choi", acc: "pak choi", prep: "Pak choi rozpulte a krátce orestujte." },
  spring_onion: { name: "jarní cibulka", kcal: 32, p: 1.8, c: 7, f: 0.2, price: 80 },
  ginger: { name: "zázvor", kcal: 80, p: 1.8, c: 18, f: 0.8, price: 120 },
  chili: { name: "chilli paprička", kcal: 40, p: 1.9, c: 9, f: 0.4, price: 200 },
  herbs: { name: "čerstvé bylinky", kcal: 30, p: 3, c: 5, f: 0.5, price: 500 },
  sauerkraut: { name: "kysané zelí", kcal: 20, p: 1, c: 4, f: 0.1, price: 40 },
  banana: { name: "banán", kcal: 89, p: 1.1, c: 23, f: 0.3, price: 35, piece: 120, and: "a banánem", acc: "banán" },
  berries: { name: "lesní ovoce (mražené)", kcal: 50, p: 0.8, c: 12, f: 0.3, price: 150, and: "a lesním ovocem", acc: "lesní ovoce" },
  apple: { name: "jablko", kcal: 52, p: 0.3, c: 14, f: 0.2, price: 35, piece: 150, and: "a jablkem", acc: "jablko" },
  // tuky, omáčky, ostatní
  olive_oil: { name: "olivový olej", kcal: 884, p: 0, c: 0, f: 100, price: 200 },
  coconut_milk: { name: "kokosové mléko light", kcal: 75, p: 0.7, c: 2.5, f: 7, price: 90 },
  peanut_butter: { name: "arašídové máslo", kcal: 590, p: 25, c: 20, f: 50, price: 180 },
  tahini: { name: "tahini", kcal: 595, p: 17, c: 21, f: 54, price: 250 },
  soy_sauce: { name: "sójová omáčka", kcal: 53, p: 8, c: 5, f: 0.6, price: 120 },
  honey: { name: "med", kcal: 304, p: 0.3, c: 82, f: 0, price: 200 },
  curry_paste: { name: "kari pasta", kcal: 100, p: 2, c: 10, f: 6, price: 400 },
  spices: { name: "koření", kcal: 300, p: 12, c: 50, f: 10, price: 400 },
  salsa: { name: "salsa", kcal: 30, p: 1.5, c: 6, f: 0.2, price: 120 },
  hummus: { name: "hummus", kcal: 170, p: 8, c: 14, f: 10, price: 200 },
  milk: { name: "mléko 1,5 %", kcal: 47, p: 3.4, c: 4.9, f: 1.5, price: 22 },
  almonds: { name: "mandle", kcal: 600, p: 21, c: 9, f: 50, price: 350 },
  walnuts: { name: "vlašské ořechy", kcal: 650, p: 15, c: 7, f: 65, price: 400 },
  chia: { name: "chia semínka", kcal: 490, p: 17, c: 42, f: 31, price: 300 },
  sesame: { name: "sezam", kcal: 570, p: 18, c: 23, f: 50, price: 200 },
  miso: { name: "miso pasta", kcal: 200, p: 12, c: 26, f: 6, price: 300 },
  sour_cream: { name: "zakysaná smetana 12 %", kcal: 135, p: 3, c: 4, f: 12, price: 80 },
  mustard: { name: "hořčice", kcal: 70, p: 4, c: 6, f: 4, price: 60 },
  // doplněno pro další recepty a dezerty
  cocoa: { name: "kakao", kcal: 380, p: 20, c: 13, f: 22, price: 300, tags: ["vegan"] },
  dark_chocolate: { name: "hořká čokoláda 70 %", kcal: 580, p: 8, c: 34, f: 43, price: 400, tags: ["vegan"] },
  flour: { name: "celozrnná mouka", kcal: 340, p: 13, c: 62, f: 2.5, price: 40, tags: ["vegan"] },
  ham: { name: "šunka nejvyšší jakosti", kcal: 110, p: 20, c: 1, f: 3, price: 300, with: "se šunkou", acc: "šunku", tags: ["meat"] },
  pesto: { name: "bazalkové pesto", kcal: 450, p: 5, c: 6, f: 45, price: 400, tags: ["dairy"] },
  pumpkin: { name: "dýně hokkaido", kcal: 40, p: 1.5, c: 8, f: 0.2, price: 50, and: "a dýní", acc: "dýni", prep: "Dýni nakrájejte na kostky a upečte na 200 °C 20 minut.", tags: ["vegan"] },
  beetroot: { name: "červená řepa (vařená)", kcal: 44, p: 1.7, c: 10, f: 0.2, price: 60, and: "a červenou řepou", acc: "červenou řepu", tags: ["vegan"] },
  cream_cheese: { name: "lučina light", kcal: 160, p: 8, c: 5, f: 12, price: 250, tags: ["dairy"] },
};
