// リリースノート: 左の項目と右の枠の画面を1対1でつなぐ。
// 項目を押すとその画面に切り替わり、表示中の画面の項目を強調する。JSが無ければ1枚目だけが見える。
// スマホでは枠を固定せず、選んだ項目のすぐ下へ移す。枠の大きさは小・標準・大から選べ、選択は端末に残す。
(function () {
  'use strict';
  var root = document.querySelector('[data-release]');
  if (!root) return;
  var rows = Array.prototype.slice.call(root.querySelectorAll('.release-row'));
  var slides = Array.prototype.slice.call(root.querySelectorAll('.rv-slide'));
  var title = root.querySelector('[data-rv-title]');
  var pos = root.querySelector('[data-rv-pos]');
  var viewer = root.querySelector('.rv');
  var col = viewer.closest('.release-viewer-col');
  var sizeBtns = Array.prototype.slice.call(root.querySelectorAll('[data-rv-size]'));
  var index = 0;
  var narrow = window.matchMedia('(max-width: 859px)');
  var SIZE_KEY = 'alm4gest-rv-size';

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

  // スマホ: 枠を選んだ項目の直後へ移す。基準にした要素が画面上で動かないよう、移した分だけ戻す。PC: 枠を元の列へ戻す
  function place(anchor) {
    if (!narrow.matches) {
      if (col.parentNode !== root) root.appendChild(col);
      return;
    }
    var row = rows[index];
    if (row.nextElementSibling === col) return;
    var before = anchor ? anchor.getBoundingClientRect().top : 0;
    row.after(col);
    if (anchor) window.scrollBy(0, anchor.getBoundingClientRect().top - before);
  }

  function show(i, anchor) {
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
    title.textContent = slides[index].dataset.num + '　' + slides[index].dataset.title;
    pos.textContent = slides[index].dataset.num;
    place(anchor);
  }

  function setSize(z) {
    root.dataset.rvSize = z;
    sizeBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.rvSize === z)); });
  }
  var saved = null;
  try { saved = localStorage.getItem(SIZE_KEY); } catch (e) {}
  setSize(saved === 's' || saved === 'l' ? saved : 'm');
  sizeBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      setSize(b.dataset.rvSize);
      try { localStorage.setItem(SIZE_KEY, b.dataset.rvSize); } catch (e) {}
    });
  });

  place(null);
  narrow.addEventListener('change', function () { place(null); });

  // 項目を押した時は、押した項目を画面上で動かさない
  rows.forEach(function (r, j) {
    r.addEventListener('click', function (e) { e.preventDefault(); show(j, r); });
  });
  // 矢印で送った時は、枠が次の項目の下へ移るので、その項目が画面の上側に来るよう寄せる
  root.querySelectorAll('[data-rv-dir]').forEach(function (b) {
    b.addEventListener('click', function () {
      show(index + Number(b.dataset.rvDir), null);
      if (narrow.matches) {
        var r = rows[index].getBoundingClientRect();
        var head = document.querySelector('.site-header').offsetHeight;
        if (r.top < head || r.top > window.innerHeight * 0.5) rows[index].scrollIntoView({ block: 'start' });
      }
    });
  });
  viewer.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') show(index - 1, null);
    if (e.key === 'ArrowRight') show(index + 1, null);
  });
  // 目次から見出しへ飛んだら、その見出しの最初の項目を表示する（枠を先に移してから飛ぶ）
  document.querySelectorAll('.release-toc a').forEach(function (a) {
    a.addEventListener('click', function () {
      var sec = document.querySelector(a.getAttribute('href'));
      var first = sec && sec.querySelector('.release-row');
      if (first) show(Number(first.dataset.idx), null);
    });
  });
})();
