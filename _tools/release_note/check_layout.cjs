#!/usr/bin/env node
// 記事ページを 4言語 × 幅1440px・390px × ダーク・ライトで開き、崩れを数える。check_layout.sh から呼ぶ。
//
//   NODE_PATH=<playwright の node_modules> node check_layout.cjs <ベースURL> <id> <撮影先>
//
// 数えるもの（1つでもあれば FAIL）:
//   - ページの横あふれ（画面の幅より横に広い）
//   - 画面の右端・左端からはみ出した要素（横に送るカードの中は、カード1枚の枠で見る）
//   - 箱からはみ出して切れた文字（overflow で隠れたもの）
//   - スマホのカードの縦あふれ（カードの中身がカードの高さに入らない）
//   - 機種の札: 札の中で折り返している／項目の枠の右へはみ出している／題の行から離れている
//   - 語の途中の改行（ハングル・英字が続く所で行が分かれたもの。日本語・中国語は BudouX が文節で切る）
//   - 読み込めない画像・動画・ポスター
//   - 項目の数が日本語と違う
//   - 右の枠の題の帯（.rv-title）で題が「…」で省かれる（2026-11-04 川口さん「基本はそれ以上長くならないようにしてほしい」。訳を縮める）
// 撮った画像は <撮影先>/<言語>_<幅>_<明暗>.png（PCは全体、スマホはカードを1枚ずつ）。
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const [BASE, ID, OUT] = process.argv.slice(2);
if (!BASE || !ID || !OUT) { console.error('使い方: node check_layout.cjs <ベースURL> <id> <撮影先>'); process.exit(1); }
const LANGS = [['ja', ''], ['en', '/en'], ['ko', '/ko'], ['zh', '/zh']];
const WIDTHS = [1440, 390];
const MODES = ['dark', 'light'];

