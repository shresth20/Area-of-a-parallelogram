/* ==========================================================================
 * animations.js -- the beats this lesson is built out of, and its sound
 * --------------------------------------------------------------------------
 * Everything here returns a GSAP animation made through motion.js, so every
 * one is tracked: Skip lands them all on their last frame, and a Replay kills
 * them and hands back whatever they had written inline. Nothing in this file
 * decides WHEN it happens -- that is pages.js and the sections.
 *
 * Load order: js/motion.js -> js/flow.js -> js/para.js -> js/animations.js
 * ========================================================================== */
(function (global) {
  'use strict';

  var M = global.Motion;
  var P = global.Para;
  var NS = 'http://www.w3.org/2000/svg';

  /* ======================================================================
   * Sound
   * ====================================================================== */
  var CLIPS = {
    click:   'assets/audio/button-click.webm',
    correct: 'assets/audio/correct-answer.webm',
    wrong:   'assets/audio/incorrect-answer.webm',
    cheer:   'assets/audio/confetti-sound.webm'
  };
  var A = global.GameAudio;
  var live = Object.create(null);
  var RING_MS = { correct: 600, wrong: 600 };
  var rang = Object.create(null);

  function sfx(key) {
    var src = CLIPS[key];
    if (!src || !A || !M || !M.mayPlay(key)) return;
    if (live[key]) live[key].stop();
    var h = live[key] = A.play(src, { keep: true });
    h.done.then(function () { if (live[key] === h) live[key] = null; });
    rang[key] = performance.now();
  }
  function ringing() {
    var now = performance.now(), left = 0;
    Object.keys(RING_MS).forEach(function (k) {
      if (rang[k]) left = Math.max(left, rang[k] + RING_MS[k] - now);
    });
    return left;
  }
  var POP_GATE = 46;
  var popAt = 0;
  function pop() {
    var now = performance.now();
    if (!A || (M.isMuted && M.isMuted())) return;
    if (now - popAt < POP_GATE) return;
    popAt = now;
    A.play(CLIPS.click, { keep: true, volume: 0.3, rate: 0.94 + Math.random() * 0.2 });
  }

  /* ======================================================================
   * Strokes -- the dash trick
   * ====================================================================== */
  function pathLength(p) {
    try { return p.getTotalLength ? p.getTotalLength() : 0; } catch (e) { return 0; }
  }
  function stroke(tl, path, at, seconds, ease) {
    var len = pathLength(path) || 1;
    path.style.strokeDasharray = len + ' ' + len;
    path.style.strokeDashoffset = len;
    tl.to(path, { strokeDashoffset: 0, duration: M.dur(seconds), ease: ease || 'power2.out' }, M.gap(at));
  }
  function undash(paths) {
    paths.forEach(function (p) {
      if (!p || !p.style) return;
      p.style.strokeDasharray = '';
      p.style.strokeDashoffset = '';
    });
  }
  /* A line drawn from its start to its end. */
  function growLine(line, seconds, ease) {
    M.set(line, { opacity: 1 });
    var tl = M.timeline({ revert: function () { undash([line]); } });
    stroke(tl, line, 0, seconds || 0.5, ease || 'power2.out');
    return tl;
  }
  /* A DASHED line drawn out: the dash trick is itself a dash pattern, so
     the line is shown through a mask -- a solid, wider path over the same
     curve, stroked out -- and the mask comes off when it is whole. */
  var masks = 0;
  function dashedIn(line, seconds, ease) {
    var svg = line.ownerSVGElement;
    if (!svg) return growLine(line, seconds, ease);
    var defs = svg.querySelector('defs') || svg.insertBefore(document.createElementNS(NS, 'defs'), svg.firstChild);
    var id = 'dashMask' + (++masks);
    var mask = document.createElementNS(NS, 'mask');
    mask.setAttribute('id', id);
    mask.setAttribute('maskUnits', 'userSpaceOnUse');
    mask.setAttribute('x', -2000); mask.setAttribute('y', -2000);
    mask.setAttribute('width', 5000); mask.setAttribute('height', 5000);
    var cover = document.createElementNS(NS, 'path');
    cover.setAttribute('d', line.getAttribute('d'));
    cover.setAttribute('fill', 'none');
    cover.setAttribute('stroke', '#fff');
    cover.setAttribute('stroke-width', '14');
    cover.setAttribute('stroke-linecap', 'round');
    mask.appendChild(cover);
    defs.appendChild(mask);
    line.setAttribute('mask', 'url(#' + id + ')');
    M.set(line, { opacity: 1 });
    var tl = M.timeline({
      revert: function () {
        line.removeAttribute('mask');
        if (mask.parentNode) mask.parentNode.removeChild(mask);
      }
    });
    stroke(tl, cover, 0, seconds || 0.6, ease || 'power1.inOut');
    return tl;
  }

  /* ======================================================================
   * The board
   * ====================================================================== */
  function boardIn(board) {
    board.classList.add('is-animating', 'show');
    board.setAttribute('aria-hidden', 'false');
    var tl = M.timeline({
      willChange: board, willChangeValue: 'transform, opacity',
      revert: function () {
        M.set(board, { clearProps: 'opacity,transform' });
        board.classList.remove('is-animating');
      }
    });
    tl.fromTo(board, { opacity: 0, scale: 0.965, y: 14 },
                     { opacity: 1, scale: 1, y: 0, duration: M.dur(0.62), ease: 'power3.out' });
    return tl;
  }
  function boardOut(board) {
    board.classList.add('is-animating');
    var tl = M.timeline({
      willChange: board, willChangeValue: 'transform, opacity',
      revert: function () {
        board.classList.remove('show', 'is-animating');
        board.setAttribute('aria-hidden', 'true');
        M.set(board, { clearProps: 'opacity,transform' });
      }
    });
    tl.to(board, { opacity: 0, scale: 0.965, y: 14, duration: M.dur(0.5), ease: 'power2.in' });
    return tl;
  }

  /* ======================================================================
   * The shape
   * ====================================================================== */

  /* The shape made by a pen: a dot lands on the first corner and runs once
     round the outline, each side drawn behind it; then the colour is poured
     in. ONE eased stroke for the whole outline. */
  function drawShape(shape, opts) {
    var o = opts || {};
    var seconds = o.time || 1.4;
    var pts = shape.pts, n = shape.n;
    var total = 0, lens = [], ends = [], dash = [];
    for (var i = 0; i < n; i++) {
      lens.push(shape.len(i));
      total += lens[i];
      ends.push(total);
      dash.push(pathLength(shape.sides[i]) || lens[i] || 1);
    }
    var START = 0.26;
    var tip = shape.tip;
    M.set(tip, { opacity: 1, scale: 0, x: 0, y: 0, transformOrigin: 'center center' });
    var x0 = pts[0].x, y0 = pts[0].y;
    shape.sides.forEach(function (sd, k) {
      sd.style.strokeDasharray = dash[k] + ' ' + dash[k];
      sd.style.strokeDashoffset = dash[k];
    });
    M.set(shape.sides, { opacity: 1 });

    var pen = { d: 0 }, corner = 0;
    function draw() {
      var d = pen.d;
      for (var k = 0; k < n; k++) {
        var from = ends[k] - lens[k];
        var t = Math.max(0, Math.min(1, (d - from) / (lens[k] || 1)));
        shape.sides[k].style.strokeDashoffset = dash[k] * (1 - t);
      }
      var j = 0;
      while (j < n - 1 && d > ends[j]) j++;
      var a = pts[j], b = pts[(j + 1) % n];
      var f = Math.max(0, Math.min(1, (d - (ends[j] - lens[j])) / (lens[j] || 1)));
      M.set(tip, { x: a.x + (b.x - a.x) * f - x0, y: a.y + (b.y - a.y) * f - y0 });
      while (corner < n && d >= ends[corner] - 0.5) { corner++; pop(); }
    }
    var tl = M.timeline({
      revert: function () {
        undash(shape.sides);
        M.set(tip, { clearProps: 'transform,opacity' });
      }
    });
    tl.to(tip, { scale: 1, duration: M.dur(0.24), ease: M.POP }, 0);
    tl.call(pop, null, 0);
    tl.to(pen, { d: total, duration: M.dur(seconds), ease: o.ease || 'sine.inOut', onUpdate: draw }, M.gap(START));
    tl.to(tip, { scale: 0, opacity: 0, duration: M.dur(0.22), ease: 'power2.in' }, M.gap(START + seconds));
    if (o.fill !== false) tl.add(fillShape(shape), M.gap(START + seconds + 0.05));
    return tl;
  }
  /* The colour poured in, growing from the shape's own middle. */
  function fillShape(shape) {
    var c = shape.centre();
    var tl = M.timeline({ willChange: shape.fill, willChangeValue: 'transform, opacity' });
    tl.fromTo(shape.fill,
      { opacity: 0, scale: 0.82, svgOrigin: c.x + ' ' + c.y },
      { opacity: 1, scale: 1, duration: M.dur(0.5), ease: 'power2.out' });
    return tl;
  }
  /* The whole shape at once, for one that is not being watched. */
  function showShape(shape, opts) {
    var o = opts || {};
    var els = shape.sides.concat([shape.fill]);
    var tl = M.timeline({ willChange: els, willChangeValue: 'opacity' });
    tl.to(els, { opacity: 1, duration: M.dur(o.time || 0.4), ease: 'power2.out' });
    return tl;
  }
  function putShape(shape) {
    M.set(shape.sides.concat([shape.fill]), { opacity: 1 });
  }

  /* ---- marks arriving and leaving ----------------------------------------- */
  /* Words (or any marks) landing one after another, each with the pop. */
  function labelsIn(els, each) {
    var list = [].concat(els).filter(Boolean);
    var tl = M.timeline({ willChange: list, willChangeValue: 'transform, opacity' });
    list.forEach(function (t, i) {
      var at = i * (each == null ? 0.16 : each);
      M.set(t, { opacity: 0, scale: 0.6, transformOrigin: 'center center' });
      tl.to(t, { opacity: 1, scale: 1, duration: M.dur(0.34), ease: 'back.out(1.7)' }, M.gap(at));
      tl.call(pop, null, M.gap(at));
    });
    return tl;
  }
  function labelIn(t) { return labelsIn([t]); }
  function labelsOut(els) {
    var list = [].concat(els).filter(Boolean);
    var tl = M.timeline({ willChange: list, willChangeValue: 'opacity' });
    tl.to(list, { opacity: 0, duration: M.dur(0.26), ease: 'power2.in' });
    return tl;
  }
  /* Marks faded in together (a group, a path), or to a level. */
  function fadeIn(els, seconds, stagger) {
    var list = [].concat(els).filter(Boolean);
    var tl = M.timeline({ willChange: list, willChangeValue: 'opacity' });
    tl.to(list, { opacity: 1, duration: M.dur(seconds || 0.4), ease: 'power2.out', stagger: M.gap(stagger || 0) });
    return tl;
  }
  function fadeTo(els, alpha, seconds) {
    var list = [].concat(els).filter(Boolean);
    var tl = M.timeline({ willChange: list, willChangeValue: 'opacity' });
    tl.to(list, { opacity: alpha, duration: M.dur(seconds || 0.4), ease: 'power2.inOut' });
    return tl;
  }
  /* Marks left standing, taken off together and handed back to rest. */
  function marksOut(els) {
    var list = [].concat(els).filter(Boolean);
    var tl = M.timeline({
      willChange: list, willChangeValue: 'opacity',
      revert: function () { M.set(list, { clearProps: 'opacity' }); }
    });
    tl.to(list, { opacity: 0, duration: M.dur(0.3), ease: 'power2.in' });
    return tl;
  }

  /* ---- a line, lit -----------------------------------------------------------
     The line swells in its own ink under a bloom. A loop of unknown length,
     so a class, as every held light in the game is. */
  var LINE_W = 4, LINE_LIT_W = 7;
  function lightLine(line, opts) {
    var o = opts || {};
    var tl = M.timeline({ willChange: line, willChangeValue: 'stroke-width' });
    line.classList.add('is-lit');
    tl.to(line, { strokeWidth: LINE_LIT_W, autoRound: false, duration: M.dur(0.28), ease: 'power2.out' }, 0);
    if (o.label) {
      tl.fromTo(o.label, { scale: 1, transformOrigin: 'center center' },
        { scale: 1.22, duration: M.dur(0.22), ease: 'power2.out' }, 0)
        .to(o.label, { scale: 1, duration: M.dur(0.36), ease: M.POP }, M.gap(0.22));
    }
    return tl;
  }
  function unlightLine(line) {
    var tl = M.timeline({
      revert: function () { line.classList.remove('is-lit'); M.set(line, { clearProps: 'strokeWidth' }); }
    });
    tl.to(line, { strokeWidth: LINE_W, autoRound: false, duration: M.dur(0.3), ease: 'power2.out' }, 0);
    return tl;
  }
  function pulseHold(marks) {
    [].concat(marks).filter(Boolean).forEach(function (m) {
      m.classList.remove('is-pulsing');
      void m.getBoundingClientRect().width;
      m.style.setProperty('--pulse-times', 'infinite');
      m.classList.add('is-pulsing');
    });
  }
  function pulseRelease(marks) {
    var list = [].concat(marks).filter(Boolean);
    var tl = M.timeline({ revert: function () { M.set(list, { clearProps: 'strokeWidth' }); } });
    list.forEach(function (m) {
      var now = parseFloat(getComputedStyle(m).strokeWidth);
      m.classList.remove('is-pulsing');
      m.style.removeProperty('--pulse-times');
      var rest = parseFloat(getComputedStyle(m).strokeWidth);
      tl.fromTo(m, { strokeWidth: now }, { strokeWidth: rest, autoRound: false, duration: M.dur(0.4), ease: 'power2.out' }, 0);
    });
    return tl;
  }
  var PULSE_SECS = 1.05;
  function partPulse(marks, times, secs) {
    var list = [].concat(marks).filter(Boolean);
    var n = times || 2;
    function off() {
      list.forEach(function (m) { m.classList.remove('is-pulsing'); m.style.removeProperty('--pulse-times'); });
    }
    var tl = M.timeline({ revert: off });
    tl.call(function () {
      list.forEach(function (m) {
        m.classList.remove('is-pulsing');
        void m.getBoundingClientRect().width;
        m.style.setProperty('--pulse-times', String(n));
        m.classList.add('is-pulsing');
      });
    }, null, 0);
    tl.call(function () {}, null, M.gap((secs || PULSE_SECS) * n));
    return tl;
  }
  /* A word lit: the glow class for a couple of breaths. */
  function glowText(els, times) {
    var list = [].concat(els).filter(Boolean);
    var n = times || 2;
    function off() { list.forEach(function (m) { m.classList.remove('is-glowing'); m.style.removeProperty('--pulse-times'); }); }
    var tl = M.timeline({ revert: off });
    tl.call(function () {
      list.forEach(function (m) {
        m.classList.remove('is-glowing');
        void m.getBoundingClientRect().width;
        m.style.setProperty('--pulse-times', String(n));
        m.classList.add('is-glowing');
      });
    }, null, 0);
    tl.call(function () {}, null, M.gap(1.1 * n));
    return tl;
  }
  /* A class held on marks for a while, then taken off (a glow, a tint). */
  function holdClass(els, cls, seconds) {
    var list = [].concat(els).filter(Boolean);
    var tl = M.timeline({ revert: function () { list.forEach(function (m) { m.classList.remove(cls); }); } });
    tl.call(function () { list.forEach(function (m) { m.classList.add(cls); }); }, null, 0);
    tl.call(function () {}, null, M.gap(seconds || 1.5));
    return tl;
  }

  /* ---- points ----------------------------------------------------------------- */
  function dotIn(d) {
    M.set(d.g, { opacity: 1 });
    var tl = M.timeline({ revert: function () { M.set(d.core, { clearProps: 'transform' }); } });
    tl.fromTo(d.core, { scale: 0, transformOrigin: 'center center' },
      { scale: 1, duration: M.dur(0.34), ease: M.POP });
    tl.call(pop, null, 0);
    return tl;
  }
  function dotCall(d) { d.g.classList.add('is-calling'); }
  function dotStill(d) { d.g.classList.remove('is-calling'); }
  function dotOut(d) {
    d.g.classList.remove('is-calling');
    var tl = M.timeline({ willChange: d.g, willChangeValue: 'opacity' });
    tl.to(d.g, { opacity: 0, duration: M.dur(0.3), ease: 'power2.in' });
    return tl;
  }
  /* A point caught where it belongs: one pop. */
  function snapDot(core) {
    pop();
    var tl = M.timeline({ revert: function () { M.set(core, { clearProps: 'transform' }); } });
    tl.fromTo(core, { scale: 1, transformOrigin: 'center center' },
      { scale: 1.45, duration: M.dur(0.14), ease: 'power2.out' })
      .to(core, { scale: 1, duration: M.dur(0.36), ease: M.POP });
    return tl;
  }

  /* ---- the figure moved -------------------------------------------------- */
  /* The whole group carried somewhere, or scaled, as one thing. `origin`
     (figure units, "x y") is what a scale grows about. */
  function moveGroup(g, vars, seconds, ease, origin) {
    var tl = M.timeline({ willChange: g, willChangeValue: 'transform' });
    var v = Object.assign({ duration: M.dur(seconds || 0.7), ease: ease || 'power2.inOut' }, vars);
    if (origin) v.svgOrigin = origin;
    tl.to(g, v);
    return tl;
  }
  function slideGroup(g, x, y, seconds) {
    return moveGroup(g, { x: x, y: y || 0 }, seconds || 0.75);
  }
  /* The shape's points carried from where they are to `to`, every mark
     re-laid out each frame. */
  function morphShape(shape, to, seconds, ease) {
    var from = shape.pts.map(function (p) { return { x: p.x, y: p.y }; });
    var pen = { t: 0 };
    var tl = M.timeline({ revert: function () { pen.t = 1; shape.set(to); } });
    tl.to(pen, {
      t: 1, duration: M.dur(seconds || 1), ease: ease || 'power2.inOut',
      onUpdate: function () {
        shape.set(from.map(function (p, i) {
          return { x: p.x + (to[i].x - p.x) * pen.t, y: p.y + (to[i].y - p.y) * pen.t };
        }));
      }
    });
    return tl;
  }

  /* ---- the cut ------------------------------------------------------------------
     A bright head runs down the height from top to foot leaving a dashed
     trace; then the triangle on one side takes the cut colour and steps
     aside by `dx`. `line` is the height, `head` the scissors' dot, `cut`
     the dashed trace, `tri` the triangle's path. */
  function scissor(o) {
    var top = o.top, foot = o.foot;
    M.set(o.head, { opacity: 1, scale: 0, transformOrigin: 'center center', x: 0, y: 0 });
    o.head.setAttribute('cx', top.x); o.head.setAttribute('cy', top.y);
    o.cut.setAttribute('d', P.seg(top, foot));
    var tl = M.timeline({ revert: function () { undash([o.cut]); M.set(o.head, { clearProps: 'transform,opacity' }); } });
    tl.to(o.head, { scale: 1, duration: M.dur(0.2), ease: M.POP }, 0);
    tl.call(pop, null, 0);
    var run = { t: 0 };
    tl.to(run, { t: 1, duration: M.dur(o.seconds || 0.4), ease: 'power1.inOut',
      onUpdate: function () { M.set(o.head, { x: (foot.x - top.x) * run.t, y: (foot.y - top.y) * run.t }); } }, M.gap(0.2));
    M.set(o.cut, { opacity: 1 });
    stroke(tl, o.cut, 0.2, o.seconds || 0.4, 'power1.inOut');
    tl.to(o.head, { scale: 0, opacity: 0, duration: M.dur(0.2), ease: 'power2.in' }, M.gap(0.2 + (o.seconds || 0.4)));
    tl.to(o.cut, { opacity: 0, duration: M.dur(0.3), ease: 'power2.in' }, M.gap(0.5 + (o.seconds || 0.4)));
    return tl;
  }
  /* The triangle stepping aside from the cut: a translate, so its shape
     plainly stays the same. */
  function stepAside(el, dx, dy, seconds) {
    var tl = M.timeline({ willChange: el, willChangeValue: 'transform' });
    tl.to(el, { x: dx, y: dy || 0, duration: M.dur(seconds || 0.5), ease: 'power2.inOut' });
    return tl;
  }
  /* A piece caught by the place it belongs: snapped there, with the chime. */
  function snapTo(el, x, y, seconds) {
    pop();
    var tl = M.timeline({ willChange: el, willChangeValue: 'transform' });
    tl.to(el, { x: x, y: y, duration: M.dur(seconds || 0.2), ease: M.SNAP, overwrite: 'auto' });
    return tl;
  }
  /* ...or let go elsewhere: back to where it was, of its own accord. */
  function slideHome(el, x, y) {
    return M.to(el, { x: x, y: y, duration: M.dur(0.4), ease: 'power3.out', overwrite: 'auto' });
  }
  /* An outline lit once: a stroke over the shape that brightens and fades. */
  function glowOnce(path) {
    M.set(path, { opacity: 0 });
    var tl = M.timeline({ willChange: path, willChangeValue: 'opacity' });
    tl.to(path, { opacity: 1, duration: M.dur(0.3), ease: 'power2.out' })
      .to(path, { opacity: 0, duration: M.dur(0.6), ease: 'power2.in' }, M.gap(0.6));
    return tl;
  }

  /* ---- right and wrong on the figure ------------------------------------------
     A target refused: it turns soft amber and shakes its head once, and
     holds the amber for a beat before it is a plain mark again. A target
     answered: green (a class it stays in) and one outward pulse. */
  var SHAKE = [-5, 5, -5, 5, -4, 4, 0];
  function shake(tl, el, seconds, origin) {
    var each = M.dur(seconds || 0.3) / SHAKE.length;
    SHAKE.forEach(function (x, i) {
      tl.to(el, { x: x, duration: each, ease: i === SHAKE.length - 1 ? 'power2.out' : 'none' });
    });
  }
  function markWrong(el, hold) {
    el.classList.remove('is-over');
    el.classList.add('is-wrong');
    sfx('wrong');
    /* The amber is a state the caller takes off once the reason has been
       said (see tapOn in pages.js); only the shake is handed back here. */
    var tl = M.timeline({
      willChange: el, willChangeValue: 'transform',
      revert: function () { M.set(el, { clearProps: 'transform' }); }
    });
    shake(tl, el);
    tl.to({}, { duration: M.dur(hold == null ? 0.6 : hold) });
    return tl;
  }
  function markRight(el, origin) {
    el.classList.remove('is-wrong', 'is-over');
    el.classList.add('is-right');
    sfx('correct');
    var tl = M.timeline({ revert: function () { M.set(el, { clearProps: 'transform' }); } });
    var v = { scale: 1.06, duration: M.dur(0.14), ease: 'power2.out' };
    if (origin) v.svgOrigin = origin; else v.transformOrigin = 'center center';
    tl.to(el, v).to(el, { scale: 1, duration: M.dur(0.36), ease: M.POP });
    return tl;
  }

  /* ---- the names in the tray, and the answers ----------------------------- */
  function trayIn(tray, chips) {
    tray.removeAttribute('hidden');
    var tl = M.timeline({ willChange: chips, willChangeValue: 'transform, opacity' });
    tl.fromTo(chips, { opacity: 0, y: 14, scale: 0.9 },
      { opacity: 1, y: 0, scale: 1, duration: M.dur(0.36), ease: M.POP, stagger: M.gap(0.08) });
    return tl;
  }
  function trayOut(tray, chips) {
    var tl = M.timeline({
      willChange: chips, willChangeValue: 'transform, opacity',
      revert: function () { tray.setAttribute('hidden', ''); }
    });
    if (chips.length) tl.to(chips, { opacity: 0, y: 10, duration: M.dur(0.26), ease: 'power2.in', stagger: M.gap(0.03) });
    return tl;
  }
  function choiceRight(btn) {
    btn.classList.remove('is-wrong');
    btn.classList.add('is-right');
    sfx('correct');
    return M.correct(btn);
  }
  function choiceWrong(btn) {
    btn.classList.add('is-wrong');
    sfx('wrong');
    return M.incorrect(btn);
  }
  /* The answers under the bird, one by one. */
  function optsIn(list) {
    M.set(list, { opacity: 0 });
    var tl = M.timeline({ willChange: list, willChangeValue: 'transform, opacity' });
    tl.fromTo(list, { opacity: 0, y: 14, scale: 0.9 },
      { opacity: 1, y: 0, scale: 1, duration: M.dur(0.4), ease: M.POP, stagger: M.gap(0.3) });
    return tl;
  }
  function optsOut(list) {
    var tl = M.timeline({ willChange: list, willChangeValue: 'transform, opacity' });
    if (list.length) tl.to(list, { opacity: 0, y: 10, scale: 0.94, duration: M.dur(0.3), ease: 'power2.in', stagger: M.gap(0.08) });
    return tl;
  }
  function chipHome(chip) {
    return M.to(chip, { x: 0, y: 0, scale: 1, duration: M.dur(0.36), ease: 'power3.out', overwrite: 'auto' });
  }

  /* ---- cards and rows in the DOM layer ----------------------------------- */
  function cardIn(el, vars) {
    var tl = M.timeline({ willChange: el, willChangeValue: 'transform, opacity' });
    tl.fromTo(el, { opacity: 0, y: 14, scale: 0.96 },
      Object.assign({ opacity: 1, y: 0, scale: 1, duration: M.dur(0.42), ease: 'power3.out' }, vars || {}));
    return tl;
  }
  function cardsIn(els, each) {
    var list = [].concat(els).filter(Boolean);
    var tl = M.timeline({ willChange: list, willChangeValue: 'transform, opacity' });
    tl.fromTo(list, { opacity: 0, y: 14, scale: 0.96 },
      { opacity: 1, y: 0, scale: 1, duration: M.dur(0.42), ease: 'power3.out', stagger: M.gap(each == null ? 0.12 : each) });
    return tl;
  }
  function cardOut(els) {
    var list = [].concat(els).filter(Boolean);
    var tl = M.timeline({ willChange: list, willChangeValue: 'transform, opacity' });
    if (list.length) tl.to(list, { opacity: 0, y: -8, duration: M.dur(0.26), ease: 'power2.in', stagger: M.gap(0.03) });
    return tl;
  }
  function rowIn(el) {
    var tl = M.timeline({ willChange: el, willChangeValue: 'transform, opacity' });
    tl.fromTo(el, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: M.dur(0.34), ease: 'power3.out' });
    return tl;
  }
  /* The rule, set down as a plate: rises and settles. */
  function ruleIn(el) {
    var tl = M.timeline({ willChange: el, willChangeValue: 'transform, opacity' });
    tl.fromTo(el, { opacity: 0, y: 14, scale: 0.8 }, { opacity: 1, y: 0, scale: 1, duration: M.dur(0.48), ease: 'back.out(1.6)' });
    tl.call(pop, null, 0);
    return tl;
  }
  /* A card lit for a beat (a hint pointing at it). */
  function cardLit(el, seconds) {
    var tl = M.timeline({ revert: function () { el.classList.remove('is-lit'); } });
    tl.call(function () { el.classList.add('is-lit'); }, null, 0);
    tl.call(function () {}, null, M.gap(seconds || 1.6));
    return tl;
  }
  /* A word in a line swapped for another in place: the old one shrinks
     away, the new one pops up where it stood. */
  function swapWord(el, text) {
    var tl = M.timeline({ willChange: el, willChangeValue: 'transform, opacity' });
    tl.to(el, { opacity: 0, scale: 0.6, duration: M.dur(0.2), ease: 'power2.in' })
      .call(function () { el.textContent = text; })
      .to(el, { opacity: 1, scale: 1, duration: M.dur(0.34), ease: 'back.out(1.7)' });
    tl.call(pop, null, M.gap(0.2));
    return tl;
  }
  function emphasise(el) { return M.correct(el); }

  /* ======================================================================
   * Clearing up
   * ====================================================================== */
  function clearFigure(parts) {
    var list = [].concat(parts).filter(Boolean);
    var tl = M.timeline({ willChange: list, willChangeValue: 'opacity' });
    if (list.length) tl.to(list, { opacity: 0, duration: M.dur(0.36), ease: 'power2.in', stagger: M.gap(0.03) });
    return tl;
  }

  /* ======================================================================
   * Text boxes and controls
   * ====================================================================== */
  var TAIL_X = 0.78 + 0.76 / 2;
  var TAIL_BORDER = 4;
  function tailOrigin(bubble) {
    var style = getComputedStyle(bubble);
    if (bubble.classList.contains('bubble--perch')) {
      var tail = bubble.querySelector('.bubble-tail');
      if (tail) {
        var ts = getComputedStyle(tail);
        return (parseFloat(style.borderLeftWidth) + parseFloat(ts.left) + parseFloat(ts.width) / 2) + 'px 100%';
      }
    }
    var em = parseFloat(style.fontSize) || 16;
    return (TAIL_BORDER + em * TAIL_X) + 'px 100%';
  }
  function bubbleArm(bubble) {
    bubble.removeAttribute('hidden');
    M.set(bubble, { opacity: 0, scale: 0.15, transformOrigin: tailOrigin(bubble) });
  }
  function bubbleIn(bubble) {
    var tl = M.timeline({ willChange: bubble, willChangeValue: 'transform, opacity' });
    tl.to(bubble, { opacity: 1, scale: 1, transformOrigin: tailOrigin(bubble), duration: M.dur(0.44), ease: 'back.out(1.6)' });
    return tl;
  }
  function bubbleOut(bubble) {
    var tl = M.timeline({
      willChange: bubble, willChangeValue: 'transform, opacity',
      revert: function () { bubble.setAttribute('hidden', ''); M.set(bubble, { clearProps: 'opacity,transform' }); }
    });
    tl.to(bubble, { opacity: 0, scale: 0.9, transformOrigin: tailOrigin(bubble), duration: M.dur(0.24), ease: 'power2.in' });
    return tl;
  }

  /* The mascot's jump: down from the apex onto its spot, squashed on
     landing and recovering; and a crouch and a spring back up to the apex. */
  function landOn(el, from) {
    var fall = Math.min(0.76, 0.32 + Math.abs(from) * 0.0005);
    var tl = M.timeline({ willChange: el, willChangeValue: 'transform' });
    tl.to(el, { y: 0, scaleX: 1.06, scaleY: 0.92, duration: M.dur(fall * 0.8), ease: 'power2.in' })
      .to(el, { scaleX: 1, scaleY: 1, duration: M.dur(fall * 0.2), ease: 'power2.out' });
    return tl;
  }
  function springOff(el, y) {
    var dip = el.getBoundingClientRect().height * 0.06;
    var tl = M.timeline({ willChange: el, willChangeValue: 'transform' });
    tl.to(el, { y: dip, scaleX: 1.06, scaleY: 0.92, duration: M.dur(0.14), ease: 'power2.in' })
      .to(el, { y: y, scaleX: 1, scaleY: 1, duration: M.dur(0.42), ease: 'power2.out' });
    return tl;
  }
  /* The bird leaving centre stage before the board opens: a crouch, then a
     hop up and away as it fades. */
  function heroOut(el) {
    var lift = el.getBoundingClientRect().height * 0.16;
    var tl = M.timeline({
      willChange: el, willChangeValue: 'transform, opacity',
      revert: function () {
        el.classList.add('is-away');
        M.set(el, { clearProps: 'opacity,transform,transformOrigin' });
      }
    });
    M.set(el, { transformOrigin: '50% 100%' });
    tl.to(el, { scaleX: 1.06, scaleY: 0.92, duration: M.dur(0.12), ease: 'power2.in' })
      .to(el, { y: -lift, scaleX: 0.9, scaleY: 0.9, opacity: 0, duration: M.dur(0.32), ease: 'power2.in' });
    return tl;
  }

  function lineOut(line) {
    var tl = M.timeline({ willChange: line, willChangeValue: 'transform, opacity' });
    tl.to(line, { opacity: 0, y: -8, filter: 'blur(3px)', duration: M.dur(0.28), ease: 'power2.in' });
    return tl;
  }
  function controlIn(btn) {
    btn.removeAttribute('hidden');
    var tl = M.timeline({ willChange: btn, willChangeValue: 'transform, opacity' });
    tl.fromTo(btn, { opacity: 0, scale: 0.7, y: 10 }, { opacity: 1, scale: 1, y: 0, duration: M.dur(0.38), ease: 'back.out(1.6)' });
    return tl;
  }
  function controlOut(btn) {
    var tl = M.timeline({
      willChange: btn, willChangeValue: 'transform, opacity',
      revert: function () { btn.setAttribute('hidden', ''); M.set(btn, { clearProps: 'transform,opacity' }); }
    });
    tl.to(btn, { opacity: 0, scale: 0.8, duration: M.dur(0.2), ease: 'power2.in', overwrite: 'auto' });
    return tl;
  }
  function welcomeOut(welcome, title, start, extra) {
    var tl = M.timeline({
      willChange: [title, start], willChangeValue: 'transform, opacity',
      revert: function () { welcome.setAttribute('hidden', ''); }
    });
    start.classList.remove('in');
    tl.to([title, start].concat(extra || []), { opacity: 0, y: -14, scale: 0.94, duration: M.dur(0.3), ease: 'power2.in', stagger: M.gap(0.05) }, 0);
    tl.to(welcome, { opacity: 0, duration: M.dur(0.34), ease: 'power2.in' }, 0.08);
    return tl;
  }

  /* ======================================================================
   * Confetti
   * ====================================================================== */
  var BURST_N = 14;
  var HUES = ['cyan', 'lime', 'orange', 'purple', 'teal'];
  function confetti(host, x, y) {
    var bits = [];
    for (var i = 0; i < BURST_N; i++) {
      var round = i % 3 === 0;
      var size = 5 + Math.random() * 4;
      var e = document.createElementNS(NS, round ? 'circle' : 'rect');
      e.setAttribute('class', 'qz-bit qz-bit--' + HUES[i % HUES.length]);
      if (round) { e.setAttribute('cx', x); e.setAttribute('cy', y); e.setAttribute('r', size / 2); }
      else { e.setAttribute('x', x - size / 2); e.setAttribute('y', y - size * 0.3); e.setAttribute('width', size); e.setAttribute('height', size * 0.6); e.setAttribute('rx', 1); }
      host.appendChild(e);
      bits.push(e);
    }
    var tl = M.timeline({ revert: function () { bits.forEach(function (b) { if (b.parentNode) b.parentNode.removeChild(b); }); } });
    if (M.reducedMotion()) return tl;
    bits.forEach(function (b, i) {
      var ang = (i / BURST_N) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
      var d = 58 + Math.random() * 52;
      var dx = Math.cos(ang) * d, dy = -Math.abs(Math.sin(ang)) * d * 0.9 - 14;
      M.set(b, { transformOrigin: 'center center' });
      tl.to(b, { x: dx, y: dy, rotation: (Math.random() - 0.5) * 540, duration: M.dur(0.55), ease: 'power2.out' }, 0)
        .to(b, { y: dy + 36 + Math.random() * 20, duration: M.dur(0.5), ease: 'power1.in' }, M.gap(0.5))
        .to(b, { opacity: 0, scale: 0.5, duration: M.dur(0.4), ease: 'power2.in' }, M.gap(0.62));
    });
    return tl;
  }
  var RAIN_N = 34;
  var RAIN_HUES = ['cyan', 'lime', 'orange', 'purple', 'teal', 'white'];
  function confettiRain(host) {
    var layer = document.createElement('div');
    layer.className = 'confetti';
    layer.setAttribute('aria-hidden', 'true');
    host.appendChild(layer);
    var remove = function () { if (layer.parentNode) layer.parentNode.removeChild(layer); };
    var w = layer.clientWidth, h = layer.clientHeight;
    if (M.reducedMotion() || !w || !h) { remove(); return M.timeline(); }
    var bits = [], plan = [];
    for (var i = 0; i < RAIN_N; i++) {
      var e = document.createElement('span');
      e.className = 'confetti__bit confetti__bit--' + RAIN_HUES[i % RAIN_HUES.length] + (i % 3 === 0 ? ' confetti__bit--round' : '');
      layer.appendChild(e);
      bits.push(e);
      plan.push({ x: (i + Math.random()) / RAIN_N * w, sway: (Math.random() - 0.5) * 70,
                  drop: h * (0.5 + Math.random() * 0.35), turn: (Math.random() - 0.5) * 720,
                  delay: Math.random() * 0.4, fall: 1.5 + Math.random() * 0.7 });
    }
    var tl = M.timeline({ willChange: bits, revert: remove });
    bits.forEach(function (b, n) {
      var p = plan[n];
      M.set(b, { x: p.x, y: -16, rotation: p.turn / 4, opacity: 1 });
      tl.to(b, { y: p.drop, duration: M.dur(p.fall), ease: 'power1.in' }, M.gap(p.delay))
        .to(b, { x: p.x + p.sway, rotation: p.turn, duration: M.dur(p.fall), ease: 'sine.inOut' }, M.gap(p.delay))
        .to(b, { opacity: 0, duration: M.dur(p.fall * 0.4), ease: 'power2.in' }, M.gap(p.delay + p.fall * 0.6));
    });
    return tl;
  }

  global.Beats = {
    sfx: sfx, pop: pop, ringing: ringing,
    sounds: function () { return Object.keys(CLIPS).map(function (k) { return CLIPS[k]; }); },
    stroke: stroke, undash: undash, pathLength: pathLength, growLine: growLine, dashedIn: dashedIn,
    boardIn: boardIn, boardOut: boardOut,
    drawShape: drawShape, fillShape: fillShape, showShape: showShape, putShape: putShape,
    labelsIn: labelsIn, labelIn: labelIn, labelsOut: labelsOut, fadeIn: fadeIn, fadeTo: fadeTo, marksOut: marksOut,
    lightLine: lightLine, unlightLine: unlightLine, pulseHold: pulseHold, pulseRelease: pulseRelease, partPulse: partPulse,
    glowText: glowText, holdClass: holdClass,
    dotIn: dotIn, dotCall: dotCall, dotStill: dotStill, dotOut: dotOut, snapDot: snapDot,
    moveGroup: moveGroup, slideGroup: slideGroup, morphShape: morphShape,
    scissor: scissor, stepAside: stepAside, snapTo: snapTo, slideHome: slideHome, glowOnce: glowOnce,
    shake: shake, markWrong: markWrong, markRight: markRight,
    trayIn: trayIn, trayOut: trayOut, choiceRight: choiceRight, choiceWrong: choiceWrong,
    optsIn: optsIn, optsOut: optsOut, chipHome: chipHome,
    cardIn: cardIn, cardsIn: cardsIn, cardOut: cardOut, rowIn: rowIn, ruleIn: ruleIn, cardLit: cardLit, swapWord: swapWord, emphasise: emphasise,
    clearFigure: clearFigure,
    bubbleArm: bubbleArm, bubbleIn: bubbleIn, bubbleOut: bubbleOut,
    landOn: landOn, springOff: springOff, heroOut: heroOut,
    lineOut: lineOut, controlIn: controlIn, controlOut: controlOut, welcomeOut: welcomeOut,
    confetti: confetti, confettiRain: confettiRain
  };
})(window);
