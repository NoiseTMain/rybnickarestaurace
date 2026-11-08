#!/usr/bin/env bash
# Vytáhne české texty z kódu → scripts/i18n/items.json (pak: python3 scripts/i18n/build.py)
set -euo pipefail
cd "$(dirname "$0")/../.."
node scripts/i18n/extract.cjs scripts/i18n/.raw.json
python3 - <<'PY'
import json, re
d = json.load(open("scripts/i18n/.raw.json"))
drop = re.compile(r"^\(\?|^\(-?d|<a href|HomeOS/1\.0|^%s|^\d+px|^(from|via|to)-|opacity-|animate-|line-through|^(linear|radial|repeating-linear)-gradient|^blur\(|system-ui|Mozilla/")
items = sorted({x.strip() for x in d["exact"] + d["patterns"] if x.strip() and not drop.search(x.strip())})
json.dump(items, open("scripts/i18n/items.json", "w"), ensure_ascii=False, indent=0)
print("items", len(items))
PY
rm -f scripts/i18n/.raw.json
