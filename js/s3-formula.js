/* ==========================================================================
 * s3-formula.js -- discovering the formula
 * --------------------------------------------------------------------------
 * Three pages:
 *   1. the explanation, acted out as the bird says it -- the board is
 *      cleared and a new parallelogram is drawn on the left; a light copy of
 *      it slides to the right, its triangle is cut off and slides across,
 *      and the copy becomes the rectangle. Then the matching parts, a pair
 *      at a time, each lit and named the moment it is said:
 *        height (parallelogram)  =  breadth (rectangle)   -- orange
 *        base   (parallelogram)  =  length  (rectangle)   -- teal
 *      Next appears once it is all said.
 *   2. the area of the parallelogram -- the rectangle goes, the
 *      parallelogram stays on the left, and the bird perches on the right
 *      and asks in its bubble; three answers under it (shuffled). A wrong
 *      pick is answered in one short line (the bubble amber), the right one
 *      too (the bubble green); then Next.
 *   3. the area of the rectangle -- the parallelogram goes, the rectangle
 *      comes in on the left, and the bird asks again the same way; then
 *      Next, on to the height.
 * ========================================================================== */
(function (global) {
  'use strict';

  var Flow = global.Flow, Beats = global.Beats, Pages = global.Pages, P = global.Para, M = global.Motion;
  if (!Pages || !Pages.addSection) { console.error('s3-formula.js: load js/pages.js first.'); return; }
  var K = Pages.kit;
  function T(k, r) { return global.T ? global.T(k, r) : k; }
  var BEAT = K.BEAT, SHORT = K.SHORT;

  /* ---- the layout: both shapes larger than the cut left them ----------------
     The parallelogram A(0,0) B(6,0) C(8,3) D(2,3) cm on the left, the 6 by 3
     rectangle on the right, both at KF figure units per cm, standing on the
     same line so their heights read level. Once the bird perches on the
     right half, the rectangle is asked about from the left: its left side
     at RECT_LEFT, where the parallelogram's stood. */
  var KF = 48;
  var BOTTOM = 270;
  var PARA_O = { x: 64, y: BOTTOM };
  var RECT_X = 560;            /* the rectangle's left side                       */
  var RECT_LEFT = PARA_O.x;    /* ...and where it is asked about                  */
  var COPY_ALPHA = 0.5;        /* the light copy that becomes the rectangle       */

  var group = null;
  var para = null, rect = null, pts = null, rpts = null, F = null;
  var paraG = null, copyG = null, rectG = null, rectGlow = null;
  var copyTri = null, cutLine = null, shiftX = 0, baseLen = 0;
  /* the four matching parts: { ink, glow, label, ra?, dashed? } */
  var part = {};

  function build() {
    group = document.getElementById('figFormula');
  }

  /* A soft glow laid along a line, under its ink: the highlight. Faded in
     and out by opacity alone. */
  function glowAlong(host, a, b, cls) {
    return P.el('path', { 'class': 'pg__glowline ' + cls, d: P.seg(a, b) }, host);
  }

  /* Everything the explanation shows, built hidden: the parallelogram, the
     light copy (its rest and its triangle) laid over it, the rectangle the
     copy becomes, and the four parts with their glows and names. */
  function buildFigures() {
    if (para) return;
    group.removeAttribute('hidden');
    paraG = P.el('g', { 'class': 'pg-explain-para' }, group);
    copyG = P.el('g', { 'class': 'pg-explain-copy' }, group);
    rectG = P.el('g', { 'class': 'pg-explain-rect' }, group);

    /* the parallelogram */
    pts = P.cm(P.MAIN.cm, PARA_O, KF);
    var A = pts[0], B = pts[1], C = pts[2], D = pts[3];
    F = { x: D.x, y: A.y };
    baseLen = B.x - A.x;
    shiftX = RECT_X - F.x;
    para = P.build(paraG, pts, {});

    /* the light copy: the piece that stays, and the triangle that moves */
    var rest = P.el('path', { 'class': 'pg__tri is-blue', d: P.pathOf([F, B, C, D]) }, copyG);
    copyTri = P.el('path', { 'class': 'pg__tri is-blue', d: P.pathOf([A, D, F]) }, copyG);
    cutLine = P.el('path', { 'class': 'pg__cut', d: P.seg(D, F) }, copyG);
    M.set([rest, copyTri], { opacity: COPY_ALPHA });
    M.set(copyG, { opacity: 0 });

    /* the rectangle the copy turns into */
    rpts = [{ x: RECT_X, y: BOTTOM }, { x: RECT_X + baseLen, y: BOTTOM },
            { x: RECT_X + baseLen, y: D.y }, { x: RECT_X, y: D.y }];
    rect = P.build(rectG, rpts, {});
    rectGlow = P.el('path', { 'class': 'pg__outline', d: P.pathOf(rpts) }, rectG);
    rectGlow.style.filter = 'url(#partGlow)';

    /* the parallelogram's parts: its height (dashed, with the right-angle
       marker) and its base */
    var midH = (D.y + F.y) / 2;
    part.base = {
      glow: glowAlong(paraG, A, B, 'is-teal'),
      ink: P.el('path', { 'class': 'pg__side is-base', d: P.seg(A, B) }, paraG),
      label: P.label(paraG, T('lblBaseLower'), { cls: 'is-teal is-italic', at: { x: P.mid(A, B).x, y: BOTTOM + 30 } })
    };
    var hGlow = glowAlong(paraG, D, F, 'is-orange');
    var h = P.height(paraG, D, A, B, { raCls: 'is-orange' });
    part.height = {
      glow: hGlow, ink: h.line, ra: h.ra, dashed: true,
      label: P.label(paraG, T('lblHeightLower'), { cls: 'is-orange is-italic', at: { x: F.x + 14, y: midH }, anchor: 'start' })
    };

    /* the rectangle's parts: its length along the bottom, its breadth up
       the right side (the side the moved triangle brings) */
    part.length = {
      glow: glowAlong(rectG, rpts[0], rpts[1], 'is-teal'),
      ink: P.el('path', { 'class': 'pg__side is-base', d: P.seg(rpts[0], rpts[1]) }, rectG),
      label: P.label(rectG, T('lblLength'), { cls: 'is-teal is-italic', at: { x: P.mid(rpts[0], rpts[1]).x, y: BOTTOM + 30 } })
    };
    part.breadth = {
      glow: glowAlong(rectG, rpts[2], rpts[1], 'is-orange'),
      ink: P.el('path', { 'class': 'pg__side is-orange', d: P.seg(rpts[2], rpts[1]) }, rectG),
      label: P.label(rectG, T('lblBreadth'), { cls: 'is-orange is-italic', at: { x: rpts[1].x + 14, y: midH }, anchor: 'start' })
    };
  }

  /* The previous section's picture, taken away before the new one is drawn. */
  function clearCut() {
    var cutG = document.getElementById('figCut');
    if (!cutG || cutG.hasAttribute('hidden') || !cutG.childNodes.length) {
      if (cutG) { cutG.setAttribute('hidden', ''); cutG.textContent = ''; }
      return Promise.resolve();
    }
    return Flow.anim(Beats.clearFigure([cutG])).then(function () {
      cutG.setAttribute('hidden', '');
      cutG.textContent = '';
      M.set(cutG, { clearProps: 'opacity' });
    });
  }

  /* ---- the copy becomes the rectangle ------------------------------------- */
  /* A light copy lifts off the parallelogram and slides to the right. */
  function copySlide() {
    var tl = M.timeline({ willChange: copyG, willChangeValue: 'transform, opacity' });
    tl.fromTo(copyG, { opacity: 0, x: 0 }, { opacity: 1, duration: M.dur(0.35), ease: 'power2.out' })
      .to(copyG, { x: shiftX, duration: M.dur(1.0), ease: 'power2.inOut' });
    return tl;
  }
  /* The cut runs down the copy's height; the triangle turns a bright orange
     (the rest of the copy stays light) and steps away from it. */
  function cutTriangle() {
    var tl = M.timeline({ willChange: copyTri, willChangeValue: 'transform, opacity' });
    tl.add(Beats.dashedIn(cutLine, 0.45), 0);
    tl.call(function () { copyTri.classList.remove('is-blue'); }, null, M.gap(0.4));
    tl.to(copyTri, { opacity: 0.9, duration: M.dur(0.3), ease: 'power2.out' }, M.gap(0.4));
    tl.to(copyTri, { x: -12, duration: M.dur(0.3), ease: 'power2.out' }, M.gap(0.5));
    return tl;
  }
  /* The triangle slides across to the other end; the copy is a rectangle
     now, and the rectangle itself fades in over it. */
  function moveTriangle() {
    var tl = M.timeline({ willChange: copyTri, willChangeValue: 'transform' });
    tl.to(cutLine, { opacity: 0, duration: M.dur(0.25), ease: 'power2.in' }, 0);
    tl.to(copyTri, { x: baseLen, duration: M.dur(1.0), ease: 'power2.inOut' }, 0);
    tl.call(Beats.pop, null, M.gap(1.0));
    tl.call(function () { copyTri.classList.add('is-blue'); }, null, M.gap(1.0));
    return tl;
  }
  function formRect() {
    var els = rect.sides.concat([rect.fill]);
    var tl = M.timeline({ willChange: els.concat([copyG]), willChangeValue: 'opacity' });
    tl.to(els, { opacity: 1, duration: M.dur(0.5), ease: 'power2.out' }, 0);
    tl.to(copyG, { opacity: 0, duration: M.dur(0.5), ease: 'power2.in' }, 0);
    tl.add(Beats.glowOnce(rectGlow), M.gap(0.25));
    return tl;
  }

  /* ---- a part lit and named ------------------------------------------------ */
  /* Its ink traced along it, the glow rising under it, its name popping in. */
  function lightPart(pt) {
    var tl = M.timeline({ willChange: pt.glow, willChangeValue: 'opacity' });
    tl.add(pt.dashed ? Beats.dashedIn(pt.ink, 0.6) : Beats.growLine(pt.ink, 0.6), 0);
    if (pt.ra) tl.add(Beats.growLine(pt.ra, 0.3), M.gap(0.5));
    tl.to(pt.glow, { opacity: 1, duration: M.dur(0.4), ease: 'power2.out' }, M.gap(0.15));
    tl.add(Beats.labelIn(pt.label), M.gap(0.3));
    return tl;
  }
  /* The parts of a pair breathing together: these match. */
  function pulsePair(pts2) {
    var glows = pts2.map(function (p) { return p.glow; });
    var labels = pts2.map(function (p) { return p.label; });
    var tl = M.timeline({ willChange: glows.concat(labels), willChangeValue: 'transform, opacity' });
    tl.fromTo(glows, { opacity: 1 }, { opacity: 0.3, duration: M.dur(0.35), ease: 'sine.inOut', yoyo: true, repeat: 3 }, 0);
    tl.to(labels, { scale: 1.15, transformOrigin: 'center center', duration: M.dur(0.35), ease: 'sine.inOut', yoyo: true, repeat: 3 }, 0);
    return tl;
  }
  /* A pair's glow put away: the colour and the names stay. */
  function settle(pts2) {
    var glows = pts2.map(function (p) { return p.glow; });
    var tl = M.timeline({ willChange: glows, willChangeValue: 'opacity' });
    tl.to(glows, { opacity: 0, duration: M.dur(0.35), ease: 'power2.in' });
    return tl;
  }
  /* Parts pointed at for a beat: they breathe, then rest again. */
  function pointAt(list) {
    return Flow.anim(pulsePair(list)).then(function () { return Flow.anim(settle(list)); });
  }
  /* One line of the bird's, and a pair lit as each of its two words is said. */
  function sayPair(key, first, firstWord, second, secondWord) {
    var a = K.onPhrase(key, firstWord, function () { return Flow.anim(lightPart(first)); });
    var b = K.onPhrase(key, secondWord, function () {
      return a.then(function () { return Flow.anim(lightPart(second)); });
    });
    return Promise.all([K.say(key), a, b])
      .then(function () { return Flow.anim(pulsePair([first, second])); });
  }

  /* ---- page 1: the explanation ---------------------------------------------- */
  function pageExplain() {
    return Promise.all([clearCut(), K.lineAway()])
      .then(function () {
        buildFigures();
        return Flow.anim(Beats.drawShape(para, { time: 1.2 }));
      })
      .then(function () { return Flow.wait(SHORT); })
      /* "Let's move the triangle to make a rectangle." -- the copy slides
         right as the line begins, is cut on "triangle", and the triangle
         moves on "rectangle" */
      .then(function () {
        var slid = K.onPhrase('f1Make', '', function () { return Flow.anim(copySlide()); });
        var cut = K.onPhrase('f1Make', 'triangle', function () {
          return slid.then(function () { return Flow.anim(cutTriangle()); });
        });
        var moved = K.onPhrase('f1Make', 'rectangle', function () {
          return cut.then(function () { return Flow.anim(moveTriangle()); })
            .then(function () { return Flow.anim(formRect()); });
        });
        return Promise.all([K.say('f1Make'), slid, cut, moved]);
      })
      .then(function () { return Flow.wait(BEAT); })
      /* height = breadth */
      .then(function () { return sayPair('f1Height', part.height, 'height', part.breadth, 'breadth'); })
      .then(function () { return Flow.wait(BEAT); })
      /* base = length */
      .then(function () {
        return Promise.all([
          Flow.anim(settle([part.height, part.breadth])),
          sayPair('f1Base', part.base, 'base', part.length, 'length')
        ]);
      })
      .then(function () { return Flow.anim(settle([part.base, part.length])); })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return K.handOver(); });
  }

  /* ---- a question asked from the perch ---------------------------------------
     The bird asks in its bubble on the right; the three answers come up
     under it, shuffled. A wrong pick is answered in one short line, the
     bubble amber (q.hint(key) is shown on the figure with it); once only
     the answer is left it is lit for the learner. The right pick is
     answered in one short line, the bubble green, with q.cheer() acted out
     on the figure. */
  function askOnPerch(q) {
    var order = K.shuffle(q.opts);
    var right = order.indexOf(q.right);
    return K.perchSay(q.ask)
      .then(function () { return K.perchChoices(order.map(function (k) { return T(k); })); })
      .then(function (btns) {
        return K.perchAsk(btns, right, {
          onWrong: function (i) {
            var key = order[i];
            return Promise.all([K.perchSay(q.wrong[key], 'confused', 'no'), q.hint ? q.hint(key) : null]);
          }
        });
      })
      .then(function (res) {
        return Promise.all([K.perchRight(q.say, res), q.cheer ? q.cheer() : null]);
      });
  }

  /* ---- page 2: the area of the parallelogram ------------------------------- */
  var PARA_Q = {
    ask: 'f2Ask',
    opts: ['f2OptA', 'f2OptB', 'f2OptC'],
    right: 'f2OptB',
    say: 'f2Right',
    wrong: { f2OptA: 'f2WrongA', f2OptC: 'f2WrongC' },
    /* the slanting side picked: the real height is pointed at */
    hint: function (key) { return key === 'f2OptC' ? pointAt([part.height]) : null; },
    cheer: function () {
      var c = para.centre();
      K.burstAt(c.x, c.y);
      return pointAt([part.base, part.height]);
    }
  };
  function pageParaArea() {
    /* the rectangle goes; the parallelogram stays on the left, and the bird
       leaves the header for its perch on the right as it asks */
    return Flow.anim(Beats.clearFigure([rectG]))
      .then(function () { return askOnPerch(PARA_Q); })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return K.handOver(); });
  }

  /* ---- page 3: the area of the rectangle ------------------------------------ */
  /* The rectangle, out of sight, carried to the left; then it rises into
     view there and its outline glows once. */
  function rectIn() {
    var tl = M.timeline({ willChange: rectG, willChangeValue: 'transform, opacity' });
    tl.set(rectG, { x: RECT_LEFT - RECT_X });
    tl.fromTo(rectG, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: M.dur(0.5), ease: 'power2.out' });
    tl.add(Beats.glowOnce(rectGlow), M.gap(0.3));
    return tl;
  }
  var RECT_Q = {
    ask: 'f3Ask',
    opts: ['f3OptA', 'f3OptB', 'f3OptC'],
    right: 'f3OptB',
    say: 'f3Right',
    wrong: { f3OptA: 'f3WrongA', f3OptC: 'f3WrongC' },
    cheer: function () {
      var c = rect.centre();
      K.burstAt(c.x + RECT_LEFT - RECT_X, c.y);
      return pointAt([part.length, part.breadth]);
    }
  };
  function pageRectArea() {
    return Promise.all([K.perchClear(), Flow.anim(Beats.clearFigure([paraG]))])
      .then(function () { return Flow.anim(rectIn()); })
      .then(function () { return askOnPerch(RECT_Q); })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return K.handOver(); });
  }

  function sceneFormula() {
    return pageExplain().then(pageParaArea).then(pageRectArea);
  }

  function parts() { return [group]; }
  function reset() {
    group.setAttribute('hidden', '');
    group.classList.remove('is-live');
    group.textContent = '';
    para = null; rect = null; pts = null; rpts = null; F = null;
    paraG = null; copyG = null; rectG = null; rectGlow = null; copyTri = null; cutLine = null;
    part = {};
  }
  /* A jump here: an empty board -- the first page draws its own figures. */
  function stage() {
    var cutG = document.getElementById('figCut');
    if (cutG) { cutG.setAttribute('hidden', ''); cutG.textContent = ''; }
  }

  Pages.addSection({
    name: 'The formula',
    scenes: [{ name: 'Discover the formula', play: sceneFormula }],
    build: build, parts: parts, reset: reset, stage: stage
  });
})(window);
