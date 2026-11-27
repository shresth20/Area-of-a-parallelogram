/* ==========================================================================
 * scenery.js -- the stars
 * --------------------------------------------------------------------------
 * A few dozen points of light scattered over the sky behind everything,
 * each twinkling on its own clock (a CSS loop, see .stars__dot). They belong
 * to the page, not to a scene, so a Replay never touches them. Still under
 * reduced motion.
 * ========================================================================== */
(function (global) {
  'use strict';

  var STARS = 56;

  function stars(host) {
    if (!host) return;
    for (var i = 0; i < STARS; i++) {
      var s = document.createElement('i');
      s.className = 'stars__dot';
      var size = 2 + Math.random() * 3;
      s.style.left = (Math.random() * 100).toFixed(2) + '%';
      /* the sky only: the moon's surface takes the bottom fifth of the art */
      s.style.top = (Math.random() * 76).toFixed(2) + '%';
      s.style.width = size.toFixed(1) + 'px';
      s.style.height = size.toFixed(1) + 'px';
      s.style.setProperty('--twinkle', (2.4 + Math.random() * 3.2).toFixed(2) + 's');
      s.style.setProperty('--delay', (-Math.random() * 5).toFixed(2) + 's');
      host.appendChild(s);
    }
  }

  global.Scenery = { stars: stars };
})(window);
