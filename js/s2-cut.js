/* ==========================================================================
 * s2-cut.js -- the derivation: a height, a cut, a rectangle
 * --------------------------------------------------------------------------
 * Six pages on the lesson's one parallelogram, standing in the middle of
 * the board where the warm-up left it:
 *   1. two dots glow -- the top-left corner and the point straight below it
 *      on the base -- and the learner drags a line from one to the other;
 *      it snaps vertical, turns solid orange, and the right-angle marker
 *      draws at its foot
 *   2. the shape splits along the learner's line (no second cut to make);
 *      the triangle on the left turns orange and steps aside
 *   3. a dotted space appears on the right; the learner drags the triangle
 *      into it (a hand shows the move once, and again after 8 s idle)
 *   4. the two pieces make a rectangle: the triangle turns blue, the outline
 *      glows once, "length" and "breadth" are named
 *   5. is the area still the same? -- two answers in the footer
 *   6. what is the area of this rectangle? -- three answers, shuffled
 *      after every wrong tap, with hints that deepen each time
 * Then, on Continue, the rectangle shrinks to the right half and a lighter
 * copy of the parallelogram fades in on the left, for the next section.
 * ========================================================================== */
(function (global) {
  'use strict';

  var Flow = global.Flow, Beats = global.Beats, Pages = global.Pages, P = global.Para, W = global.W, M = global.Motion;
  if (!Pages || !Pages.addSection) { console.error('s2-cut.js: load js/pages.js first.'); return; }
  var K = Pages.kit;
  function T(k, r) { return global.T ? global.T(k, r) : k; }
  var BEAT = K.BEAT, SHORT = K.SHORT, LOOK = K.LOOK;
  var IDLE_REPLAY = 8000;     /* ms with nothing done before the hand shows again */
  var SNAP = 26;              /* figure units: a release this close is caught     */
  var GRAB = 44;              /* figure units: a press this near the dot takes it  */
  var STEP = 14;              /* how far the cut triangle steps aside              */

  var dom = null, group = null, layerNodes = [];
  /* the shape and the marks on it, kept across the pages */
  var s = null, pts = null, F = null, D = null, A = null, B = null, C = null;
  var g = null;               /* the pieces' group: the rectangle, carried aside at the end */
  var draw = null, hLine = null, ra = null, dots = null;
  var tri = null, rest = null, triHit = null, target = null, triAt = { x: 0, y: 0 };
  var ghost = null, ghostFill = null, lenMark = null, brMark = null, lenLbl = null, brLbl = null, rectGlow = null, rectLine = null;
  var shift = null;           /* where the triangle sits in the rectangle: + base */

  function build(kit) {
    dom = kit.dom();
    group = document.getElementById('figCut');
  }
  function toFig(ev) {
    var pt = dom.figure.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    var m = dom.figure.getScreenCTM();
    return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
  }
  function centreOf(el) { var r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  function clientOf(p) {
    var pt = dom.figure.createSVGPoint();
    pt.x = p.x; pt.y = p.y;
    var m = dom.figure.getScreenCTM();
    var q = m ? pt.matrixTransform(m) : pt;
    return { x: q.x, y: q.y };
  }

  /* The parallelogram, where the warm-up left it (built afresh if a jump
     opened here), and the marks the pages put on it. */
  function ensureShape() {
    if (s) return;
    group.removeAttribute('hidden');
    g = P.el('g', { 'class': 'pg-pieces' }, group);
    pts = P.mainPts();
    A = pts[0]; B = pts[1]; C = pts[2]; D = pts[3];
    F = { x: D.x, y: A.y };
    shift = { x: B.x - A.x, y: 0 };
    s = P.build(g, pts, {});
    Beats.putShape(s);
    /* the learner's line, and the height it becomes */
    draw = P.el('path', { 'class': 'pg__draw' }, g);
    ra = P.el('path', { 'class': 'pg__ra is-orange', d: P.raPath(F, { x: 1, y: 0 }, { x: 0, y: -1 }, 14) }, g);
    dots = { top: P.dot(g, D, { hit: true }), foot: P.dot(g, F, { hit: true }) };
    /* the two pieces the cut makes, over the shape, unseen until the cut */
    rest = P.el('path', { 'class': 'pg__tri is-blue', d: P.pathOf([F, B, C, D]) }, g);
    tri = P.el('path', { 'class': 'pg__tri', d: P.pathOf([A, D, F]) }, g);
    triHit = P.el('path', { 'class': 'pg__tri-hit', d: P.pathOf([A, D, F]), role: 'button', tabindex: -1 }, g);
    triHit.setAttribute('aria-label', T('a11yTriangle'));
    target = P.el('path', { 'class': 'pg__target', d: P.pathOf([P.add(A, shift), P.add(D, shift), P.add(F, shift)]), role: 'button', tabindex: -1 }, g);
    target.setAttribute('aria-label', T('a11yTarget'));
    /* the rectangle's marks */
    var B2 = P.add(F, shift), C2 = P.add(D, shift);
    rectLine = P.el('path', { 'class': 'pg__outline', d: P.pathOf([F, B2, C2, D]) }, g);
    rectGlow = P.el('path', { 'class': 'pg__outline', d: P.pathOf([F, B2, C2, D]) }, g);
    rectGlow.style.filter = 'url(#partGlow)';
    lenMark = P.el('path', { 'class': 'pg__side is-base', d: P.seg(F, B2) }, g);
    brMark = P.el('path', { 'class': 'pg__side is-orange', d: P.seg(B2, C2) }, g);
    lenLbl = P.label(g, T('lblLength'), { cls: 'is-teal is-italic', at: { x: (F.x + B2.x) / 2, y: F.y + 26 } });
    brLbl = P.label(g, T('lblBreadth'), { cls: 'is-orange is-italic', at: { x: B2.x + 14, y: (B2.y + C2.y) / 2 }, anchor: 'start' });
    /* the faint outline of the parallelogram, for the comparison */
    ghostFill = P.el('path', { 'class': 'pg__ghost-fill', d: P.pathOf(pts) }, group);
    ghost = P.el('path', { 'class': 'pg__ghost', d: P.pathOf(pts) }, group);
    group.insertBefore(ghostFill, g);
    group.insertBefore(ghost, g);
  }
  /* The warm-up's shape stands in the same place: take over from it with
     nothing seen to change. */
  function takeOver() {
    ensureShape();
    var warm = global.Warm && global.Warm.group();
    if (warm && !warm.hasAttribute('hidden')) { warm.setAttribute('hidden', ''); warm.textContent = ''; }
  }

  /* ======================================================================
   * Page 1 -- the line from the top dot to the bottom one
   * ====================================================================== */
  function drawHeight() {
    var live = true, press = null, armed = false, touched = false, idle = 0, stopHand = null;
    var svg = dom.figure;
    g.classList.add('is-live');
    [dots.top.hit, dots.foot.hit].forEach(function (h) { h.setAttribute('tabindex', '0'); });

    function showHand() {
      if (!live || stopHand) return;
      stopHand = W.handDrag(function () { return clientOf(D); }, function () { return clientOf(F); }, 56, { once: true, seconds: 1.1 });
      /* once: the hand puts itself away; forget it after */
      K.quiet(Flow.wait(2600).then(function () { stopHand = null; }));
    }
    function armIdle() {
      var mine = ++idle;
      K.quiet(Flow.wait(IDLE_REPLAY).then(function () {
        if (!live || mine !== idle || press) return;
        showHand();
        armIdle();
      }));
    }
    function moved() {
      touched = true;
      if (stopHand) { stopHand(); stopHand = null; }
      armIdle();
    }
    function lineTo(q) {
      draw.setAttribute('d', P.seg(D, q));
      M.set(draw, { opacity: 1 });
    }
    function fadeBack() {
      K.quiet(Flow.anim(M.to(draw, { opacity: 0, duration: M.dur(0.3), ease: 'power2.in', overwrite: 'auto' })));
      Beats.dotCall(dots.top); Beats.dotCall(dots.foot);
    }
    function accept() {
      if (!live) return;
      live = false;
      draw.setAttribute('d', P.seg(D, F));
      M.set(draw, { opacity: 1 });
      Beats.snapDot(dots.foot.core);
      dom.gate.dispatchEvent(new MouseEvent('click'));
    }
    function onDown(ev) {
      if (!live || press) return;
      var q = toFig(ev);
      if (P.dist(q, D) > GRAB) return;
      if (ev.cancelable) ev.preventDefault();
      press = { id: ev.pointerId };
      try { svg.setPointerCapture(ev.pointerId); } catch (e) {}
      moved();
      Beats.dotStill(dots.top);
      lineTo(q);
    }
    function onMove(ev) {
      if (!press || ev.pointerId !== press.id) return;
      lineTo(toFig(ev));
    }
    function onUp(ev) {
      if (!press || ev.pointerId !== press.id) return;
      press = null;
      var q = toFig(ev);
      if (P.dist(q, F) <= SNAP) accept(); else fadeBack();
    }
    function onCancel(ev) { if (press && ev.pointerId === press.id) { press = null; fadeBack(); } }
    /* a tap on the top dot, then on the bottom one, draws it too */
    function onTopTap(ev) {
      if (!live) return;
      if (ev.type === 'keydown' && ev.key !== 'Enter' && ev.key !== ' ') return;
      if (ev.type === 'keydown') ev.preventDefault();
      moved();
      armed = true;
      Beats.dotStill(dots.top);
      lineTo(P.lerp(D, F, 0.35));
    }
    function onFootTap(ev) {
      if (!live) return;
      if (ev.type === 'keydown' && ev.key !== 'Enter' && ev.key !== ' ') return;
      if (ev.type === 'keydown') ev.preventDefault();
      if (armed) accept();
    }
    svg.addEventListener('pointerdown', onDown);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onCancel);
    dots.top.hit.addEventListener('click', onTopTap);
    dots.top.hit.addEventListener('keydown', onTopTap);
    dots.foot.hit.addEventListener('click', onFootTap);
    dots.foot.hit.addEventListener('keydown', onFootTap);
    function off() {
      live = false; idle++;
      if (stopHand) { stopHand(); stopHand = null; }
      svg.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
      dots.top.hit.removeEventListener('click', onTopTap);
      dots.top.hit.removeEventListener('keydown', onTopTap);
      dots.foot.hit.removeEventListener('click', onFootTap);
      dots.foot.hit.removeEventListener('keydown', onFootTap);
      [dots.top.hit, dots.foot.hit].forEach(function (h) { h.setAttribute('tabindex', '-1'); });
      g.classList.remove('is-live');
    }
    /* the hand shows the move once, straight away, then after every idle stretch */
    showHand();
    armIdle();
    return Flow.once(dom.gate, { auto: true }).then(function () {
      if (live) { draw.setAttribute('d', P.seg(D, F)); M.set(draw, { opacity: 1 }); }
      off();
    }, function (err) { off(); throw err; });
  }

  function pageHeight() {
    return K.say('w3Intro')
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        var acted = K.onPhrase('c1Ask', 'glowing dots', function () {
          return Promise.all([Flow.anim(Beats.dotIn(dots.top)), Flow.anim(Beats.dotIn(dots.foot))]).then(function () {
            Beats.dotCall(dots.top); Beats.dotCall(dots.foot);
          });
        });
        return Promise.all([K.say('c1Ask'), acted]);
      })
      .then(function () { return K.say('c1Tap'); })
      .then(drawHeight)
      /* snapped: the line turns solid orange (it is), the marker draws, the
         dots go */
      .then(function () {
        return Promise.all([
          Flow.anim(Beats.growLine(ra, 0.2)),
          Flow.anim(Beats.dotOut(dots.top)), Flow.anim(Beats.dotOut(dots.foot))
        ]);
      })
      .then(function () { return K.say('c2Nice', 'happy'); })
      .then(function () { return K.autoTurn(900); });
  }

  /* ======================================================================
   * Page 2 -- the cut
   * ====================================================================== */
  function pageCut() {
    return Promise.resolve()
      .then(function () {
        var acted = K.onPhrase('c3Snip', 'Snip', function () {
          /* The learner's line is the cut: no scissors run down it again,
             the one shape just becomes two pieces, in the same frame. */
          return Promise.resolve()
            .then(function () {
              Beats.pop();
              M.set([rest, tri], { opacity: 1 });
              M.set([s.fill, s.outline].concat(s.sides).concat([draw, ra]), { opacity: 0 });
              return Flow.anim(Beats.stepAside(tri, -STEP, 0, 0.5));
            })
            .then(function () {
              triAt = { x: -STEP, y: 0 };
              M.set(triHit, { x: -STEP, y: 0 });
            });
        });
        return Promise.all([K.say('c3Snip'), acted]);
      })
      .then(function () { return Flow.wait(BEAT); })
      .then(function () { return K.autoTurn(300); });
  }
  function drop(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
    var i = layerNodes.indexOf(el);
    if (i >= 0) layerNodes.splice(i, 1);
  }

  /* ======================================================================
   * Page 3 -- the triangle dragged into the dotted space
   * ====================================================================== */
  function dragTriangle() {
    var live = true, press = null, picked = false, idle = 0, stopHand = null, done = false;
    var svg = dom.figure;
    var home = { x: -STEP, y: 0 };
    var goal = { x: shift.x, y: shift.y };
    g.classList.add('is-live');
    tri.classList.add('is-live');
    triHit.setAttribute('tabindex', '0');
    target.setAttribute('tabindex', '0');

    function put(x, y) {
      triAt = { x: x, y: y };
      M.set([tri, triHit], { x: x, y: y });
      target.classList.toggle('is-near', near());
    }
    function near() { return P.dist(triAt, goal) <= SNAP * 1.6; }
    function showHand() {
      if (!live || stopHand) return;
      stopHand = W.handDrag(function () { return centreOf(tri); },
                            function () { return centreOf(target); }, 56, { once: true, seconds: 1.2 });
      K.quiet(Flow.wait(2700).then(function () { stopHand = null; }));
    }
    function armIdle() {
      var mine = ++idle;
      K.quiet(Flow.wait(IDLE_REPLAY).then(function () {
        if (!live || mine !== idle || press) return;
        showHand();
        armIdle();
      }));
    }
    function moved() { if (stopHand) { stopHand(); stopHand = null; } armIdle(); }
    function snap() {
      if (done) return;
      done = true; live = false;
      target.classList.remove('is-near');
      tri.classList.remove('is-held', 'is-live');
      K.quiet(Flow.anim(Beats.snapTo([tri, triHit], goal.x, goal.y, 0.2)));
      triAt = { x: goal.x, y: goal.y };
      dom.gate.dispatchEvent(new MouseEvent('click'));
    }
    function goHome() {
      K.quiet(Flow.anim(Beats.slideHome([tri, triHit], home.x, home.y)));
      triAt = { x: home.x, y: home.y };
      target.classList.remove('is-near');
    }
    function onDown(ev) {
      if (!live || press) return;
      if (ev.cancelable) ev.preventDefault();
      var q = toFig(ev);
      press = { id: ev.pointerId, ox: q.x, oy: q.y, x0: triAt.x, y0: triAt.y, moved: false };
      try { triHit.setPointerCapture(ev.pointerId); } catch (e) {}
      tri.classList.add('is-held');
      moved();
    }
    function onMove(ev) {
      if (!press || ev.pointerId !== press.id) return;
      var q = toFig(ev);
      var dx = q.x - press.ox, dy = q.y - press.oy;
      if (Math.abs(dx) + Math.abs(dy) > 3) press.moved = true;
      put(press.x0 + dx, press.y0 + dy);
    }
    function onUp(ev) {
      if (!press || ev.pointerId !== press.id) return;
      var p = press; press = null;
      tri.classList.remove('is-held');
      if (!p.moved) {                 /* a tap: picked up, waiting for the space */
        picked = !picked;
        tri.classList.toggle('is-held', picked);
        return;
      }
      if (P.dist(triAt, goal) <= SNAP) snap(); else goHome();
    }
    function onCancel(ev) { if (press && ev.pointerId === press.id) { press = null; tri.classList.remove('is-held'); goHome(); } }
    function onTargetTap(ev) {
      if (!live) return;
      if (ev.type === 'keydown' && ev.key !== 'Enter' && ev.key !== ' ') return;
      if (ev.type === 'keydown') ev.preventDefault();
      if (picked) { moved(); snap(); }
    }
    function onTriKey(ev) {
      if (!live || (ev.key !== 'Enter' && ev.key !== ' ')) return;
      ev.preventDefault();
      moved();
      picked = !picked;
      tri.classList.toggle('is-held', picked);
    }
    triHit.addEventListener('pointerdown', onDown);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onCancel);
    triHit.addEventListener('keydown', onTriKey);
    target.addEventListener('click', onTargetTap);
    target.addEventListener('keydown', onTargetTap);
    function off() {
      live = false; idle++;
      if (stopHand) { stopHand(); stopHand = null; }
      triHit.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
      triHit.removeEventListener('keydown', onTriKey);
      target.removeEventListener('click', onTargetTap);
      target.removeEventListener('keydown', onTargetTap);
      triHit.setAttribute('tabindex', '-1'); target.setAttribute('tabindex', '-1');
      tri.classList.remove('is-held', 'is-live');
      g.classList.remove('is-live');
      target.classList.remove('is-near');
    }
    showHand();
    armIdle();
    return Flow.once(dom.gate, { auto: true }).then(function () {
      if (!done) { M.set([tri, triHit], { x: goal.x, y: goal.y }); triAt = { x: goal.x, y: goal.y }; }
      off();
    }, function (err) { off(); throw err; });
  }
  function pageDrag() {
    return Flow.anim(Beats.fadeIn(target, 0.4))
      .then(function () { return K.say('c4Drag'); })
      .then(dragTriangle)
      .then(function () { return K.autoTurn(200); });
  }

  /* ======================================================================
   * Page 4 -- a rectangle
   * ====================================================================== */
  function pageRect() {
    return Flow.anim(Beats.fadeTo(target, 0, 0.2))
      .then(function () { return Flow.wait(1000); })
      /* the triangle turns blue like the rest, and the outline glows once */
      .then(function () {
        tri.classList.add('is-blue');
        /* the seam between the pieces steps back, and the rectangle's own
           outline comes up as the glow runs round it */
        [tri, rest].forEach(function (p) { p.classList.add('is-quiet'); });
        M.set(rectLine, { opacity: 1 });
        return Flow.anim(Beats.glowOnce(rectGlow));
      })
      .then(function () {
        var acted = K.onPhrase('c5Whoa', 'rectangle', function () {
          return Flow.anim(Beats.growLine(lenMark, 0.5))
            .then(function () { return Flow.anim(Beats.labelIn(lenLbl)); })
            .then(function () { return Flow.anim(Beats.growLine(brMark, 0.4)); })
            .then(function () { return Flow.anim(Beats.labelIn(brLbl)); });
        });
        return Promise.all([K.say('c5Whoa'), acted]);
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return K.autoTurn(600); });
  }

  /* ======================================================================
   * Page 5 -- is the area still the same?
   * ====================================================================== */
  var grids = [];
  function showGrids(seconds) {
    if (!grids.length) {
      var k = P.MAIN.k;
      grids = [
        P.grid(group, { x: F.x, y: F.y }, k, 6, 3, {}),
        P.grid(group, { x: A.x, y: A.y }, k, 6, 3, { shear: D.x - A.x })
      ];
    }
    var pieces = [rest, tri, lenMark, brMark, lenLbl, brLbl, rectLine];
    var hold = seconds * 600;
    /* the parallelogram first, its squares over the faint outline while the
       rectangle stands back; then the rectangle's own */
    return Flow.anim(Beats.fadeTo(pieces, 0.12, 0.4))
      .then(function () { return Flow.anim(Beats.fadeIn(grids[1], 0.4)); })
      .then(function () { return Flow.wait(hold); })
      .then(function () { return Flow.anim(Beats.fadeTo(grids[1], 0, 0.3)); })
      .then(function () { return Flow.anim(Beats.fadeTo(pieces, 1, 0.4)); })
      .then(function () { return Flow.anim(Beats.fadeIn(grids[0], 0.4)); })
      .then(function () { return Flow.wait(hold); })
      .then(function () { return Flow.anim(Beats.fadeTo(grids[0], 0, 0.4)); });
  }
  function slideBackAndForth() {
    return Flow.anim(Beats.stepAside([tri, triHit], -STEP, 0, 0.6))
      .then(function () { return Flow.wait(200); })
      .then(function () { return Flow.anim(Beats.stepAside([tri, triHit], shift.x, 0, 0.6)); });
  }
  function pageSame() {
    return Flow.anim(Beats.fadeIn([ghostFill, ghost], 0.5))
      .then(function () { return K.say('c6Ask'); })
      .then(function () { return K.offerChoices([T('c6OptYes'), T('c6OptNo')]); })
      .then(function (btns) {
        return K.askUntilRight(btns, 0, {
          keep: true,
          onWrong: function (i, tries) {
            if (tries === 1) return Promise.all([K.say('c6Wrong1', 'confused'), slideBackAndForth()]);
            return Promise.all([K.say('c6Wrong2', 'confused'), showGrids(2.2)]);
          }
        });
      })
      /* the bird says the result; no card repeats it under the figure */
      .then(function () { return K.say('c6Right', 'happy'); })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return K.clearChoices(); })
      .then(function () { return K.autoTurn(500); });
  }

  /* ======================================================================
   * Page 6 -- what is the area of this rectangle?
   * ====================================================================== */
  var OPTS = ['c7OptA', 'c7OptB', 'c7OptC'];
  function pageRectArea() {
    var card = null, gridOn = false, btns = null;
    return Flow.anim(Beats.fadeTo([ghostFill, ghost], 0, 0.4))
      .then(function () { return K.say('c7Ask'); })
      .then(function () { return K.offerChoices(OPTS.map(function (k) { return T(k); })); })
      .then(function (list) {
        btns = list;
        var rightBtn = btns[1];
        return K.askUntilRight(btns, 1, {
          keep: true, shuffle: true,
          onWrong: function (i, tries) {
            var fb = btns[i] === btns[0] ? 'c7WrongA' : 'c7WrongC';
            return K.say(fb, 'confused').then(function () {
              if (tries === 1) return K.say('c7Hint1');
              if (tries === 2) {
                if (!gridOn && grids.length) gridOn = true;
                return Promise.all([K.say('c7Hint2'), Flow.anim(Beats.fadeIn(grids[0], 0.5))]);
              }
              if (tries === 3) return K.say('c7Hint3');
              /* the fourth wrong try: the answer is given */
              return K.say('c7Reveal').then(function () {
                K.quiet(Flow.wait(SHORT + 150).then(function () { rightBtn.click(); }));
              });
            });
          }
        });
      })
      .then(function () {
        if (grids.length) K.quiet(Flow.anim(Beats.fadeTo(grids[0], 0, 0.4)));
        card = W.card(dom.layer, { cls: 'card--formula', left: 50, bottom: 3, centre: true });
        layerNodes.push(card.el);
        var row = card.row(T('c7Card'), 'is-result');
        var acted = K.onPhrase('c7Right', 'Length', function () {
          M.set(card.el, { opacity: 1 });
          return Flow.anim(Beats.ruleIn(card.el)).then(function () { return row.show(); });
        });
        return Promise.all([K.say('c7Right', 'happy'), acted]);
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return K.handOver(); })
      /* on Continue: the answers and the card go, the rectangle shrinks to
         the right half, and the parallelogram comes back, lighter, on the left */
      .then(function () {
        return Promise.all([
          K.clearChoices(),
          Flow.anim(Beats.cardOut(card.el)),
          Flow.anim(Beats.labelsOut([lenLbl, brLbl])),
          K.lineAway()
        ]);
      })
      .then(function () {
        drop(card.el);
        var k = P.MATCH.k / P.MAIN.k;
        var to = P.MATCH.rect;
        var para = P.build(group, P.cm(P.MAIN.cm, P.MATCH.para, P.MATCH.k), { cls: 'pg--faint' });
        para.fill.classList.add('is-faint');
        return Promise.all([
          Flow.anim(Beats.moveGroup(g, { x: to.x - F.x, y: to.y - F.y, scale: k }, 0.9, 'power3.inOut', F.x + ' ' + F.y)),
          Flow.wait(400).then(function () { return Flow.anim(Beats.showShape(para, { time: 0.5 })); })
        ]);
      });
  }

  function sceneCut() {
    takeOver();
    return pageHeight()
      .then(pageCut)
      .then(pageDrag)
      .then(pageRect)
      .then(pageSame)
      .then(pageRectArea);
  }

  function parts() { return [group]; }
  function wipe() {
    var nodes = layerNodes.slice();
    return nodes.length ? [Flow.anim(Beats.cardOut(nodes))] : [];
  }
  function reset() {
    group.setAttribute('hidden', '');
    group.classList.remove('is-live');
    group.textContent = '';
    layerNodes.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    layerNodes = [];
    s = null; g = null; grids = []; dots = null; tri = null; rest = null; target = null;
  }
  /* A jump here: the parallelogram standing in the middle, the bird away. */
  function stage() {
    var warm = global.Warm && global.Warm.group();
    if (warm) { warm.setAttribute('hidden', ''); warm.textContent = ''; }
    ensureShape();
  }

  Pages.addSection({
    name: 'Derivation',
    scenes: [{ name: 'Cut and rearrange', play: sceneCut }],
    build: build, parts: parts, wipe: wipe, reset: reset, stage: stage
  });
})(window);
