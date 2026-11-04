# リリースノート原稿（md）の書き方

原稿は日本語だけで書く。置き場は撮った動画・画像と同じフォルダ `~/Downloads/tmp/release/<YYMMDD>_リリース動画/<YYMMDD>_リリースノート.md`。
英語・韓国語・中国語の訳は、変換の時に Claude が `_releases_src/<id>/tr.yml` に書く。

```markdown
---
version: 1.3.20261104
date: 2026-11-02
---

# beatmania IIDX に対応しました

## beatmania IIDX に対応

### 譜面確認 [IIDX]
- ☆8以上が対象です
- ZINRAIの「譜面表示エリアの固定」にも対応しました
![](261030_alm23b_IIDX_譜面確認.mp4)

### 家庭用の参加可否
主催者が「家庭用の参加可否」を選べます。
![sa-home](261030_alm217host_スコアタ作成の家庭用からの参加.mp4)
```

| 書くもの | 書き方 | サイトでの出方 |
|---|---|---|
| 版・日付 | 冒頭の `---` の間に `version` と `date`（記事に出す日付） | 記事の上の日付と版 |
| 記事の id | 省略するとフォルダ名の YYMMDD（例 261104 → 2026-11-04）。URL と画像の置き場になる | `/blog/2026-11-04` |
| 記事の題 | `# 題`（1つ） | 記事の見出し・一覧の題 |
| 節 | `## 見出し` | 目次と番号つきの帯 |
| 項目 | `### 題` | 1項目 = 右の枠（スマホは1枚のカード）に出す画面1つ |
| 機種の札 | 項目の題の末尾に `[IIDX]`、複数は `[DDR, pop'n]` | 題の横の札 |
| 説明 | 項目の下の普通の文 | 題の下の文 |
| 箇条 | `- ` で始まる行 | 題の下の箇条 |
| 画像・動画 | `![](ファイル名)`。1項目に1つまで。無くてもよい | 右の枠・カードの画面 |

- 動画（mp4・mov）は幅540px・crf27 に縮め、最初の1コマをポスターにする。画像（png・jpg・webp）は幅720pxまでの jpg にする。
- 配信するファイル名は元のファイル名の英数字から作る。`![sa-home](...)` のように名前を書けばそれを使う。
- フォルダにファイルが無く、同じ名前が配信済み（`assets/release-media/<id>/`）にあれば、そちらをそのまま使う。
- `<!-- -->` の中は無視する。メモに使ってよい。

## 変換（Claude が行う）

```bash
cd ~/Documents/Dev/ClaudeCode/alm4gest-site
python3 _tools/release_note/release_note.py build <原稿.md>
```

- 訳の無い文・原稿で直された文があると、`tr.yml` に `TODO:` を書いて終了コード 2 で止まる。TODO を訳で埋めて、もう一度 build する。
  訳したときの日本語は `tr.yml` の `src` に残るので、日本語が変わった文だけが TODO に戻る。
- 作るもの: `_data/releases.yml` のその記事、`blog/<id>.md` と `en|ko|zh/blog/<id>.md`、`assets/release-media/<id>/` の画像と動画、`_releases_src/<id>/ja.md`（原稿の写し）。
- そのあと見た目を確かめる: `_tools/release_note/check_layout.sh <id>`（4言語 × 幅1440px・390px）。
