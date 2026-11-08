#!/usr/bin/env python3
"""Sestaví slovníky src/lib/i18n/phrases/{sk,en}.json z extrahovaných českých textů (items.json)
a překladů (translations.tsv: index<TAB>sk<TAB>en, „=“ = stejné jako česky) + ručních doplňků."""
import json, re, pathlib, sys
here = pathlib.Path(__file__).parent
items = json.loads((here / "items.json").read_text()) if (here / "items.json").exists() else []
sk, en = {}, {}
for line in (here / "translations.tsv").read_text().splitlines():
    if not line.strip(): continue
    parts = line.split("\t")
    if len(parts) != 3: print("ŠPATNÝ ŘÁDEK:", line[:80]); continue
    src, s, e = parts[0].replace("\\n", "\n"), parts[1], parts[2]
    for d, v in ((sk, s), (en, e)):
        if v != "=": d[src] = v
MONTHS = ["leden","únor","březen","duben","květen","červen","červenec","srpen","září","říjen","listopad","prosinec"]
MONTHS_GEN = ["ledna","února","března","dubna","května","června","července","srpna","září","října","listopadu","prosince"]
SK_M = ["január","február","marec","apríl","máj","jún","júl","august","september","október","november","december"]
SK_MG = ["januára","februára","marca","apríla","mája","júna","júla","augusta","septembra","októbra","novembra","decembra"]
EN_M = ["January","February","March","April","May","June","July","August","September","October","November","December"]
for m, mg, s, sg, e in zip(MONTHS, MONTHS_GEN, SK_M, SK_MG, EN_M):
    for cz, skv, env in ((m, s, e), (m.capitalize(), s.capitalize(), e), (mg, sg, e)):
        sk[cz] = skv; en[cz] = env
        sk[cz + " {0}"] = skv + " {0}"; en[cz + " {0}"] = env + " {0}"
SHORT = ["led","úno","bře","dub","kvě","čvn","čvc","srp","zář","říj","lis","pro"]
SK_S = ["jan","feb","mar","apr","máj","jún","júl","aug","sep","okt","nov","dec"]
EN_S = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
for c, s_, e in zip(SHORT, SK_S, EN_S):
    sk[c + " {0:n}"] = s_ + " {0}"; en[c + " {0:n}"] = e + " {0}"
for mg, sg, e in zip(MONTHS_GEN, SK_MG, EN_M):
    sk["{0:n}. " + mg + " {1:n}"] = "{0}. " + sg + " {1}"; en["{0:n}. " + mg + " {1:n}"] = "{0} " + e + " {1}"
DAYS = [("po","po","Mon"),("út","ut","Tue"),("st","st","Wed"),("čt","št","Thu"),("pá","pi","Fri"),("so","so","Sat"),("ne","ne","Sun"),
        ("pondělí","pondelok","Monday"),("úterý","utorok","Tuesday"),("středa","streda","Wednesday"),("čtvrtek","štvrtok","Thursday"),("pátek","piatok","Friday"),("sobota","sobota","Saturday"),("neděle","nedeľa","Sunday")]
for cz, s, e in DAYS:
    if cz != s: sk[cz] = s
    en[cz] = e
    if len(cz) <= 2:
        sk[cz + " {0:d}"] = s + " {0}"; en[cz + " {0:d}"] = e + " {0}"
EXTRA = {  # krátká slova bez diakritiky, která extrakce vynechává
  "den": ("deň", "day"), "dny": ("dni", "days"),
  "{0} chystaná cesta": ("{0} chystaná cesta", "{0} upcoming trip"), "{0} chystané cesty": ("{0} chystané cesty", "{0} upcoming trips"), "{0} chystaných cest": ("{0} chystaných ciest", "{0} upcoming trips"),
  "{0} z {1}": ("{0} z {1}", "{0} of {1}"), "{0} – {1}": ("{0} – {1}", "{0} – {1}"), "· {0} dní": ("· {0} dní", "· {0} days"), "{0} {1}, průměrně {2} za nákup": ("{0} {1}, priemerne {2} za nákup", "{0} {1}, on average {2} per shop"),
  "Upravit pravidelný příjem": ("Upraviť pravidelný príjem", "Edit regular income"), "Upravit člena": ("Upraviť člena", "Edit member"), "Upravit účet": ("Upraviť účet", "Edit account"), "Nový pravidelný příjem": ("Nový pravidelný príjem", "New regular income"), "Nový člen": ("Nový člen", "New member"), "Nový účet": ("Nový účet", "New account"),
  "získáno": ("získané", "earned"), "variant": ("variantov", "variants"), "Příloha k jídlu": ("Príloha", "Side"), "Spustit průvodce znovu": ("Spustiť sprievodcu znova", "Restart the tour"), "(spoření)": ("(sporenie)", "(savings)"), "/měs., zdravotní": ("/mes., zdravotné", "/mo., health"),
  "vyčleněno na běžném účtu": ("vyčlenené na bežnom účte", "set aside on the current account"), "dny": ("dni", "days"), "dní": ("dní", "days"), "/měs.": ("/mes.", "/mo."), "ks": ("ks", "pcs"), "dnes": ("dnes", "today"), "zítra": ("zajtra", "tomorrow"), "včera": ("včera", "yesterday"),
  "Domov": ("Domov", "Home"), "Odhad": ("Odhad", "Estimate"),
}
for cz, (s, e) in EXTRA.items():
    if cz != s: sk[cz] = s
    en[cz] = e
def norm(d):
    out = {"exact": {}, "patterns": []}
    bad = 0
    for k, v in d.items():
        k2, v2 = k.strip(), v.strip()
        if not k2 or k2 == v2: continue
        ph_k, ph_v = sorted(set(re.findall(r"\{(\d+)(?::[dn])?\}", k2))), sorted(set(re.findall(r"\{(\d+)(?::[dn])?\}", v2)))
        if ph_k != ph_v: print("NESEDÍ ZÁSTUPCI:", k2[:60], "→", v2[:60]); bad += 1; continue
        if ph_k: out["patterns"].append([k2, v2])
        else: out["exact"][k2] = v2
    out["patterns"].sort(key=lambda p: -len(p[0]))
    return out, bad
total_bad = 0
for name, d in (("sk", sk), ("en", en)):
    o, bad = norm(d); total_bad += bad
    p = here.parent.parent / "src/lib/i18n/phrases" / f"{name}.json"
    p.write_text(json.dumps(o, ensure_ascii=False, separators=(",", ":")))
    print(name, "exact", len(o["exact"]), "patterns", len(o["patterns"]), "bytes", p.stat().st_size)
translated = {l.split("\t")[0].replace("\\n", "\n") for l in (here / "translations.tsv").read_text().splitlines() if l.strip()}
missing = [x for x in items if x.strip() not in translated]
(here / "missing.txt").write_text("\n".join(x.strip().replace("\n", "\\n") for x in missing))
print("bez překladu:", len(missing), "(scripts/i18n/missing.txt)")
sys.exit(1 if total_bad else 0)
