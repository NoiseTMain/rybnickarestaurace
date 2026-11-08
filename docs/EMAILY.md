# E-maily (potvrzení registrace, obnova hesla)

Supabase bez vlastního SMTP posílá e-maily jen členům týmu projektu a nejvýš ~2 za hodinu,
proto je teď **zapnuté automatické potvrzení účtu** (`mailer_autoconfirm`) a obnova hesla e-mailem
veřejným uživatelům nedojde.

## Zapnutí (cca 15 minut)
1. Založte účet na [resend.com](https://resend.com) (zdarma 3 000 e-mailů/měsíc), přidejte doménu a ověřte DNS záznamy.
2. Resend → API Keys → vytvořte klíč (SMTP heslo).
3. Supabase → Authentication → Emails → SMTP Settings → Enable custom SMTP:
   host `smtp.resend.com`, port `465`, user `resend`, heslo = klíč z Resendu, odesílatel např. `HomeOS <noreply@vase-domena.cz>`.
4. Nahrajte české šablony: `SUPABASE_ACCESS_TOKEN=… SUPABASE_PROJECT_REF=dlggrvqamwcxcthzuctn python3 scripts/apply-email-templates.py`
   (nebo je zkopírujte ručně ze složky `supabase/email/`).
5. Authentication → Sign In / Providers → Email → zapněte **Confirm email** (vypne automatické potvrzení).

Šablony vedou na `/auth/confirm?token_hash=…&type=…`, který už aplikace zpracovává
(potvrzení registrace, obnova hesla → Nastavení › Účet).
