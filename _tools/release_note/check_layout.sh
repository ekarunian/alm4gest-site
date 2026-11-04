#!/bin/bash
# 記事ページの見た目を 4言語 × 幅1440px・390px × ダーク・ライトで確かめる。
#   _tools/release_note/check_layout.sh <id> [撮影先]
# サイトを一時フォルダへ組んで開き、check_layout.cjs で崩れを数える。終了コード 0 = 崩れなし。
# 撮った画像は1枚ずつ開いて目で見る（数えられない崩れ＝文節の切れ方・札の見え方の確認）。
set -euo pipefail
ID="${1:?使い方: check_layout.sh <id> [撮影先]}"
SITE="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${2:-${TMPDIR:-/tmp}/release_check/$ID}"
PORT=4011
JEKYLL=/opt/homebrew/lib/ruby/gems/4.0.0/bin/jekyll
DEST="$(mktemp -d)"
PW_DIR="$(for d in $(find "$HOME/.npm/_npx" -maxdepth 4 -type d -name playwright -path '*node_modules*'); do NODE_PATH="$(dirname "$d")" node -e "process.exit(require('fs').existsSync(require('playwright').chromium.executablePath())?0:1)" 2>/dev/null && { dirname "$d"; break; }; done)"
[ -n "$PW_DIR" ] || { echo "playwright が見つかりません（~/.npm/_npx）"; exit 1; }

cd "$SITE"
"$JEKYLL" serve --port "$PORT" --destination "$DEST" --no-watch >"$DEST.log" 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null; wait $PID 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do curl -fs "http://127.0.0.1:$PORT/" >/dev/null 2>&1 && break; sleep 1; done
curl -fs "http://127.0.0.1:$PORT/" >/dev/null || { echo "サイトを組めませんでした"; cat "$DEST.log"; exit 1; }
NODE_PATH="$PW_DIR" node "$SITE/_tools/release_note/check_layout.cjs" "http://127.0.0.1:$PORT" "$ID" "$OUT"
