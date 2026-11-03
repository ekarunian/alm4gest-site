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
    // 狭い画面では枠が上に固定されるので、押した項目が隠れないよう枠の下へ寄せる
    if (!fromRow && narrow.matches) {
      rows[index].scrollIntoView({ block: 'nearest' });
    }
  }

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
      var first = sec && sec.querySelector('.release-row');
      if (first) show(Number(first.dataset.idx), true);
    });
  });
})();
