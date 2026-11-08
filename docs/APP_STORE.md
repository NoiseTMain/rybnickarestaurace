# HomeOS v App Store a Google Play

HomeOS je webová aplikace (Next.js se serverem), proto se do obchodů balí jako **nativní obal**
(Capacitor), který načítá produkční web. Konfigurace je připravená v `capacitor.config.json`
(aplikace se v prohlížeči hlásí jako `HomeOSApp` – podle toho skrývá nákup Premium, viz níže).

## Rychlá cesta: Android přes TWA (doporučeno jako první)
Trusted Web Activity zabalí PWA (manifest, ikony, offline už HomeOS má):
1. `npx @bubblewrap/cli init --manifest https://VAŠE-DOMÉNA/manifest.webmanifest`
2. `npx @bubblewrap/cli build` → soubor `.aab`
3. Do `public/.well-known/assetlinks.json` vložte otisk podpisového klíče (Bubblewrap ho vypíše) – jinak se zobrazí lišta prohlížeče.
4. Google Play Console (jednorázově 25 USD) → nová aplikace → nahrát `.aab`, vyplnit Data safety (finanční údaje, účet, žádný prodej dat), obsah pro věk, zásady ochrany soukromí (`/soukromi`).

## iOS (a Android) přes Capacitor
Potřebujete Mac s Xcode a Apple Developer Program (99 USD/rok).
```bash
npm i -D @capacitor/cli && npm i @capacitor/core @capacitor/ios @capacitor/android
npx cap add ios && npx cap add android
npx cap open ios   # v Xcode: Signing, ikony (public/icon-512.png), Build → Archive → App Store Connect
```
Doporučené nativní doplňky (Apple u „jen obalených webů“ často odmítá podle pravidla 4.2 –
nativní funkce šanci na schválení výrazně zvyšují): `@capacitor/push-notifications`
(upozornění na platby a termíny), biometrické odemčení (Face ID), `@capacitor/share`, `@capacitor/camera` (účtenky).

## ⚠️ Platby za Premium v aplikaci
- **Apple (3.1.1)** a **Google Play (Payments policy)** vyžadují, aby se digitální předplatné
  prodávané *v aplikaci* platilo přes jejich systém (provize 15–30 %). Lemon Squeezy v aplikaci použít nelze.
- HomeOS proto v nativní aplikaci (`HomeOSApp` v user-agentu) **nákup ani odkaz na platbu nezobrazuje** –
  uživatel si Premium aktivuje na webu a v aplikaci se mu jen projeví („reader“ přístup).
  Pravidla pro odkazy ven se liší podle regionu (EU – DMA, USA) a mění se; před odesláním je ověřte.
- Chcete-li prodávat i přímo v aplikaci, je potřeba doplnit In-App Purchase (např. RevenueCat)
  a webhook, který zapíše předplatné do tabulky `subscriptions` stejně jako Lemon Squeezy.

## Co připravit do obchodů
- Název, popis, klíčová slova (CZ/SK/EN), snímky obrazovky (iPhone 6,7", 6,5", iPad; Android telefon).
- Odkazy: podpora (e-mail), zásady ochrany soukromí `/soukromi`, podmínky `/podminky`.
- Smazání účtu přímo v aplikaci – **splněno** (Nastavení → Účet → Smazat účet).
- Testovací účet pro recenzenty (demo domácnost) a poznámka, že AI odpovědi počítá z dat uživatele.
