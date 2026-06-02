#!/usr/bin/env python3
"""
Regenerates _data/bib_meta.yml from _bibliography/papers.bib.

Run manually or via pre-commit / CI whenever papers.bib changes:
    python3 _scripts/gen_bib_meta.py
"""

import os
import sys

try:
    import bibtexparser
    import yaml
except ImportError:
    print("Missing dependencies. Run: pip install bibtexparser pyyaml", file=sys.stderr)
    sys.exit(1)

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BIB_PATH = os.path.join(REPO_ROOT, "_bibliography", "papers.bib")
OUT_PATH = os.path.join(REPO_ROOT, "_data", "bib_meta.yml")

FIELDS = ["url", "html", "arxiv", "code", "video", "google_scholar_id", "project"]

with open(BIB_PATH) as f:
    db = bibtexparser.load(f)

result = {}
for entry in db.entries:
    key = entry.get("ID", "").strip()
    if not key:
        continue
    row = {field: entry[field].strip() for field in FIELDS if entry.get(field, "").strip()}
    if row:
        result[key] = row

with open(OUT_PATH, "w") as f:
    yaml.dump(result, f, default_flow_style=False, allow_unicode=True, sort_keys=True)

print(f"bib_meta.yml updated — {len(result)} entries written.")
