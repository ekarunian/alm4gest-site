// リリースノート: 左の項目と右の枠の画面を1対1でつなぐ。
// 項目を押すとその画面に切り替わり、表示中の画面の項目を強調する。JSが無ければ1枚目だけが見える。
(function () {
  'use strict';
  var root = document.querySelector('[data-release]');
  if (!root) return;
  var rows = Array.prototype.slice.call(root.querySelectorAll('.release-row'));
  var slides = Array.prototype.slice.call(root.querySelectorAll('.rv-slide'));
  var title = root.querySelector('[data-rv-title]');
  var pos = root.querySelector('[data-rv-pos]');
  var viewer = root.querySelector('.rv');
  var index = 0;
  var narrow = window.matchMedia('(max-width: 859px)');

  // 句読点で区切った塊が1行に収まらない時、語の途中で折れないよう、文節の切れ目（助詞の後に漢字・カタカナ・英数字・括弧が来る所）だけを折り返し位置にする。
  // 送り仮名（選び方・見た目・並べ替え）の後では折らない
  var HIRA = /[にをはがでとのへもやらどてし]/;
  var HEAD = /[\u4e00-\u9fff\u3005\u30a0-\u30ffA-Za-z0-9\uff10-\uff19\u300c\u300e\uff08(]/;
  document.querySelectorAll('.release .nb').forEach(function (el) {
    var t = el.textContent, out = '';
    for (var k = 0; k < t.length; k++) {
      if (k > 0 && HIRA.test(t[k - 1]) && HEAD.test(t[k])) out += '\u200b';
      out += t[k];
    }
    if (out !== t) { el.textContent = out; el.classList.add('nb-phrase'); }
  });

  function show(i, fromRow) {
    index = (i + slides.length) % slides.length;
    slides.forEach(function (s, j) {
      var on = j === index;
      s.hidden = !on;
      var v = s.querySelector('video');
      if (v) { if (on) { v.play().catch(function () {}); } else { v.pause(); } }
    });
    rows.forEach(function (r, j) {
      if (j === index) { r.setAttribute('aria-current', 'true'); } else { r.removeAttribute('aria-current'); }
    });
    title.textContent = slides[index].dataset.num + '\u3000' + slides[index].dataset.title;
    pos.textContent = slides[index].dataset.num;
    // 狭い画面では枠が上に固定されるので、項目が枠の裏や画面の下に隠れたら、項目の頭を枠のすぐ下へ合わせる
    if (!fromRow && narrow.matches) {
      syncStick();
      var r = rows[index].getBoundingClientRect();
      if (r.top < stick() || r.bottom > window.innerHeight) {
        rows[index].scrollIntoView({ block: 'start' });
      }
    }
  }

  // 固定された枠の下端（ヘッダーの高さ＋枠の高さ）。見出しや項目の止まる位置に使う
  function stick() {
    var col = viewer.closest('.release-viewer-col');
    return (parseFloat(getComputedStyle(col).top) || 0) + col.offsetHeight;
  }
  function syncStick() {
    // ページ全体の scroll-padding-top（ヘッダー分）に足される値なので、その分を引く
    var pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    root.closest('.release').style.setProperty('--rv-stick', (narrow.matches ? stick() - pad : 0) + 'px');
  }
  syncStick();
  window.addEventListener('resize', syncStick);
  window.addEventListener('load', syncStick);

  rows.forEach(function (r, j) {
    r.addEventListener('click', function (e) { e.preventDefault(); show(j, true); });
  });
  root.querySelectorAll('[data-rv-dir]').forEach(function (b) {
    b.addEventListener('click', function () { show(index + Number(b.dataset.rvDir)); });
  });
  viewer.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') show(index - 1);
    if (e.key === 'ArrowRight') show(index + 1);
  });
  // 目次から見出しへ飛んだら、その見出しの最初の項目を表示する
  document.querySelectorAll('.release-toc a').forEach(function (a) {
    a.addEventListener('click', function () {
      var sec = document.querySelector(a.getAttribute('href'));
      syncStick();
      var first = sec && sec.querySelector('.release-row');
      if (first) show(Number(first.dataset.idx), true);
    });
  });
})();
