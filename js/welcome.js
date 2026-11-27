/* ==========================================================================
 * welcome.js -- the welcome picture, brought to life
 * --------------------------------------------------------------------------
 * The welcome screen IS assets/images/welcome.png, untouched. Nothing here
 * redraws it: every effect is either a piece of that same picture lined up
 * exactly on itself (the bird, its "!" marks) and moved a hair, or a glint
 * laid over something the picture already has (its stars, its title plate,
 * its ring). At rest every layer is invisible or sits pixel-on-pixel, so the
 * screen reads as the picture alone.
 *
 *   WelcomeFX.start()   build once, fade the picture in, start the loops
 *   WelcomeFX.stop()    kill every loop and put the picture back at rest
 *
 * All positions are in the picture's own pixels (1670 x 941) and turned into
 * percentages of the art box, so they hold at every screen size. Motion is
 * transform / opacity only (GSAP, time-based). Under reduced motion the
 * picture is simply shown, still. Load order: after gsap, before pages.js.
 * ========================================================================== */
(function (global) {
  'use strict';

  var gsap = global.gsap;
  var IW = 1670, IH = 941;                       /* welcome.png, in px     */

  /* ---- where things are in the picture (px) ----------------------------- */
  var BIRD  = { box: [150, 440, 625, 915], feet: [377, 870] };
  var MARKS = { box: [504, 518, 648, 650], from: [545, 625] };
  /* the stars the picture already has: x, y, size (% of the art's width) */
  var SPARKS = [
    [116, 443, 3.2], [1531, 98, 3], [517, 57, 2.4], [1552, 370, 2.4],
    [1319, 372, 2.6], [342, 345, 2.6], [308, 397, 2.2], [726, 617, 2],
    [1248, 59, 1.8], [1154, 734, 1.8], [1357, 574, 1.8], [59, 354, 1.8],
    [254, 330, 1.6], [1322, 35, 1.6], [1313, 608, 1.6], [133, 578, 1.6],
    [1049, 669, 1.6], [1536, 628, 1.6], [1464, 19, 1.4], [1054, 34, 1.4]
  ];
  /* the title plate's cyan outline, traced off the picture */
  var PLATE = [
    [342, 300], [400, 246], [445, 233], [505, 220], [520, 208], [535, 193],
    [550, 186], [610, 176], [700, 166], [820, 161], [900, 162], [1000, 169],
    [1135, 186], [1150, 192], [1180, 225], [1225, 236], [1285, 250], [1334, 300],
    [1315, 330], [1270, 378], [1225, 423], [1210, 426], [1135, 412],
    [1000, 391], [880, 383], [760, 384], [640, 396], [520, 416], [460, 426],
    [430, 402], [385, 354], [355, 322]
  ];
  /* the ring round the planet: an ellipse, tilted; it is hidden behind the
     plate and the planet except on these stretches of its angle t */
  var RING = { cx: 825, cy: 295, a: 535, b: 108, tilt: -11.3 * Math.PI / 180 };
  /* shooting stars: from, to -- open sky only, away from the plate and Start */
  var METEORS = [
    [[700, 30], [420, 150]], [[1650, 40], [1400, 150]],
    [[1665, 400], [1440, 500]], [[260, 250], [30, 350]]
  ];

  var dom = null, live = [], running = false;

  function reduced() { return !!(global.Motion && global.Motion.reducedMotion && global.Motion.reducedMotion()); }
  function px(x) { return (x / IW * 100) + '%'; }
  function py(y) { return (y / IH * 100) + '%'; }
  function h(cls, parent) {
    var e = document.createElement('div');
    e.className = cls;
    e.setAttribute('aria-hidden', 'true');
    parent.appendChild(e);
    return e;
  }
  function place(e, b) {
    e.style.left = px(b[0]); e.style.top = py(b[1]);
    e.style.width = px(b[2] - b[0]); e.style.height = py(b[3] - b[1]);
  }
  /* A piece of the same picture, lined up exactly on itself. */
  function copyOf(parent, b, cls) {
    var e = h('wfx-copy ' + (cls || ''), parent);
    var w = b[2] - b[0], hh = b[3] - b[1];
    place(e, b);
    e.style.backgroundSize = (IW / w * 100) + '% ' + (IH / hh * 100) + '%';
    e.style.backgroundPosition = (b[0] / (IW - w) * 100) + '% ' + (b[1] / (IH - hh) * 100) + '%';
    return e;
  }
  /* A mover: a box 1% x 1% of the art at its top-left corner, so xPercent /
     yPercent of 100 move it by 1% of the art -- no measuring, any size. */
  function mover(parent, cls) {
    var e = h('wfx-mover ' + cls, parent);
    return e;
  }
  function at(x, y) { return { xPercent: x / IW * 10000, yPercent: y / IH * 10000 }; }
  var STAR_PATH = 'M50 0 C54 38 62 46 100 50 C62 54 54 62 50 100 C46 62 38 54 0 50 C38 46 46 38 50 0Z';

  function build() {
    if (dom) return dom;
    var scene = document.getElementById('welcomeScene');
    if (!scene) return null;
    dom = { scene: scene, img: scene.querySelector('.welcome__img') };

    /* the bird and its "!" marks, breathing together from the feet */
    var rig = h('wfx-rig', scene);
    rig.style.transformOrigin = px(BIRD.feet[0]) + ' ' + py(BIRD.feet[1]);
    dom.rig = rig;
    copyOf(rig, BIRD.box, 'wfx-copy--bird');
    dom.marks = copyOf(rig, MARKS.box, 'wfx-copy--marks');
    var mw = MARKS.box[2] - MARKS.box[0], mh = MARKS.box[3] - MARKS.box[1];
    dom.marks.style.transformOrigin = ((MARKS.from[0] - MARKS.box[0]) / mw * 100) + '% ' +
                                      ((MARKS.from[1] - MARKS.box[1]) / mh * 100) + '%';

    /* a sweep of light across the title plate */
    var shine = h('wfx-shine', scene);
    shine.style.clipPath = 'polygon(' + PLATE.map(function (p) { return px(p[0]) + ' ' + py(p[1]); }).join(',') + ')';
    dom.band = h('wfx-shine__band', shine);

    /* the stars twinkling */
    dom.sparks = SPARKS.map(function (s) {
      var e = h('wfx-spark', scene);
      e.style.left = px(s[0]); e.style.top = py(s[1]); e.style.width = s[2] + '%';
      e.innerHTML = '<svg viewBox="0 0 100 100" focusable="false"><path d="' + STAR_PATH + '"/></svg>';
      return e;
    });

    /* a glint riding the ring */
    dom.orb = mover(scene, 'wfx-orb');
    h('wfx-orb__dot', dom.orb);

    /* a shooting star, reused */
    dom.meteor = mover(scene, 'wfx-meteor');
    dom.meteorTail = h('wfx-meteor__tail', dom.meteor);
    return dom;
  }

  function keep(a) { live.push(a); return a; }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function loops() {
    /* the camera breathing, very slowly */
    keep(gsap.to(dom.scene, { scale: 1.025, duration: 12, ease: 'sine.inOut', yoyo: true, repeat: -1 }));

    /* the bird breathing */
    keep(gsap.to(dom.rig, { scaleY: 1.016, scaleX: 1.005, duration: 1.6, ease: 'sine.inOut', yoyo: true, repeat: -1 }));

    /* the "!" marks popping twice, then a rest -- pointing at Start */
    var marks = gsap.timeline({ repeat: -1, repeatDelay: 2.2, delay: 1 });
    marks.to(dom.marks, { scale: 1.1, duration: 0.16, ease: 'power2.out' })
         .to(dom.marks, { scale: 1, duration: 0.28, ease: 'power2.in' })
         .to(dom.marks, { scale: 1.1, duration: 0.16, ease: 'power2.out' })
         .to(dom.marks, { scale: 1, duration: 0.3, ease: 'power2.in' });
    keep(marks);

    /* light across the title plate */
    var sweep = gsap.timeline({ repeat: -1, repeatDelay: 4.2, delay: 0.6 });
    sweep.set(dom.band, { xPercent: 0, opacity: 1 })
         .to(dom.band, { xPercent: 720, duration: 1.4, ease: 'power2.inOut' })
         .set(dom.band, { opacity: 0 });
    keep(sweep);

    /* stars twinkling, each on its own clock */
    dom.sparks.forEach(function (e) {
      gsap.set(e, { xPercent: -50, yPercent: -50, scale: 0.2, opacity: 0, rotation: -30 });
      var tl = gsap.timeline({ repeat: -1, repeatDelay: rnd(2, 6), delay: rnd(0, 4) });
      tl.to(e, { scale: 1, opacity: 1, rotation: 0, duration: 0.45, ease: 'power2.out' })
        .to(e, { scale: 0.2, opacity: 0, rotation: 30, duration: 0.6, ease: 'power2.in' });
      keep(tl);
    });

    /* the glint orbiting the ring, hidden where the plate and planet are */
    var e1x = Math.cos(RING.tilt), e1y = Math.sin(RING.tilt);
    var e2x = -Math.sin(RING.tilt), e2y = Math.cos(RING.tilt);
    function ramp(t, a, b, f) { return t < a || t > b ? 0 : Math.min(1, (t - a) / f, (b - t) / f); }
    var ring = { t: Math.PI };
    keep(gsap.to(ring, {
      t: -Math.PI, duration: 9, ease: 'none', repeat: -1,
      onUpdate: function () {
        var t = ring.t, c = Math.cos(t), s = Math.sin(t);
        var x = RING.cx + RING.a * c * e1x + RING.b * s * e2x;
        var y = RING.cy + RING.a * c * e1y + RING.b * s * e2y;
        var tt = t < 0 ? t + 2 * Math.PI : t;
        var o = Math.max(ramp(tt, 1.9, 2 * Math.PI - 2.85, 0.22), ramp(t, -1.0, 0.42, 0.22));
        var v = at(x, y);
        v.scale = 0.8 + 0.35 * s;
        v.opacity = o;
        gsap.set(dom.orb, v);
      }
    }));

    /* now and then, a shooting star */
    function meteor() {
      var m = METEORS[Math.floor(Math.random() * METEORS.length)];
      var a = m[0], b = m[1];
      var ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
      gsap.set(dom.meteorTail, { rotation: ang });
      var tl = gsap.timeline({ onComplete: function () { keep(gsap.delayedCall(rnd(4, 8), meteor)); } });
      tl.set(dom.meteor, Object.assign(at(a[0], a[1]), { opacity: 0 }))
        .to(dom.meteor, Object.assign(at(b[0], b[1]), { duration: 0.9, ease: 'power1.in' }))
        .to(dom.meteor, { opacity: 1, duration: 0.2, ease: 'power1.out' }, 0)
        .to(dom.meteor, { opacity: 0, duration: 0.3, ease: 'power1.in' }, 0.6);
      keep(tl);
    }
    keep(gsap.delayedCall(rnd(2, 4), meteor));
  }

  /* the picture fades in once it has decoded, settling as it lands */
  function arrive() {
    var img = dom.img;
    var ready = !img || (img.complete && img.naturalWidth)
      ? Promise.resolve()
      : new Promise(function (res) {
          img.addEventListener('load', res, { once: true });
          img.addEventListener('error', res, { once: true });
        }).then(function () { return img.decode ? img.decode().catch(function () {}) : null; });
    return ready;
  }

  function start() {
    if (!gsap || !build()) return;
    stop();
    running = true;
    if (reduced()) { gsap.set(dom.scene, { opacity: 1, scale: 1 }); return; }
    gsap.set(dom.scene, { opacity: 0, scale: 1.06, transformOrigin: '50% 55%' });
    arrive().then(function () {
      if (!running) return;
      dom.scene.style.willChange = 'transform, opacity';
      var intro = gsap.to(dom.scene, {
        opacity: 1, scale: 1, duration: 1.4, ease: 'power3.out',
        onComplete: function () { if (running) loops(); }
      });
      keep(intro);
    });
  }

  function stop() {
    running = false;
    live.forEach(function (a) { a.kill(); });
    live = [];
    if (!dom) return;
    dom.scene.style.willChange = '';
    gsap.set([dom.scene, dom.rig, dom.marks], { clearProps: 'transform,opacity' });
    gsap.set([dom.band, dom.orb, dom.meteor].concat(dom.sparks), { opacity: 0 });
  }

  global.WelcomeFX = { start: start, stop: stop };
})(window);
