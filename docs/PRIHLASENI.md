# Přihlášení přes Google a Apple

Tlačítka „Pokračovat přes Google / Apple“ se ukážou, když ve Vercelu nastavíte
`NEXT_PUBLIC_OAUTH_PROVIDERS=google,apple` (nebo jen `google`) a poskytovatele zapnete v Supabase.
Callback adresa pro oba: `https://dlggrvqamwcxcthzuctn.supabase.co/auth/v1/callback`.

## Google (zdarma, ~10 minut)
1. console.cloud.google.com → nový projekt → APIs & Services → OAuth consent screen (External, název HomeOS, e-mail, odkaz na /soukromi a /podminky).
2. Credentials → Create credentials → OAuth client ID → Web application.
   Authorized redirect URI = callback adresa výše.
3. Client ID a Client secret vložte do Supabase → Authentication → Sign In / Providers → Google → Enable.
4. Ve Vercelu přidejte `NEXT_PUBLIC_OAUTH_PROVIDERS=google` a udělejte Redeploy.

## Apple (vyžaduje Apple Developer Program, 99 USD/rok)
1. developer.apple.com → Identifiers → App ID s „Sign in with Apple“ a Services ID (např. `cz.homeos.web`),
   u Services ID nastavte doménu a Return URL = callback adresa výše.
2. Keys → nový klíč se „Sign in with Apple“ (stáhněte .p8).
3. Supabase → Providers → Apple: Services ID, Team ID, Key ID a obsah .p8 (Supabase z nich vygeneruje secret).
4. Do `NEXT_PUBLIC_OAUTH_PROVIDERS` přidejte `apple` a Redeploy.

Pozn.: uživatel přihlášený přes Google/Apple nemá heslo. Citlivé akce (reset, smazání účtu, vypnutí 2FA)
potvrzuje heslem – nastaví si ho v Nastavení → Účet → Nové heslo.
