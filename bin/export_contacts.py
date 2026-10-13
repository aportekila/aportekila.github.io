#!/usr/bin/env python3
"""Write assets/house-renting/contacts.json (names + phone numbers per ad) for the visit planner.

assets/database stays stripped (bin/strip_contacts.py); the contacts come from the
extractor's raw database/ folder and live only in this one file.

  python bin/export_contacts.py "C:/path/to/raw/database"
  python bin/export_contacts.py            # reuses the last source (.git/house-db-source)
"""

import argparse
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "assets" / "house-renting" / "contacts.json"
LAST_SOURCE = REPO / ".git" / "house-db-source"


def tel(number):
    """'0 (532) 224 52 84' -> '+905322245284' (None if it doesn't look like a TR number)."""
    digits = re.sub(r"\D", "", number or "")
    if digits.startswith("90") and len(digits) == 12:
        digits = digits[2:]
    if digits.startswith("0"):
        digits = digits[1:]
    return "+90" + digits if len(digits) == 10 else None


def export(source):
    source = Path(source)
    if not (source / "index.json").is_file():
        sys.exit(f"index.json not found in {source}")
    contacts = {}
    for path in sorted(source.glob("*/ad.json")):
        ad = json.loads(path.read_text(encoding="utf-8"))
        c = ad.get("contact") or {}
        phones = [
            {"label": p.get("label") or "", "number": p.get("number") or "", "tel": tel(p.get("number"))}
            for p in (c.get("phones") or [])
            if p.get("number")
        ]
        contacts[str(ad["id"])] = {
            "name": c.get("name"),
            "office": c.get("office_name"),
            "type": c.get("seller_type"),
            "phones": phones,
            "message_url": c.get("message_url"),
        }
    OUT.write_text(json.dumps({"source": "sahibinden.com ilanları", "contacts": contacts}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    n = sum(1 for c in contacts.values() if c["phones"])
    print(f"contacts.json: {len(contacts)} ads, {n} with phone numbers -> {OUT.relative_to(REPO)}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("source", nargs="?", type=Path)
    args = parser.parse_args()
    source = args.source
    if source is None and LAST_SOURCE.is_file():
        source = Path(LAST_SOURCE.read_text(encoding="utf-8").strip())
    if source is None:
        sys.exit("Give the extractor's raw database/ folder (it is remembered afterwards).")
    export(source)
    if LAST_SOURCE.parent.is_dir():
        LAST_SOURCE.write_text(str(Path(source).resolve()), encoding="utf-8")


if __name__ == "__main__":
    main()
