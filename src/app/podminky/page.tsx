import { PublicShell, Prose } from "@/components/PublicShell";
import { LEGAL_UPDATED, OPERATOR } from "@/lib/legal";
import { FREE_LIMITS, PRICES } from "@/lib/plans";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Podmínky používání", robots: { index: true, follow: true } };

export default function Terms() {
  return (
    <PublicShell>
      <Prose>
        <h1>Podmínky používání HomeOS</h1>
        <p>Účinné od {LEGAL_UPDATED}. Provozovatel: {OPERATOR.name}{OPERATOR.ico ? `, IČO ${OPERATOR.ico}` : ""}{OPERATOR.address ? `, ${OPERATOR.address}` : ""}, kontakt <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a> (dále „provozovatel“).</p>
        <h2>1. Co je HomeOS</h2>
        <p>HomeOS je webová aplikace pro evidenci a plánování osobních a rodinných financí. Výpočty (např. kolik lze utratit) jsou orientační a vycházejí jen z údajů, které zadáte. Nejde o finanční, daňové ani investiční poradenství.</p>
        <h2>2. Účet</h2>
        <ul>
          <li>Registrací uzavíráte s provozovatelem smlouvu o užívání aplikace. Je vám alespoň 15 let.</li>
          <li>Odpovídáte za bezpečnost svého hesla a za údaje, které do aplikace zadáte. Do domácnosti zvete jen lidi, kterým důvěřujete – uvidí její data.</li>
          <li>Účet můžete kdykoli smazat v Nastavení → Účet. Provozovatel může účet zablokovat při porušení podmínek nebo zneužití služby.</li>
        </ul>
        <h2>3. Verze zdarma a Premium</h2>
        <ul>
          <li>Verze zdarma obsahuje základní funkce (1 vlastní domácnost, nejvýše {FREE_LIMITS.members} členové).</li>
          <li>Premium stojí {formatMoney(PRICES.monthly, { decimals: "never" })} měsíčně nebo {formatMoney(PRICES.yearly, { decimals: "never" })} ročně (vč. DPH) a přidává funkce uvedené na stránce Premium. Premium jednoho člena platí pro celou jeho domácnost.</li>
          <li>Platby zpracovává společnost Lemon Squeezy, LLC, která je prodejcem (merchant of record): vystavuje doklad, odvádí DPH a řeší vrácení plateb. Na nákup se vztahují i její podmínky.</li>
          <li>Předplatné se automaticky obnovuje. Zrušit ho můžete kdykoli v odkazu „Spravovat předplatné“; Premium pak platí do konce zaplaceného období.</li>
          <li>Jako spotřebitel máte právo odstoupit od smlouvy do 14 dnů od nákupu. Pokud však výslovně požádáte o okamžité zpřístupnění Premium, berete na vědomí, že se tím právo na odstoupení může zúžit v rozsahu již poskytnutého plnění.</li>
          <li>Provozovatel může Premium přidělit i bezplatně (např. testerům). Ceny a rozsah funkcí může měnit; změnu ceny oznámí předem a projeví se až od dalšího období.</li>
        </ul>
        <h2>4. AI funkce</h2>
        <p>AI asistent (Claude od společnosti Anthropic) odpovídá na základě dat vaší domácnosti, která mu aplikace k dotazu předá. Odpovědi mohou obsahovat chyby – důležitá rozhodnutí si ověřte. Počet dotazů je kvůli nákladům omezen měsíčním limitem.</p>
        <h2>5. Dostupnost a odpovědnost</h2>
        <p>Provozovatel se snaží o nepřetržitý a bezchybný provoz, ale nezaručuje ho. Doporučujeme pravidelně si stáhnout zálohu (Nastavení → Export a záloha). Provozovatel neodpovídá za škodu vzniklou rozhodnutím učiněným na základě výpočtů aplikace, pokud ji nezpůsobil úmyslně nebo hrubou nedbalostí.</p>
        <h2>6. Závěrečná ustanovení</h2>
        <p>Vztahy se řídí právem České republiky. Spory můžete řešit i mimosoudně u České obchodní inspekce (<a href="https://adr.coi.cz" target="_blank" rel="noreferrer">adr.coi.cz</a>). Podmínky může provozovatel změnit; o podstatné změně vás informuje e-mailem nebo v aplikaci nejméně 14 dní předem.</p>
      </Prose>
    </PublicShell>
  );
}
