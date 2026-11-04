#!/opt/homebrew/bin/python3
"""リリースノートの原稿（日本語の md）から、サイトの記事を作る。

    release_note.py build <原稿.md>            記事データ・4言語のページ・画像と動画を作る
    release_note.py import <id> --out <原稿.md> 既存の記事を原稿と訳に起こす（作り直しの確かめ用）

原稿の書き方は同じフォルダの FORMAT.md。
訳（英・韓・中）は _releases_src/<id>/tr.yml に置く。Claude が書き、川口さんは直さない。
訳には訳したときの日本語（src）を一緒に持たせ、原稿の日本語が変わった所は TODO に戻して build を止める。

終了コード: 0 = 作れた / 2 = 訳が足りない（tr.yml の TODO を埋めてからもう一度） / 1 = 原稿の誤り
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

import yaml

SITE = Path(__file__).resolve().parents[2]
DATA = SITE / "_data" / "releases.yml"
SRC_DIR = SITE / "_releases_src"
MEDIA_DIR = SITE / "assets" / "release-media"
LANGS = ["en", "ko", "zh"]
PAGE_TITLE = {"ja": "リリースノート", "en": "Release notes", "ko": "릴리스 노트", "zh": "版本說明"}
PAGE_DIR = {"ja": SITE / "blog", "en": SITE / "en" / "blog", "ko": SITE / "ko" / "blog", "zh": SITE / "zh" / "blog"}
VIDEO_EXT = {".mp4", ".mov", ".m4v"}
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp"}
TODO = "TODO: "
HEADER_COMMENT = """<!-- 書き方: # 記事の題 / ## 節 / ### 項目（末尾の [IIDX] は機種の札。複数は [DDR, pop'n]）
     項目の下の文は説明、- で始まる行は箇条、![](ファイル名) はその項目の画像か動画（1項目に1つ）。
     ファイルはこのフォルダに置く。詳しくは alm4gest-site/_tools/release_note/FORMAT.md -->"""


class FormatError(Exception):
    pass


# ---------- 原稿（md）を読む ----------

def parse_md(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    meta: dict = {}
    m = re.match(r"\s*---\n(.*?)\n---\n", text, flags=re.S)
    if m:
        meta = yaml.safe_load(m.group(1)) or {}
        text = text[m.end():]
    folder = re.match(r"(\d{2})(\d{2})(\d{2})_", path.parent.name)
    rid = str(meta.get("id") or (f"20{folder.group(1)}-{folder.group(2)}-{folder.group(3)}" if folder else ""))
    for k, v in (("id", rid), ("version", meta.get("version")), ("date", meta.get("date"))):
        if not v:
            raise FormatError(f"冒頭の --- の中に {k} がありません")
    entry = {"id": rid, "kind": meta.get("kind", "release"), "version": str(meta["version"]),
             "date": str(meta["date"]), "title": None, "sections": []}
    item = None
    blank = False
    for no, raw in enumerate(text.splitlines(), 1):
        line = raw.strip()
        if not line:
            blank = True
            continue
        after_blank, blank = blank, False
        where = f"{path.name} {no}行目"
        if line.startswith("### "):
            if not entry["sections"]:
                raise FormatError(f"{where}: ### の前に ## の節がありません")
            title, games = line[4:].strip(), None
            g = re.match(r"(.*?)\s*\[([^\]]+)\]$", title)
            if g:
                title, games = g.group(1).strip(), [game_name(s, where) for s in g.group(2).split(",") if s.strip()]
            item = {"title": title}
            if games:
                item["games"] = games
            entry["sections"][-1]["items"].append(item)
        elif line.startswith("## "):
            entry["sections"].append({"heading": line[3:].strip(), "items": []})
            item = None
        elif line.startswith("# "):
            if entry["title"]:
                raise FormatError(f"{where}: # の題が2つあります")
            entry["title"] = line[2:].strip()
        elif item is None:
            raise FormatError(f"{where}: ### の項目の外に文があります: {line}")
        elif re.match(r"!\[[^\]]*\]\([^)]+\)$", line):
            if "media" in item:
                raise FormatError(f"{where}: 1項目に画像・動画は1つまでです")
            name, src = re.match(r"!\[([^\]]*)\]\(([^)]+)\)$", line).groups()
            item["media"] = {"name": name.strip(), "file": src.strip()}
        elif line.startswith("- ") or re.match(r"\d+\.\s", line):
            ordered = not line.startswith("- ")
            if "list" in item and item.get("ordered", False) != ordered:
                raise FormatError(f"{where}: 1項目の箇条は「- 」か「1. 」のどちらかに揃えてください")
            item.setdefault("list", []).append(re.sub(r"^(- |\d+\.\s+)", "", line).strip())
            if ordered:
                item["ordered"] = True
        else:
            d = item.get("desc", "")
            if d and after_blank:
                item["desc"] = d + "\n" + line  # 空行で区切った段落は、サイトでも段落を分ける
            else:
                item["desc"] = (d + line) if _cjk_join(d.rsplit("\n", 1)[-1], line) else (d + " " + line).strip()
    if not entry["title"]:
        raise FormatError("# の題がありません")
    for s in entry["sections"]:
        if not s["items"]:
            raise FormatError(f"節「{s['heading']}」に ### の項目がありません")
        for it in s["items"]:
            if "desc" not in it and "list" not in it:
                raise FormatError(f"項目「{it['title']}」に説明も箇条もありません")
    return entry


# 機種の札の名前。原稿の書き方の揺れ（POPN・ポップン など）をサイトの表記に揃える
GAMES = {"sdvx": "SDVX", "ddr": "DDR", "gitadora": "GITADORA", "gd": "GITADORA", "popn": "pop'n", "pop'n": "pop'n",
         "ポップン": "pop'n", "iidx": "IIDX", "jubeat": "jubeat"}


def game_name(s: str, where: str) -> str:
    k = s.strip().lower().replace("’", "'").replace(" music", "")
    if k not in GAMES:
        raise FormatError(f"{where}: 機種の札「{s.strip()}」が分かりません（使える名前: SDVX, DDR, GITADORA, pop'n, IIDX）")
    return GAMES[k]


def _cjk_join(a: str, b: str) -> bool:
    return not a or bool(re.match(r"[　-鿿＀-￯]", a[-1:])) or bool(re.match(r"[　-鿿＀-￯]", b[:1]))


# ---------- 画像と動画 ----------

def out_name(media: dict) -> str:
    """配信するファイルの名前。![名前](元ファイル) の名前を使い、無ければ元ファイル名の英数字をつなぐ。"""
    if media["name"]:
        return re.sub(r"\.[A-Za-z0-9]+$", "", media["name"])
    words = re.findall(r"[A-Za-z0-9]+", Path(media["file"]).stem)
    return "-".join(words).lower() if words else "m" + hashlib.sha1(media["file"].encode()).hexdigest()[:8]


def build_media(entry: dict, md_dir: Path, dry: bool) -> list[str]:
    """原稿の画像・動画を assets/release-media/<id>/ へ書き出し、記事データの media を作る。
    原稿のフォルダに元のファイルがあれば変換し、無ければ配信済みのファイルをそのまま使う。"""
    dest = MEDIA_DIR / entry["id"]
    log = []
    used: dict[str, str] = {}
    for s in entry["sections"]:
        for it in s["items"]:
            m = it.get("media")
            if not m:
                continue
            src = md_dir / m["file"]
            name = out_name(m)
            if used.get(name, m["file"]) != m["file"]:
                raise FormatError(f"{used[name]} と {m['file']} の配信名が同じ {name} になります。どちらかに ![名前](ファイル) で名前を付けてください")
            used[name] = m["file"]
            ext = Path(m["file"]).suffix.lower()
            if ext in VIDEO_EXT:
                it["media"] = {"type": "video", "src": f"{name}.mp4", "poster": f"{name}.jpg"}
            elif ext in IMAGE_EXT:
                it["media"] = {"type": "image", "src": f"{name}.jpg"}
            else:
                raise FormatError(f"画像・動画として扱えないファイルです: {m['file']}")
            targets = [dest / it["media"]["src"]] + ([dest / it["media"]["poster"]] if "poster" in it["media"] else [])
            if src.is_file():
                if not dry:
                    dest.mkdir(parents=True, exist_ok=True)
                    if ext in VIDEO_EXT:
                        _ffmpeg(["-i", str(src), "-vf", "scale=540:-2", "-c:v", "libx264", "-preset", "slow", "-crf", "27",
                                 "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", str(targets[0])])
                        _ffmpeg(["-i", str(targets[0]), "-frames:v", "1", "-q:v", "3", str(targets[1])])
                    else:
                        _ffmpeg(["-i", str(src), "-vf", "scale='min(720,iw)':-2", "-q:v", "3", str(targets[0])])
                log.append(f"変換 {m['file']} → {', '.join(t.name for t in targets)}")
            elif all(t.is_file() for t in targets):
                log.append(f"配信済みを使う {', '.join(t.name for t in targets)}")
            else:
                raise FormatError(f"{m['file']} が原稿のフォルダ（{md_dir}）にも配信済みの {dest} にもありません")
    return log


def _ffmpeg(args: list[str]) -> None:
    r = subprocess.run(["ffmpeg", "-y", "-v", "error", *args], capture_output=True, text=True)
    if r.returncode:
        raise FormatError("ffmpeg が失敗しました: " + r.stderr.strip())


# ---------- 訳 ----------

def text_leaves(lang_block: dict) -> list[str]:
    out = [lang_block["title"]]
    for s in lang_block["sections"]:
        out.append(s["heading"])
        for it in s["items"]:
            out.append(it["title"])
            if "desc" in it:
                out.append(it["desc"])
            out.extend(it.get("list", []))
    return out


def text_shape(entry: dict) -> dict:
    """記事の文だけを持つ形（訳を書く形）。"""
    return {"title": entry["title"], "sections": [
        {"heading": s["heading"], "items": [
            {k: it[k] for k in ("title", "desc", "list") if k in it} for it in s["items"]]}
        for s in entry["sections"]]}


def map_shape(shape: dict, fn) -> dict:
    return {"title": fn(shape["title"]), "sections": [
        {"heading": fn(s["heading"]), "items": [
            {k: ([fn(x) for x in v] if k == "list" else fn(v)) for k, v in it.items()} for it in s["items"]]}
        for s in shape["sections"]]}


def merge_translations(entry: dict) -> tuple[dict, int]:
    """tr.yml を今の日本語に合わせて作り直す。日本語が同じ文は前の訳を使い、変わった文は TODO にする。"""
    path = SRC_DIR / entry["id"] / "tr.yml"
    try:
        old = (yaml.safe_load(path.read_text(encoding="utf-8")) or {}) if path.is_file() else {}
    except yaml.YAMLError as e:
        raise FormatError(f"{path} を読めません（YAML の誤り）: {e}")
    ja = text_shape(entry)
    new = {"src": ja}
    todo = 0
    for lang in LANGS:
        table = {}
        if old.get("src") and old.get(lang):
            try:
                table = dict(zip(text_leaves(old["src"]), text_leaves(old[lang])))
            except (KeyError, TypeError):
                table = {}

        def pick(s, table=table):
            nonlocal todo
            v = table.get(s)
            if v is None or v.startswith(TODO):
                todo += 1
                return TODO + s
            return v
        new[lang] = map_shape(ja, pick)
    return new, todo


def write_tr(rid: str, tr: dict) -> Path:
    path = SRC_DIR / rid / "tr.yml"
    path.parent.mkdir(parents=True, exist_ok=True)
    head = ("# 英・韓・中の訳。Claude が書く（川口さんは直さない）。\n"
            "# src は訳したときの日本語。原稿の日本語が変わった文は build が TODO に戻す。\n"
            "# アプリの用語は konami_score_app/lib/l10n/app_*.arb に合わせる。\n")
    path.write_text(head + yaml.safe_dump({k: tr[k] for k in ["src", *LANGS]}, allow_unicode=True, sort_keys=False, width=1000),
                    encoding="utf-8")
    return path


# ---------- 記事データ（releases.yml）を書く ----------

def q(s: str) -> str:
    return json.dumps(s, ensure_ascii=False)


def flow_word(s: str) -> str:
    return s if re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9 _.-]*", s) else q(s)


def emit_entry(entry: dict, tr: dict) -> str:
    lines = [f'- id: {q(entry["id"])}', f'  kind: {entry["kind"]}', f'  version: {q(entry["version"])}', f'  date: {q(entry["date"])}']
    blocks = {"ja": text_shape(entry), **{l: tr[l] for l in LANGS}}
    for lang in ["ja", *LANGS]:
        b = blocks[lang]
        lines += [f"  {lang}:", f"    title: {q(b['title'])}", "    sections:"]
        for s, s_ja in zip(b["sections"], entry["sections"]):
            lines += [f"      - heading: {q(s['heading'])}", "        items:"]
            for it, it_ja in zip(s["items"], s_ja["items"]):
                lines.append(f"          - title: {q(it['title'])}")
                if it_ja.get("games"):
                    lines.append(f"            games: [{', '.join(flow_word(g) for g in it_ja['games'])}]")
                if "desc" in it:
                    lines.append(f"            desc: {q(it['desc'])}")
                if "list" in it:
                    lines.append("            list:")
                    lines += [f"              - {q(x)}" for x in it["list"]]
                    if it_ja.get("ordered"):
                        lines.append("            ordered: true")
                m = it_ja.get("media")
                if m:
                    lines.append("            media: {" + ", ".join(f"{k}: {m[k]}" for k in ("type", "src", "poster") if k in m) + "}")
    return "\n".join(lines) + "\n"


def replace_block(text: str, rid: str, block: str) -> str:
    starts = [(m.start(), m.group(1)) for m in re.finditer(r'^- id: "([^"]+)"', text, flags=re.M)]
    for i, (pos, cur) in enumerate(starts):
        end = starts[i + 1][0] if i + 1 < len(starts) else len(text)
        if cur == rid:
            return text[:pos] + block + text[end:]
    for pos, cur in starts:  # 新しい記事は id の新しい順の位置へ入れる
        if cur < rid:
            return text[:pos] + block + text[pos:]
    return text.rstrip("\n") + "\n" + block


def write_pages(entry: dict) -> list[Path]:
    out = []
    for lang, d in PAGE_DIR.items():
        p = d / f"{entry['id']}.md"
        p.write_text("---\n"
                     f'title: "{entry["version"]} {PAGE_TITLE[lang]}"\n'
                     "layout: release\n"
                     f"page_id: blog/{entry['id']}\n"
                     f'release_id: "{entry["id"]}"\n'
                     "---\n", encoding="utf-8")
        out.append(p)
    return out


# ---------- コマンド ----------

def cmd_build(md: Path) -> int:
    entry = parse_md(md)
    tr, todo = merge_translations(entry)
    trp = write_tr(entry["id"], tr)
    if todo:
        print(f"訳が {todo} 文足りません。{trp} の「{TODO.strip()}」を訳で埋めてから、もう一度 build してください。")
        return 2
    for lang in LANGS:
        if len(text_leaves(tr[lang])) != len(text_leaves(text_shape(entry))):
            raise FormatError(f"{lang} の訳の文の数が日本語と合いません")
    for line in build_media(entry, md.parent, dry=False):
        print(line)
    DATA.write_text(replace_block(DATA.read_text(encoding="utf-8"), entry["id"], emit_entry(entry, tr)), encoding="utf-8")
    pages = write_pages(entry)
    (SRC_DIR / entry["id"]).mkdir(parents=True, exist_ok=True)
    if md.resolve() != (SRC_DIR / entry["id"] / "ja.md").resolve():
        shutil.copyfile(md, SRC_DIR / entry["id"] / "ja.md")
    print(f"記事データ: {DATA.relative_to(SITE)}（id {entry['id']}）")
    print("ページ: " + " ".join(str(p.relative_to(SITE)) for p in pages))
    print(f"原稿の写し: {(SRC_DIR / entry['id'] / 'ja.md').relative_to(SITE)}")
    return 0


def cmd_import(rid: str, out: Path) -> int:
    data = yaml.safe_load(DATA.read_text(encoding="utf-8"))
    e = next((x for x in data if x["id"] == rid), None)
    if not e:
        raise FormatError(f"記事 {rid} がありません")
    ja = e["ja"]
    lines = ["---", f"id: {rid}", f"version: {e['version']}", f"date: {e['date']}", "---", HEADER_COMMENT, "", f"# {ja['title']}", ""]
    for s in ja["sections"]:
        lines += [f"## {s['heading']}", ""]
        for it in s["items"]:
            lines.append(f"### {it['title']}" + (f" [{', '.join(it['games'])}]" if it.get("games") else ""))
            if "desc" in it:
                lines.append(it["desc"].replace("\n", "\n\n"))
            lines += [(f"{n}. {x}" if it.get("ordered") else f"- {x}") for n, x in enumerate(it.get("list", []), 1)]
            m = it.get("media")
            if m:
                lines.append(f"![]({m['src']})")
            lines.append("")
    out.write_text("\n".join(lines), encoding="utf-8")
    tr = {"src": {"title": ja["title"], "sections": [{"heading": s["heading"], "items": [{k: it[k] for k in ("title", "desc", "list") if k in it} for it in s["items"]]} for s in ja["sections"]]}}
    for lang in LANGS:
        b = e[lang]
        tr[lang] = {"title": b["title"], "sections": [{"heading": s["heading"], "items": [{k: it[k] for k in ("title", "desc", "list") if k in it} for it in s["items"]]} for s in b["sections"]]}
    write_tr(rid, tr)
    print(f"原稿: {out}\n訳: {SRC_DIR / rid / 'tr.yml'}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build")
    b.add_argument("md", type=Path)
    i = sub.add_parser("import")
    i.add_argument("id")
    i.add_argument("--out", type=Path, required=True)
    a = ap.parse_args()
    try:
        return cmd_build(a.md.resolve()) if a.cmd == "build" else cmd_import(a.id, a.out)
    except FormatError as e:
        print("原稿の誤り: " + str(e), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
