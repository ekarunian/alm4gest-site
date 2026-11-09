// リリースノート（記事）の画面の出し方。
// PC: 左の項目と右の枠の画面を1対1でつなぐ。スクロールで読み進めると右の画面が今の項目へ切り替わり、
//     項目を押してもその画面に切り替わる。表示中の項目を強調する。
// スマホ: 1項目を1枚のカードにし、左右のスワイプ・前後のボタン・見出しのタブ・点で送る。
// JSが無くても、PCは1枚目、スマホは横スクロールで全部見られる。
(function () {
  'use strict';
  var narrow = window.matchMedia('(max-width: 859px)');

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
      r.addEventListener('click', function (e) {
        e.preventDefault();
        showPc(j);
        // 押した項目を切り替えの線まで送る（送らないと、次に少し動かしたときに別の項目へ戻る）
        var top = window.scrollY + r.getBoundingClientRect().top - window.innerHeight * 0.4 + 1;
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      });
    });
    root.querySelectorAll('[data-rv-dir]').forEach(function (b) {
      b.addEventListener('click', function () { showPc(index + Number(b.dataset.rvDir)); });
    });
    viewer.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') showPc(index - 1);
      if (e.key === 'ArrowRight') showPc(index + 1);
    });

    // スクロールに合わせて右の画面を切り替える（押さなくても読み進めるだけで変わる）。
    // 画面の上から4割の線を越えた最後の項目を今の項目にする。下端まで送ったら最後の項目
    // （2026-11-04 オーナー「webだと画像や動画を切り替えられることに気付いてくれなかった」
    // 「スクロールに応じてカチカチと勝手に変わってくれる方が良い」）
    var spyQueued = false;
    var spy = function () {
      spyQueued = false;
      if (narrow.matches || !rows.length) return;
      var line = window.innerHeight * 0.4;
      var at = 0;
      rows.forEach(function (r, j) { if (r.getBoundingClientRect().top <= line) at = j; });
      var doc = document.documentElement;
      if (window.innerHeight + window.scrollY >= doc.scrollHeight - 4) at = rows.length - 1;
      if (at !== index) showPc(at);
    };
    window.addEventListener('scroll', function () {
      if (spyQueued) return;
      spyQueued = true;
      window.requestAnimationFrame(spy);
    }, { passive: true });
  }

  // ---- スマホ: 1項目1枚のカード。見出しのタブ・カード・点が連動する
  var rs = document.querySelector('[data-rs]');
  if (rs) {
    var track = rs.querySelector('.rs-track');
    var cards = Array.prototype.slice.call(track.querySelectorAll('.rs-slide'));
    var tabs = Array.prototype.slice.call(rs.querySelectorAll('[data-rs-sec]'));
    var tabBar = rs.querySelector('.rs-tabs');
    var dots = Array.prototype.slice.call(rs.querySelectorAll('[data-rs-to]'));
    var arrows = Array.prototype.slice.call(rs.querySelectorAll('[data-rs-dir]'));
    var cur = -1;
    // カードの帯が画面から外れている間は、動画を流さない（読み込み・電池を使わない）
    var inView = true;
    var step = function () { return cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : track.clientWidth; };
    var mark = function (i) {
      if (i === cur) return;
      cur = i;
      var sec = cards[i].dataset.sec;
      dots.forEach(function (d, j) { if (j === i) { d.setAttribute('aria-current', 'true'); } else { d.removeAttribute('aria-current'); } });
      tabs.forEach(function (t) {
        if (t.dataset.rsSec === sec) {
          t.setAttribute('aria-current', 'true');
          // 今の見出しのタブが帯の中で見えるよう、帯だけを横に送る（ページは動かさない）
          var l = t.offsetLeft - tabBar.offsetLeft, r = l + t.offsetWidth;
          if (l < tabBar.scrollLeft || r > tabBar.scrollLeft + tabBar.clientWidth) tabBar.scrollTo({ left: l - 24, behavior: 'smooth' });
        } else { t.removeAttribute('aria-current'); }
      });
      arrows[0].disabled = i === 0;
      arrows[1].disabled = i === cards.length - 1;
      cards.forEach(function (c, j) {
        var v = c.querySelector('video');
        if (v) { if (j === i && narrow.matches && inView) { v.play().catch(function () {}); } else { v.pause(); } }
      });
    };
    var replay = function () {
      var c = cards[cur], v = c && c.querySelector('video');
      if (!v) return;
      if (inView && narrow.matches && layer.hidden) { v.play().catch(function () {}); } else { v.pause(); }
    };
    var go = function (i, smooth) {
      i = Math.max(0, Math.min(cards.length - 1, i));
      mark(i);
      track.scrollTo({ left: i * step(), behavior: smooth === false ? 'auto' : 'smooth' });
    };
    var pending = false;
    track.addEventListener('scroll', function () {
      if (pending) return;
      pending = true;
      window.requestAnimationFrame(function () { pending = false; mark(Math.max(0, Math.min(cards.length - 1, Math.round(track.scrollLeft / step())))); });
    }, { passive: true });
    arrows.forEach(function (b) { b.addEventListener('click', function () { go(cur + Number(b.dataset.rsDir)); }); });
    dots.forEach(function (d) { d.addEventListener('click', function () { go(Number(d.dataset.rsTo)); }); });
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        go(cards.findIndex(function (c) { return c.dataset.sec === t.dataset.rsSec; }));
      });
    });
    mark(0);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { inView = es[0].isIntersecting; replay(); }).observe(track);
    }

    // アプリの中で記事を開いた時は、カードの所（ページの下端）まで送ってから見せる
    // （2026-11-10 オーナー「リリースノートに関しては一番下までスクロールしてもらった方が
    // 読みやすい(カード型コンテンツの部分が見たい)」）。
    // 戻って出し直した面と、位置（#…）を指して開いた面は動かさない
    if (document.documentElement.classList.contains('in-app') && narrow.matches && !location.hash) {
      var nav = window.performance && performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
      if (!nav || nav.type !== 'back_forward') {
        // 画像や字の読み込みで丈が伸びたら読み込み後に送り直す。その前に指で触れていたら送り直さない
        var touched = false;
        var mine = function () { touched = true; };
        window.addEventListener('touchstart', mine, { once: true, passive: true });
        window.addEventListener('wheel', mine, { once: true, passive: true });
        var toBottom = function () { if (!touched) window.scrollTo(0, document.documentElement.scrollHeight); };
        toBottom();
        window.addEventListener('load', toBottom, { once: true });
      }
    }

    // 画面をタップすると、画面いっぱいに広げて見せる（動画は操作バー付き）。背景か×で閉じる
    var layer = rs.querySelector('[data-rs-zoom-layer]');
    var body = layer.querySelector('.rs-zoom-body');
    var close = function () {
      if (layer.hidden) return;
      layer.hidden = true;
      body.innerHTML = '';
      document.documentElement.classList.remove('rs-zoom-open');
      replay();
    };
    var open = function (box) {
      var src = box.querySelector('img, video');
      var el = src.cloneNode(true);
      if (el.tagName === 'VIDEO') { el.controls = true; el.muted = true; el.loop = true; el.setAttribute('playsinline', ''); el.preload = 'auto'; }
      // 広げた方だけを流す（カードの方は止める）
      if (src.tagName === 'VIDEO') src.pause();
      body.appendChild(el);
      layer.hidden = false;
      document.documentElement.classList.add('rs-zoom-open');
      if (el.tagName === 'VIDEO') el.play().catch(function () {});
      layer.querySelector('.rs-zoom-close').focus();
    };
    rs.querySelectorAll('[data-rs-zoom]').forEach(function (box) {
      box.addEventListener('click', function () { open(box); });
      box.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(box); } });
    });
    layer.addEventListener('click', function (e) { if (e.target === layer || e.target === body || e.target.closest('.rs-zoom-close')) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    narrow.addEventListener('change', close);
  }

  // 目次（PC）: その見出しの最初の項目を表示する。スマホでは目次の代わりに見出しのタブを使う
  document.querySelectorAll('.release-toc a').forEach(function (a) {
    a.addEventListener('click', function () {
      var sec = document.querySelector(a.getAttribute('href'));
      var first = sec && sec.querySelector('.release-row[data-idx]');
      if (first && root) showPc(Number(first.dataset.idx));
    });
  });

  if (root) showPc(0);
})();
