// リリースノート（記事）の画面の出し方。
// PC: 左の項目と右の枠の画面を1対1でつなぐ。項目を押すとその画面に切り替わり、表示中の項目を強調する。
// スマホ: 1項目を1枚のスライドにし、左右のスワイプか前後のボタンで送る。目次は見出しの最初の1枚へ飛ぶ。
// JSが無くても、PCは1枚目、スマホは横スクロールで全部見られる。
(function () {
  'use strict';
  var narrow = window.matchMedia('(max-width: 859px)');

  // 句読点で区切った塊が1行に収まらない時、語の途中で折れないよう、文節の切れ目（助詞の後に漢字・カタカナ・英数字・括弧が来る所）だけを折り返し位置にする。
  // 送り仮名（選び方・見た目・並べ替え）の後では折らない
  var HIRA = /[にをはがでとのへもやらどてし]/;
  var HEAD = /[一-鿿々゠-ヿA-Za-z0-9０-９「『（(]/;
  document.querySelectorAll('.release .nb').forEach(function (el) {
    var t = el.textContent, out = '';
    for (var k = 0; k < t.length; k++) {
      if (k > 0 && HIRA.test(t[k - 1]) && HEAD.test(t[k])) out += '​';
      out += t[k];
    }
    if (out !== t) { el.textContent = out; el.classList.add('nb-phrase'); }
  });

  // ---- PC: 左の項目と右の枠（画像の無い項目 .release-row-text は押せない。画像が1枚も無い記事には枠が無い）
  var root = document.querySelector('[data-release]');
  var showPc = function () {};
  if (root) {
    var rows = Array.prototype.slice.call(root.querySelectorAll('.release-row[data-idx]'));
    var slides = Array.prototype.slice.call(root.querySelectorAll('.rv-slide'));
    var title = root.querySelector('[data-rv-title]');
    var pos = root.querySelector('[data-rv-pos]');
    var viewer = root.querySelector('.rv');
    var index = 0;
    showPc = function (i) {
      index = (i + slides.length) % slides.length;
      slides.forEach(function (s, j) {
        var on = j === index;
        s.hidden = !on;
        var v = s.querySelector('video');
        if (v) { if (on && !narrow.matches) { v.play().catch(function () {}); } else { v.pause(); } }
      });
      rows.forEach(function (r, j) {
        if (j === index) { r.setAttribute('aria-current', 'true'); } else { r.removeAttribute('aria-current'); }
      });
      title.textContent = slides[index].dataset.num + '　' + slides[index].dataset.title;
      pos.textContent = slides[index].dataset.num;
    };
    rows.forEach(function (r, j) {
      r.addEventListener('click', function (e) { e.preventDefault(); showPc(j); });
    });
    root.querySelectorAll('[data-rv-dir]').forEach(function (b) {
      b.addEventListener('click', function () { showPc(index + Number(b.dataset.rvDir)); });
    });
    viewer.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') showPc(index - 1);
      if (e.key === 'ArrowRight') showPc(index + 1);
    });
  }

  // ---- スマホ: スライド
  var rs = document.querySelector('[data-rs]');
  var goSlide = function () {};
  if (rs) {
    var track = rs.querySelector('.rs-track');
    var cards = Array.prototype.slice.call(track.querySelectorAll('.rs-slide'));
    var rsPos = rs.querySelector('[data-rs-pos]');
    var cur = 0;
    var current = function () { return Math.round(track.scrollLeft / track.clientWidth); };
    var sync = function () {
      cur = Math.max(0, Math.min(cards.length - 1, current()));
      rsPos.textContent = cur + 1;
      cards.forEach(function (c, j) {
        var v = c.querySelector('video');
        if (v) { if (j === cur && narrow.matches) { v.play().catch(function () {}); } else { v.pause(); } }
      });
    };
    goSlide = function (i, smooth) {
      i = Math.max(0, Math.min(cards.length - 1, i));
      cur = i;
      rsPos.textContent = i + 1;
      track.scrollTo({ left: i * track.clientWidth, behavior: smooth === false ? 'auto' : 'smooth' });
      if (smooth === false) sync();
    };
    var t = null;
    track.addEventListener('scroll', function () { clearTimeout(t); t = setTimeout(sync, 80); }, { passive: true });
    rs.querySelectorAll('[data-rs-dir]').forEach(function (b) {
      b.addEventListener('click', function () { goSlide(cur + Number(b.dataset.rsDir)); });
    });
    sync();
  }

  // 目次: PCはその見出しの最初の項目を表示する。スマホはその見出しの最初の1枚へ送り、スライドの所まで画面を動かす
  document.querySelectorAll('.release-toc a').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var sn = a.getAttribute('href').replace('#sec-', '');
      if (narrow.matches && rs) {
        e.preventDefault();
        var k = cards.findIndex(function (c) { return c.dataset.sec === sn; });
        if (k >= 0) goSlide(k, false);
        rs.scrollIntoView({ block: 'start' });
        return;
      }
      var sec = document.querySelector(a.getAttribute('href'));
      var first = sec && sec.querySelector('.release-row[data-idx]');
      if (first && root) showPc(Number(first.dataset.idx));
    });
  });

  if (root) showPc(0);
})();
