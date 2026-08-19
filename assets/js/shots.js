// トップの画面カルーセルと出現アニメーション。
// カルーセルはJSが無くても横スクロールで全部見られるので、
// ここでやるのは矢印を出すことと、現在地をドットへ反映することだけ。
(function () {
  'use strict';

  // CSSの .js ゲート。このスクリプトが動いた時だけ .reveal を隠すので、
  // JSが無い・読み込みに失敗した環境では全部最初から見えている
  document.documentElement.classList.add('js');

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  document.querySelectorAll('.shots').forEach(function (root) {
    var track = root.querySelector('.shots-track');
    var slides = Array.prototype.slice.call(root.querySelectorAll('.shots-slide'));
    var dots = Array.prototype.slice.call(root.querySelectorAll('.shots-dot'));
    var arrows = Array.prototype.slice.call(root.querySelectorAll('.shots-arrow'));
    var status = root.querySelector('[data-shots-status]');
    if (!track || slides.length < 2) {
      return;
    }

    var index = 0;

    function go(i) {
      index = Math.max(0, Math.min(slides.length - 1, i));
      track.scrollTo({
        left: slides[index].offsetLeft - slides[0].offsetLeft,
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      });
    }

    // ドットは素のままだとページごと飛ぶアンカー。JSがある時だけ横送りへ変える
    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function (event) {
        event.preventDefault();
        go(i);
      });
    });

    arrows.forEach(function (button) {
      button.hidden = false;
      button.addEventListener('click', function () {
        go(index + Number(button.dataset.shotsDir));
      });
    });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) {
            return;
          }
          var i = slides.indexOf(entry.target);
          if (i < 0) {
            return;
          }
          index = i;
          if (status) {
            status.textContent = dots[i] ? dots[i].getAttribute('aria-label') : '';
          }
          dots.forEach(function (dot, j) {
            if (j === i) {
              dot.setAttribute('aria-current', 'true');
            } else {
              dot.removeAttribute('aria-current');
            }
          });
        });
      },
      { root: track, threshold: 0.6 }
    );
    slides.forEach(function (slide) {
      observer.observe(slide);
    });
  });

  // スクロールに合わせた出現アニメーション（reduced-motion では即時表示）
  var toReveal = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  if (toReveal.length) {
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      toReveal.forEach(function (el) {
        el.classList.add('is-visible');
      });
    } else {
      var revealObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              revealObserver.unobserve(entry.target);
            }
          });
        },
        { rootMargin: '0px 0px -10% 0px', threshold: 0.1 }
      );
      toReveal.forEach(function (el) {
        revealObserver.observe(el);
      });
    }
  }
})();
