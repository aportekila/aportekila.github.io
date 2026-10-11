#!/usr/bin/env python3
"""Replace assets/database with a fresh copy of the extractor's database/ folder.

One command after every `python extract_ads.py` run:

  python bin/update_database.py "C:/path/to/database"
  python bin/update_database.py            # reuses the last source path

What it does:
  1. copies the source into a temporary folder next to assets/database
     (commute_cache.json is never copied),
  2. strips contact data there (bin/strip_contacts.py), so raw names and phone
     numbers never land in assets/database,
  3. mirrors it into assets/database (ads removed from the source disappear too;
     the folder itself is never renamed, which Windows often refuses while an
     editor or antivirus is watching it),
  4. prints which ads are new and which are gone.

assets/notes.json is not touched: new ads get default notes automatically.
The last source path is remembered in .git/house-db-source (never committed).
"""

import argparse
import json
import shutil
import stat
import sys
import time
from pathlib import Path

from strip_contacts import strip_database

REPO = Path(__file__).resolve().parent.parent
DEST = REPO / "assets" / "database"
LAST_SOURCE = REPO / ".git" / "house-db-source"


def ad_titles(db):
    index = db / "index.json"
    if not index.is_file():
        return {}
    return {a["id"]: a.get("title") or "" for a in json.loads(index.read_text(encoding="utf-8"))["ads"]}


def remove(path):
    """Delete a file or folder, retrying briefly (Windows may hold files open for a moment)."""
    def on_error(func, p, _):
        Path(p).chmod(stat.S_IWRITE)
        func(p)
    for attempt in range(5):
        try:
            if path.is_dir():
                shutil.rmtree(path, onerror=on_error)
            elif path.exists():
                path.unlink()
            return
        except OSError:
            if attempt == 4:
                raise
            time.sleep(0.5)


def mirror(src, dest):
    """Make dest identical to src: drop what src doesn't have, copy everything else over."""
    dest.mkdir(parents=True, exist_ok=True)
    wanted = {p.name for p in src.iterdir()}
    for p in dest.iterdir():
        if p.name not in wanted:
            remove(p)
    for p in src.iterdir():
        if p.is_dir():
            sub = dest / p.name
            if sub.is_file():
                remove(sub)
            mirror(p, sub)
        else:
            if (dest / p.name).is_dir():
                remove(dest / p.name)
            shutil.copy2(p, dest / p.name)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("source", nargs="?", type=Path, help="the extractor's database/ folder")
    args = parser.parse_args()

    source = args.source
    if source is None and LAST_SOURCE.is_file():
        source = Path(LAST_SOURCE.read_text(encoding="utf-8").strip())
    if source is None:
        sys.exit("Give the path of the extractor's database/ folder (it is remembered afterwards).")
    source = source.resolve()
    if not (source / "index.json").is_file():
        sys.exit(f"index.json not found in {source}")
    if source == DEST.resolve():
        sys.exit("Source is assets/database itself; point it at the extractor's output folder.")

    before = ad_titles(DEST)
    tmp = DEST.with_name(DEST.name + ".incoming")
    remove(tmp)

    shutil.copytree(source, tmp, ignore=shutil.ignore_patterns("commute_cache.json", "__pycache__"))
    strip_database(tmp, quiet=True)
    if strip_database(tmp, dry_run=True, quiet=True):
        remove(tmp)
        sys.exit("Stripping did not converge; assets/database left unchanged.")

    # Only stripped data reaches assets/database. If this is interrupted, just run it again.
    mirror(tmp, DEST)
    remove(tmp)
    if LAST_SOURCE.parent.is_dir():
        LAST_SOURCE.write_text(str(source), encoding="utf-8")

    after = ad_titles(DEST)
    added = sorted(set(after) - set(before))
    removed = sorted(set(before) - set(after))
    print(f"assets/database updated from {source}: {len(after)} ads, contact data stripped.")
    for label, ids, titles in (("New", added, after), ("Removed", removed, before)):
        print(f"{label}: {len(ids)}")
        for i in ids:
            print(f"  {i}  {titles[i]}")
    print("Next: git add assets/database && git commit && git push")


if __name__ == "__main__":
    main()