function measure() {
  const W = innerWidth;
  const out = { ellipsis: [], pageOverflow: document.documentElement.scrollWidth - W, outside: [], clipped: [], slideOver: [], badges: [], rows: 0, slides: 0 };
  const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const label = (el) => (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : el.tagName.toLowerCase()) + ' 「' + (el.textContent || '').trim().slice(0, 24) + '」';
  const scroller = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const ox = getComputedStyle(p).overflowX; if (ox !== 'visible') return p; } return null; };
  const root = document.querySelector('article.release');
  for (const el of root.querySelectorAll('*')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    const sc = scroller(el);
    const slide = el.closest('.rs-slide');
    if (slide && slide !== el) {
      const sr = slide.getBoundingClientRect();
      if (r.right > sr.right + 1 || r.left < sr.left - 1) out.outside.push(label(el) + ` カードの外 ${Math.round(r.left - sr.left)}〜${Math.round(r.right - sr.left)} / ${Math.round(sr.width)}`);
    } else if (!sc || sc === document.documentElement || sc === document.body) {
      if (r.right > W + 1 || r.left < -1) out.outside.push(label(el) + ` 画面の外 ${Math.round(r.left)}〜${Math.round(r.right)} / ${W}`);
    }
    const cs = getComputedStyle(el);
    if (el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && ['hidden', 'clip'].includes(cs.overflowX) && el.scrollWidth > el.clientWidth + 1) { if (!el.matches('.rv-title')) out.clipped.push(label(el)); }
  }
  // 右の枠の題の帯は、表示中の1項目しか入っていない。全項目の題を1つずつ入れて、帯に収まるかを測る
  const bar = root.querySelector('.rv-title');
  if (bar && visible(bar)) {
    const keep = bar.textContent;
    for (const f of root.querySelectorAll('.rv-slide')) {
      bar.textContent = f.dataset.num + '　' + f.dataset.title;
      if (bar.scrollWidth > bar.clientWidth + 1) out.ellipsis.push(`${f.dataset.num}「${f.dataset.title}」 ${bar.scrollWidth}px / ${bar.clientWidth}px`);
    }
    bar.textContent = keep;
  }
  for (const s of root.querySelectorAll('.rs-slide')) {
    out.slides++;
    const box = s.getBoundingClientRect();
    for (const c of s.children) { if (!visible(c)) continue; const r = c.getBoundingClientRect(); if (r.bottom > box.bottom + 1) out.slideOver.push(label(c) + ` 下へ ${Math.round(r.bottom - box.bottom)}px`); }
  }
  out.midword = [];
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const word = /[\uac00-\ud7a3A-Za-z0-9]/;
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const t = n.textContent; if (!t.trim() || !visible(n.parentElement)) continue;
    const rg = document.createRange(); let prevTop = null;
    for (let i = 0; i < t.length; i++) {
      rg.setStart(n, i); rg.setEnd(n, i + 1);
      const r = rg.getClientRects()[0]; if (!r) { prevTop = null; continue; }
      if (prevTop !== null && r.top > prevTop + 2 && word.test(t[i]) && word.test(t[i - 1])) out.midword.push(`「${t.slice(Math.max(0, i - 6), i)}／${t.slice(i, i + 6)}」`);
      prevTop = r.top;
    }
  }
  out.rows = root.querySelectorAll('.release-row').length;
  for (const b of root.querySelectorAll('.rel-game')) {
    if (!visible(b)) continue;
    const r = b.getBoundingClientRect();
    const fs = parseFloat(getComputedStyle(b).fontSize);
    const row = b.closest('.release-row, .rs-slide');
    const title = b.closest('.release-row-title, .rs-title');
    const rr = row.getBoundingClientRect(); const tr = title.getBoundingClientRect();
    if (r.height > fs * 2.2) out.badges.push(`札「${b.textContent}」が札の中で折り返し（高さ ${Math.round(r.height)}px）`);
    if (r.right > rr.right + 1) out.badges.push(`札「${b.textContent}」が項目の右へ ${Math.round(r.right - rr.right)}px はみ出し`);
    if (r.top < tr.top - 1 || r.bottom > tr.bottom + 1) out.badges.push(`札「${b.textContent}」が題の行の外`);
  }
  out.media = [...root.querySelectorAll('img')].filter((i) => visible(i) && i.complete && !i.naturalWidth).map((i) => i.src);
  out.mediaUrls = [...new Set([...root.querySelectorAll('img[src], video[poster], source[src]')].map((e) => e.src || e.poster).filter(Boolean))];
  return out;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  let fails = 0;
  let jaCount = null;
  for (const [lang, prefix] of LANGS) for (const w of WIDTHS) for (const mode of MODES) {
    const ctx = await b.newContext({ viewport: { width: w, height: w > 600 ? 900 : 844 }, deviceScaleFactor: w > 600 ? 1 : 2 });
    await ctx.addInitScript((m) => { try { localStorage.setItem('alm4gest-theme', m); } catch (e) {} }, mode);
    const pg = await ctx.newPage();
    const errors = [];
    pg.on('pageerror', (e) => errors.push(e.message));
    const url = `${BASE}${prefix}/blog/${ID}`;
    const res = await pg.goto(url, { waitUntil: 'networkidle' });
    const tag = `${lang}_${w}_${mode}`;
    if (res.status() !== 200) { console.log(`FAIL ${tag}: ${url} が ${res.status()}`); fails++; await ctx.close(); continue; }
    await pg.evaluate(() => document.fonts.ready);
    await pg.waitForTimeout(300);
    const m = await pg.evaluate(measure);
    const bad = [];
    if (m.pageOverflow > 1) bad.push(`ページが横に ${m.pageOverflow}px あふれ`);
    bad.push(...m.outside.map((x) => 'はみ出し ' + x), ...m.clipped.map((x) => '文字が切れ ' + x), ...m.slideOver.map((x) => 'カードの縦あふれ ' + x), ...m.badges, ...m.midword.map((x) => '語の途中で改行 ' + x), ...m.ellipsis.map((x) => '題が帯に入らず「…」 ' + x));
    for (const u of m.mediaUrls) { const r = await ctx.request.get(u); if (r.status() !== 200) bad.push(`読み込めない ${u}（${r.status()}）`); }
    bad.push(...m.media.map((u) => '画像が出ない ' + u), ...errors.map((e) => 'JSのエラー ' + e));
    const count = w > 600 ? m.rows : m.slides;
    if (lang === 'ja' && jaCount === null && w > 600) jaCount = { rows: m.rows };
    if (jaCount && w > 600 && m.rows !== jaCount.rows) bad.push(`画面つきの項目が ${m.rows}（日本語は ${jaCount.rows}）`);
    if (w > 600) {
      await pg.screenshot({ path: path.join(OUT, `${tag}.png`), fullPage: true });
    } else {
      const n = m.slides;
      for (let i = 0; i < n; i++) {
        await pg.evaluate((i) => { const s = document.querySelectorAll('.rs-slide')[i]; s.scrollIntoView({ block: 'nearest', inline: 'start' }); document.querySelector('.rs').scrollIntoView({ block: 'start' }); }, i);
        await pg.waitForTimeout(150);
        await pg.screenshot({ path: path.join(OUT, `${tag}_${String(i + 1).padStart(2, '0')}.png`) });
      }
      if (!n) await pg.screenshot({ path: path.join(OUT, `${tag}.png`), fullPage: true });
    }
    console.log(`${bad.length ? 'FAIL' : 'OK  '} ${tag}（${w > 600 ? '行' : 'カード'} ${count}）`);
    for (const x of bad) console.log('    ' + x);
    fails += bad.length ? 1 : 0;
    await ctx.close();
  }
  await b.close();
  console.log(fails ? `\n崩れのある組: ${fails}` : '\n崩れは見つかりませんでした（16組）');
  console.log(`撮影: ${OUT}`);
  process.exit(fails ? 1 : 0);
})();
