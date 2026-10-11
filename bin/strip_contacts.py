#!/usr/bin/env python3
"""Strip personal contact data from the published copy of the rental-ads database.

Run after every copy of `database/` over `assets/database/` (see
assets/database/README.md, sections 7-8). Safe to re-run: it is idempotent.

What it removes:
  * ad.json   -> contact.name, contact.phones, source_file (path on the PC);
                 for private owners also office_url / all_ads_url
  * index.json / index.csv -> seller_name of private owners (it is their name)
  * phone numbers written inside titles and descriptions -> "[telefon gizlendi]"
  * commute_cache.json (internal cache, not meant to be published)

Agency office names, licence numbers, the sahibinden message link and
source_url ("İlanı aç") are kept.

Usage:
  python bin/strip_contacts.py                # default: assets/database next to this repo
  python bin/strip_contacts.py path/to/database --dry-run
  python bin/strip_contacts.py --check        # exit 1 if anything is left to strip (hooks / CI)
  python bin/strip_contacts.py --prune        # also delete folders of ads no longer in index.json

Normally you don't run this by hand: bin/update_database.py calls it, the
pre-commit hook (.githooks/pre-commit) re-runs it, and the deploy workflow
strips again before building.
"""

import argparse
import csv
import json
import re
import shutil
import sys
from pathlib import Path

PHONE_RE = re.compile(
    r"(?<!\d)(?:\+?90[ .\-]?)?(?:0[ .\-]?)?\(?0?[2-5]\d{2}\)?"
    r"[ .\-]{0,2}\d{3}[ .\-]{0,2}\d{2}[ .\-]{0,2}\d{2}(?!\d)"
)
PHONE_MASK = "[telefon gizlendi]"
OWNER_ONLY_FIELDS = ("office_url", "all_ads_url")


def redact(text):
    """Return (text with phone numbers masked, number of matches)."""
    if not isinstance(text, str):
        return text, 0
    return PHONE_RE.subn(PHONE_MASK, text)


def write_json(path, data, dry_run):
    if not dry_run:
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def strip_ad(ad):
    """Clean one ad.json record in place. Returns number of changed values."""
    changed = 0
    contact = ad.get("contact") or {}
    keys = ["name", "phones"]
    if contact.get("seller_type") == "individual":
        keys += OWNER_ONLY_FIELDS
    for key in keys:
        if contact.get(key) is not None:
            contact[key] = None
            changed += 1
    if ad.get("source_file") is not None:
        ad["source_file"] = None
        changed += 1
    ad["title"], n = redact(ad.get("title"))
    changed += n
    detail = ad.get("classified_detail") or {}
    detail["description"], n = redact(detail.get("description"))
    changed += n
    return changed


def strip_row(row):
    """Clean one index row (dict) in place. Returns number of changed values."""
    changed = 0
    if row.get("seller_type") == "individual" and row.get("seller_name"):
        row["seller_name"] = None
        changed += 1
    row["title"], n = redact(row.get("title"))
    return changed + n


def prune_orphans(db, dry_run=False):
    """Delete ad folders that index.json no longer lists (left over after copying a newer
    database over the old one by hand). Returns the removed ids."""
    db = Path(db)
    ids = {a["id"] for a in json.loads((db / "index.json").read_text(encoding="utf-8"))["ads"]}
    orphans = sorted(p for p in db.iterdir() if p.is_dir() and p.name.isdigit() and p.name not in ids)
    if not dry_run:
        for p in orphans:
            shutil.rmtree(p)
    return [p.name for p in orphans]


def strip_database(db, dry_run=False, quiet=False):
    """Clean a database folder in place. Returns the number of changes (0 = already clean)."""
    db = Path(db)
    if not (db / "index.json").is_file():
        sys.exit(f"index.json not found in {db}")

    ads_changed = values_changed = 0
    for path in sorted(db.glob("*/ad.json")):
        ad = json.loads(path.read_text(encoding="utf-8"))
        n = strip_ad(ad)
        if n:
            ads_changed += 1
            values_changed += n
            write_json(path, ad, dry_run)

    index_path = db / "index.json"
    index = json.loads(index_path.read_text(encoding="utf-8"))
    index_changed = sum(strip_row(row) for row in index["ads"])
    if index_changed:
        write_json(index_path, index, dry_run)

    csv_changed = 0
    csv_path = db / "index.csv"
    if csv_path.is_file():
        with csv_path.open(encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            fields, rows = reader.fieldnames, list(reader)
        for row in rows:
            if row.get("seller_type") == "individual" and row.get("seller_name"):
                row["seller_name"] = ""
                csv_changed += 1
            row["title"], n = redact(row.get("title"))
            csv_changed += n
        if csv_changed and not dry_run:
            with csv_path.open("w", encoding="utf-8-sig", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=fields)
                writer.writeheader()
                writer.writerows(rows)

    cache = db / "commute_cache.json"
    cache_removed = cache.is_file()
    if cache_removed and not dry_run:
        cache.unlink()

    if not quiet:
        prefix = "[dry-run] " if dry_run else ""
        print(f"{prefix}ad.json: {values_changed} values cleaned in {ads_changed} ads")
        print(f"{prefix}index.json: {index_changed} values cleaned; index.csv: {csv_changed}")
        print(f"{prefix}commute_cache.json: {'removed' if cache_removed else 'not present'}")
    return values_changed + index_changed + csv_changed + int(cache_removed)


def main():
    repo = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("database", nargs="?", default=repo / "assets" / "database", type=Path)
    parser.add_argument("--dry-run", action="store_true", help="report what would change, write nothing")
    parser.add_argument("--check", action="store_true", help="write nothing; exit 1 if contact data is present")
    parser.add_argument("--prune", action="store_true", help="also delete ad folders not listed in index.json")
    args = parser.parse_args()
    dry_run = args.dry_run or args.check
    changes = strip_database(args.database, dry_run=dry_run)
    if args.prune:
        removed = prune_orphans(args.database, dry_run=dry_run)
        if removed:
            print(f"{'[dry-run] ' if dry_run else ''}ad folders not in index.json removed: {', '.join(removed)}")
        changes += len(removed)
    if args.check and changes:
        print("assets/database needs cleaning: run python bin/strip_contacts.py --prune", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
