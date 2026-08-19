// トップの画面カルーセル。JSが無い状態でも横スクロールで全部見られるので、
// ここでやるのは矢印を出すことと、現在地をドットへ反映することだけ。
(function () {
  'use strict';

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  document.querySelectorAll('.shots').forEach(function (root) {
    var track = root.querySelector('.shots-track');
    var slides = Array.prototype.slice.call(root.querySelectorAll('.shots-slide'));
    var dots = Array.prototype.slice.call(root.querySelectorAll('.shots-dot'));
    var arrows = Array.prototype.slice.call(root.querySelectorAll('.shots-arrow'));
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
})();
