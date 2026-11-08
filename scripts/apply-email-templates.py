#!/usr/bin/env python3
"""Nahraje české e-mailové šablony (supabase/email/*.html) do Supabase Auth.
Funguje až po nastavení vlastního SMTP (Supabase to jinak nedovolí).
Použití: SUPABASE_ACCESS_TOKEN=… SUPABASE_PROJECT_REF=… python3 scripts/apply-email-templates.py"""
import json, os, pathlib, urllib.request
SUBJ = {"confirmation": "Potvrďte svůj e-mail – HomeOS", "recovery": "Obnova hesla – HomeOS", "magic_link": "Přihlašovací odkaz – HomeOS", "email_change": "Potvrďte nový e-mail – HomeOS", "invite": "Pozvánka do HomeOS"}
root = pathlib.Path(__file__).resolve().parent.parent / "supabase" / "email"
body = {"mailer_subjects_reauthentication": "{{ .Token }} je váš ověřovací kód HomeOS"}
for k, s in SUBJ.items():
    body[f"mailer_subjects_{k}"] = s
    body[f"mailer_templates_{k}_content"] = (root / f"{k}.html").read_text()
req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{os.environ['SUPABASE_PROJECT_REF']}/config/auth", data=json.dumps(body).encode(), method="PATCH",
                             headers={"Authorization": f"Bearer {os.environ['SUPABASE_ACCESS_TOKEN']}", "Content-Type": "application/json"})
print(json.load(urllib.request.urlopen(req)).get("mailer_subjects_recovery"))
