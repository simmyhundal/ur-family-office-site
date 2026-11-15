#!/usr/bin/env python3
"""Stamp every local asset URL of the built site with a content-based build id: ``style.css`` -> ``style.css?v=<id>``.

Why (issue 238): GitHub Pages serves every file with ``max-age=600``. With fixed file names a browser can pair a
fresh page with ten-minute-old cached scripts. A URL that changes whenever any file changes cannot be mixed up.

Usage: ``python scripts/version_site_assets.py SITE_DIR [--out DEST]`` (in place, or into a fresh copy at DEST).
Run it on the deployed copy only (after prices.json exists); the sources in ``site/`` stay unversioned.

The id is the first 10 hex characters of one sha256 over every file in the tree (with existing ``?v=`` stamps
removed first, so a second run changes nothing). One id per deploy keeps module graphs consistent: a changed
``calc.mjs`` changes the URL of every importer too. Stamped:
  * HTML: ``href`` of <link>, ``src`` of <script> and <img>, when they name a file inside the tree;
  * .js/.mjs: string literals that are relative paths (``./x.mjs``, ``../data/site.json``) to a file in the tree,
    which covers static ``import ... from``, ``export ... from``, ``import()`` and ``new URL(..., import.meta.url)``.
Dynamic URLs are not rewritten here; ``data.mjs`` copies its own ``?v=`` onto the data files it fetches.
External URLs are never touched. No dependencies.
"""
from __future__ import annotations

import argparse
import hashlib
import re
import shutil
import sys
from pathlib import Path, PurePosixPath

STAMP = re.compile(r"\?v=[0-9a-f]{10}(?=$|[\"'#&)\s])")
TEXT = {".html", ".js", ".mjs", ".css"}
TAG = re.compile(r"<(?:link|script|img)\b[^>]*>", re.I)
ATTR = re.compile(r"""(\b(?:href|src)\s*=\s*)(["'])(.*?)\2""", re.I)
JS_PATH = re.compile(r"""(["'])(\.{1,2}/[^"'\n?#]*)(?:\?v=[0-9a-f]{10})?\1""")
EXTERNAL = re.compile(r"^(?:[a-z][a-z0-9+.-]*:|//|#)", re.I)


def _files(root: Path) -> list[Path]:
    return sorted(p for p in root.rglob("*") if p.is_file())


def build_id(root: Path) -> str:
    h = hashlib.sha256()
    for p in _files(root):
        data = p.read_bytes()
        if p.suffix in TEXT:
            data = STAMP.sub("", data.decode("utf-8")).encode("utf-8")
        h.update(p.relative_to(root).as_posix().encode() + b"\0" + data + b"\0")
    return h.hexdigest()[:10]


def _local_file(root: Path, page: Path, ref: str) -> bool:
    """True when ``ref`` (a URL as written in ``page``) names an existing file inside ``root``."""
    if not ref or EXTERNAL.match(ref):
        return False
    path = ref.split("#")[0].split("?")[0]
    base = PurePosixPath(page.relative_to(root).parent.as_posix())
    parts: list[str] = []
    for seg in (base / path).parts if not path.startswith("/") else PurePosixPath(path[1:]).parts:
        if seg == "..":
            if not parts:
                return False
            parts.pop()
        elif seg not in (".", ""):
            parts.append(seg)
    return bool(parts) and (root / Path(*parts)).is_file()


def _stamp(ref: str, vid: str) -> str:
    path, hashpart = (ref.split("#", 1) + [None])[:2]
    path = STAMP.sub("", path)
    return path + "?v=" + vid + ("#" + hashpart if hashpart is not None else "")


def rewrite_html(root: Path, page: Path, text: str, vid: str) -> str:
    def attr(m: re.Match) -> str:
        pre, q, ref = m.groups()
        clean = STAMP.sub("", ref)
        return f"{pre}{q}{_stamp(ref, vid)}{q}" if _local_file(root, page, clean) else m.group(0)
    return TAG.sub(lambda t: ATTR.sub(attr, t.group(0)), text)


def rewrite_js(root: Path, page: Path, text: str, vid: str) -> str:
    def lit(m: re.Match) -> str:
        q, ref = m.groups()
        return f"{q}{ref}?v={vid}{q}" if _local_file(root, page, ref) else m.group(0)
    return JS_PATH.sub(lit, text)


def version_tree(root: Path) -> str:
    vid = build_id(root)
    for p in _files(root):
        if p.suffix == ".html":
            fn = rewrite_html
        elif p.suffix in (".js", ".mjs"):
            fn = rewrite_js
        else:
            continue
        old = p.read_text(encoding="utf-8")
        new = fn(root, p, old, vid)
        # a re-run after the tree changed must replace the stamps, not stack them
        if new != old:
            p.write_text(new, encoding="utf-8")
    return vid


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("site_dir", type=Path)
    ap.add_argument("--out", type=Path, help="copy the site here first and leave site_dir untouched")
    a = ap.parse_args(argv)
    root = a.site_dir
    if a.out:
        if a.out.exists():
            shutil.rmtree(a.out)
        shutil.copytree(root, a.out)
        root = a.out
    if not root.is_dir():
        print(f"not a directory: {root}", file=sys.stderr)
        return 2
    print("asset version", version_tree(root))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
