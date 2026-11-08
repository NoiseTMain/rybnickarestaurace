import { PublicShell, Prose } from "@/components/PublicShell";
import { LEGAL_UPDATED, OPERATOR } from "@/lib/legal";

export const metadata = { title: "Ochrana osobních údajů", robots: { index: true, follow: true } };

export default function Privacy() {
  return (
    <PublicShell>
      <Prose>
        <h1>Zásady ochrany osobních údajů</h1>
        <p>Účinné od {LEGAL_UPDATED}. Správce: {OPERATOR.name}{OPERATOR.ico ? `, IČO ${OPERATOR.ico}` : ""}, kontakt <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>.</p>
        <h2>Jaké údaje zpracováváme</h2>
        <ul>
          <li><b>Účet:</b> e-mail, heslo (jen v zašifrované podobě), datum registrace a posledního přihlášení.</li>
          <li><b>Data, která zadáte:</b> účty a zůstatky, příjmy a výdaje, platby, rozpočty, cíle, faktury, cesty, dokumenty a fotky, jména a kontakty členů domácnosti.</li>
          <li><b>Předplatné:</b> stav a období předplatného. Platební údaje (karta) zpracovává jen Lemon Squeezy – my je nevidíme.</li>
          <li><b>Technické údaje:</b> cookies nutné pro přihlášení a nastavení vzhledu. Nepoužíváme reklamní ani analytické sledování.</li>
        </ul>
        <h2>Proč a na jakém základě</h2>
        <ul>
          <li>Poskytování aplikace podle smlouvy (čl. 6 odst. 1 písm. b GDPR).</li>
          <li>Vyúčtování a evidence předplatného, plnění právních povinností (písm. b a c).</li>
          <li>Bezpečnost a prevence zneužití (oprávněný zájem, písm. f).</li>
        </ul>
        <h2>Kdo údaje vidí</h2>
        <ul>
          <li>Vy a členové, které do domácnosti pozvete. Správce aplikace v administraci vidí jen e-mail, data registrace a přihlášení, stav předplatného a počty záznamů – <b>ne vaše částky, transakce ani dokumenty</b>.</li>
          <li>Zpracovatelé: Supabase (databáze a soubory, region Londýn), Vercel (provoz webu), Lemon Squeezy (platby), Anthropic (jen při použití AI asistenta: obsah dotazu a potřebná data domácnosti), OpenStreetMap/CARTO a OSRM (mapy a trasy: jen názvy míst), Česká národní banka (kurzy).</li>
          <li>Velká Británie i USA jsou zajištěny rozhodnutím EU o odpovídající ochraně, resp. standardními smluvními doložkami.</li>
        </ul>
        <h2>Jak dlouho</h2>
        <p>Po dobu existence účtu. Po smazání účtu se data domácností, ve kterých jste byli jediným členem, smažou hned; zálohy databáze do 30 dní. Údaje o platbách uchovává Lemon Squeezy podle daňových předpisů.</p>
        <h2>Vaše práva</h2>
        <p>Máte právo na přístup, opravu, výmaz, omezení zpracování, přenositelnost (export v Nastavení → Export a záloha) a námitku. Účet smažete v Nastavení → Účet. Stížnost můžete podat u Úřadu pro ochranu osobních údajů (<a href="https://uoou.gov.cz" target="_blank" rel="noreferrer">uoou.gov.cz</a>).</p>
      </Prose>
    </PublicShell>
  );
}
