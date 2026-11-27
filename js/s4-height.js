/* ==========================================================================
 * s4-height.js -- the corresponding height
 * --------------------------------------------------------------------------
 * Three pages on the lesson's parallelogram, drawn afresh in the middle:
 *   1. which of three lines is the real height? -- numbered 1, 2, 3 from
 *      left to right (a slanting side, the perpendicular, a diagonal); each
 *      is lit and gets its number as the bird names it, then all three are
 *      tap targets; a wrong one turns amber and shakes, and is answered in
 *      one sentence; the third wrong try slides a set square along the base
 *      until it meets the height; the right one is answered, then Next
 *   2. a slanting side made the base -- the old height fades away first,
 *      the word "base" floats from the bottom to the slanting side, a new
 *      height draws at a right angle to it, and the rule is said: the
 *      height is always perpendicular to the base
 *   3. a wider parallelogram whose height lands outside: after its title
 *      line the sequence plays on by itself, no Continue (the base extended,
 *      dotted; the height drawn; the marker), then a quick check: tap the
 *      height
 * ========================================================================== */
(function (global) {
  'use strict';

  var Flow = global.Flow, Beats = global.Beats, Pages = global.Pages, P = global.Para, W = global.W, M = global.Motion;
  if (!Pages || !Pages.addSection) { console.error('s4-height.js: load js/pages.js first.'); return; }
  var K = Pages.kit;
  function T(k, r) { return global.T ? global.T(k, r) : k; }
  var BEAT = K.BEAT, SHORT = K.SHORT, LOOK = K.LOOK;
  var KS = 54;
  var ORIGIN = { x: 500 - 4 * KS, y: 215 + 1.5 * KS };        /* MAIN's middle at (500, 215) */
  var WIDE = [[0, 0], [6, 0], [10, 3], [4, 3]];
  var ORIGIN_W = { x: 500 - 5 * KS, y: 182 + 1.5 * KS };   /* set higher: its card is three lines */

  var dom = null, group = null, layerNodes = [];
  function build(kit) { dom = kit.dom(); group = document.getElementById('figHeight'); }
  function drop(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
    var i = layerNodes.indexOf(el);
    if (i >= 0) layerNodes.splice(i, 1);
  }
  function cardAt(key, o) {
    var c = W.card(dom.layer, Object.assign({ cls: 'card--formula', left: 50, bottom: 4, centre: true }, o || {}));
    layerNodes.push(c.el);
    var row = c.row(T(key), 'is-result');
    return { card: c, show: function () { M.set(c.el, { opacity: 1 }); return Flow.anim(Beats.ruleIn(c.el)).then(function () { return row.show(); }); } };
  }

  /* ---- highlights: by transform and opacity alone ------------------------------- */
  /* A soft glow along a line, laid inside the shape's group just under the
     sides' ink, so it lights a side, a height or a diagonal alike. */
  function glowUnder(s, a, b, cls) {
    var gl = P.el('path', { 'class': 'pg__glowline' + (cls ? ' ' + cls : ''), d: P.seg(a, b) });
    s.g.insertBefore(gl, s.sides[0]);
    return gl;
  }
  /* A glow breathed in and out `times` times. */
  function glowBreath(gl, times) {
    var tl = M.timeline({ willChange: gl, willChangeValue: 'opacity' });
    for (var i = 0; i < (times || 1); i++) {
      tl.to(gl, { opacity: 1, duration: M.dur(0.32), ease: 'power2.out' })
        .to(gl, { opacity: 0, duration: M.dur(0.4), ease: 'power2.in' }, '+=' + M.dur(0.25));
    }
    return tl;
  }
  /* A mark swelling once about a point (figure units) and settling back. */
  function popAt(el, at) {
    var tl = M.timeline({ willChange: el, willChangeValue: 'transform', revert: function () { M.set(el, { clearProps: 'transform' }); } });
    var origin = P.round2(at.x) + ' ' + P.round2(at.y);
    tl.to(el, { scale: 1.45, svgOrigin: origin, duration: M.dur(0.2), ease: 'power2.out' })
      .to(el, { scale: 1, svgOrigin: origin, duration: M.dur(0.4), ease: M.POP });
    return tl;
  }
  /* A word carried from where it stands to `to` (figure units) along a
     gentle curve bent towards `via`, lifting a little on the way. */
  function floatTo(el, to, via, seconds) {
    var x0 = parseFloat(el.getAttribute('x')), y0 = parseFloat(el.getAttribute('y'));
    var dx = to.x - x0, dy = to.y - y0, cx = via.x - x0, cy = via.y - y0;
    var pen = { t: 0 };
    var secs = seconds || 1.1;
    var tl = M.timeline({ willChange: el, willChangeValue: 'transform' });
    M.set(el, { transformOrigin: 'center center' });
    tl.to(pen, {
      t: 1, duration: M.dur(secs), ease: 'power2.inOut',
      onUpdate: function () {
        var t = pen.t, u = 1 - t;
        M.set(el, { x: 2 * u * t * cx + t * t * dx, y: 2 * u * t * cy + t * t * dy });
      }
    }, 0);
    tl.to(el, { scale: 1.18, duration: M.dur(secs * 0.45), ease: 'power2.out' }, 0)
      .to(el, { scale: 1, duration: M.dur(secs * 0.55), ease: 'power2.inOut' }, M.gap(secs * 0.45));
    return tl;
  }

  /* ---- page 1: which line is the height? ------------------------------------ */
  var IDLE_HINT = 6000;   /* ms untouched before the three lines are lit again */
  function pageWhich() {
    var g, pts, A, B, C, D, s, foot, diag, diagHit, hgt, footDot, baseLbl, hLbl, tags, lines, hits, glows, baseGlow;
    var setsq = null, card = null;
    /* built once the board is wiped, or the wipe would take it with it */
    function make() {
      g = P.el('g', {}, group);
      pts = P.cm(P.MAIN.cm, ORIGIN, KS);
      A = pts[0]; B = pts[1]; C = pts[2]; D = pts[3];
      s = P.build(g, pts, { hits: true });
      foot = P.foot(D, A, B);
      /* the three lines' glows (in their order, 1 2 3) and the base's */
      glows = [glowUnder(s, D, A), glowUnder(s, D, foot), glowUnder(s, D, B)];
      baseGlow = glowUnder(s, A, B, 'is-teal');
      diag = P.el('path', { 'class': 'pg__diag', d: P.seg(D, B) }, g);
      diagHit = P.el('path', { 'class': 'pg__hit', d: P.seg(D, B), role: 'button', tabindex: -1 }, g);
      diagHit.setAttribute('aria-label', T('a11yLine'));
      hgt = P.height(g, D, A, B, { cls: 'is-grey', raCls: 'is-orange', hit: true });
      footDot = P.dot(g, foot, { cls: 'is-orange', r: 5 });
      baseLbl = P.label(g, T('lblBaseLower'), { cls: 'is-teal is-italic', at: { x: P.mid(A, B).x + 60, y: A.y + 26 } });
      /* numbered left to right, as the eye reads them: the slanting side,
         the height, the diagonal */
      tags = [
        P.tag(g, P.add(P.mid(D, A), { x: -26, y: 0 }), '1'),
        P.tag(g, P.add(P.mid(D, foot), { x: 24, y: 0 }), '2'),
        P.tag(g, P.add(P.mid(D, B), { x: 14, y: -22 }), '3')
      ];
      /* the answer's name, on the right of the line, under its number */
      hLbl = P.label(g, T('lblHeightLower'), { cls: 'is-orange is-italic', at: { x: foot.x + 12, y: P.mid(D, foot).y + 42 }, anchor: 'start' });
      lines = [s.sides[3], hgt.line, diag];
      hits = [s.hits[3], hgt.hit, diagHit];
      s.sides[0].classList.add('is-base');
    }
    /* line i lit, the one before it let go, and its number popped in */
    function lightOne(i) {
      var tl = M.timeline();
      if (i > 0) tl.to(glows[i - 1], { opacity: 0, duration: M.dur(0.3), ease: 'power2.in' }, 0);
      tl.to(glows[i], { opacity: 1, duration: M.dur(0.35), ease: 'power2.out' }, 0);
      tl.add(Beats.labelIn(tags[i].g), M.gap(0.05));
      return Flow.anim(tl);
    }
    /* the three lit once more in turn, each number nodding: where to tap,
       without saying which */
    function sweep() {
      var tl = M.timeline();
      glows.forEach(function (gl, i) {
        var t0 = i * 0.6;
        tl.to(gl, { opacity: 1, duration: M.dur(0.25), ease: 'power2.out' }, M.gap(t0))
          .to(gl, { opacity: 0, duration: M.dur(0.3), ease: 'power2.in' }, M.gap(t0 + 0.5));
        tl.add(popAt(tags[i].g, { x: +tags[i].ring.getAttribute('cx'), y: +tags[i].ring.getAttribute('cy') }), M.gap(t0));
      });
      return tl;
    }
    return K.wipeBoard()
      .then(function () {
        group.removeAttribute('hidden');
        make();
        return Flow.anim(Beats.drawShape(s, { time: 1.2 }));
      })
      .then(function () { return Flow.anim(Beats.labelIn(baseLbl)); })
      .then(function () { return Flow.wait(SHORT); })
      /* "three lines": the height and the diagonal draw in beside the side */
      .then(function () {
        var drawn = K.onPhrase('h1Ask', 'three lines', function () {
          return Promise.all([Flow.anim(Beats.dashedIn(hgt.line, 0.5)), Flow.wait(160).then(function () { return Flow.anim(Beats.dashedIn(diag, 0.6)); })]);
        });
        return Promise.all([K.say('h1Ask'), drawn]);
      })
      /* each line lit, and its number popped in, as that number is said */
      .then(function () {
        var named = [0, 1, 2].map(function (i) {
          return K.onPhrase('h1Lines', (i + 1) + '.', function () { return lightOne(i); });
        });
        return Promise.all([K.say('h1Lines')].concat(named));
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return Flow.anim(Beats.fadeTo(glows[2], 0, 0.35)); })
      /* "the highlighted base": the base glows as it is said */
      .then(function () {
        var lit = K.onPhrase('h1Tap', 'highlighted base', function () {
          return Promise.all([Flow.anim(glowBreath(baseGlow, 2)), Flow.anim(Beats.glowText(baseLbl, 2))]);
        });
        return Promise.all([K.say('h1Tap'), lit]);
      })
      .then(function () {
        g.classList.add('is-live');
        var touched = false, idle = 0;
        hits.forEach(function (h) { h.addEventListener('pointerdown', function () { touched = true; idle++; }); });
        function armIdle() {
          var mine = ++idle;
          K.quiet(Flow.wait(IDLE_HINT).then(function () {
            if (touched || mine !== idle) return;
            return Flow.anim(sweep()).then(function () { if (!touched && mine === idle) armIdle(); });
          }));
        }
        armIdle();
        return K.tapOn(hits, {
          answer: 1,
          mark: function (i) { return lines[i]; },
          onWrong: function (i, tries) {
            var acts = [K.say(i === 0 ? 'h1WrongSlant' : 'h1WrongDiag', 'confused')];
            /* the right angle the tapped line lacks, shown where there is one */
            M.set(hgt.ra, { opacity: 1 });
            acts.push(Flow.anim(glowBreath(baseGlow, 1)), Flow.anim(popAt(hgt.ra, foot)));
            if (tries >= 3) acts.push(setSquare());
            return Promise.all(acts).then(function () { return Flow.anim(Beats.fadeTo(hgt.ra, 0, 0.3)); });
          }
        }).then(function (res) {
          idle++;
          g.classList.remove('is-live');
          return Flow.anim(Beats.fadeTo(glows.concat(baseGlow), 0, 0.2)).then(function () { return res; });
        });
      })
      /* the answer said, in one sentence, with the right angle it makes */
      .then(function () {
        card = cardAt('h1Card');
        /* "line 2": the other numbers go, the other lines step back */
        var others = K.onPhrase('h1Right', 'line 2', function () {
          return Promise.all([
            Flow.anim(Beats.labelsOut([tags[0].g, tags[2].g])),
            Flow.anim(Beats.fadeTo([s.sides[3], diag], 0.25, 0.4))
          ]);
        });
        /* "the height": the line is named on its right */
        var named = K.onPhrase('h1Right', 'the height', function () {
          return Flow.anim(Beats.labelIn(hLbl));
        });
        var angle = K.onPhrase('h1Right', 'right angle', function () {
          hgt.line.classList.remove('is-grey', 'is-right');
          M.set(hgt.ra, { opacity: 0 });
          return Promise.all([
            Flow.anim(Beats.dotIn(footDot)),
            Flow.anim(Beats.growLine(hgt.ra, 0.3)).then(function () { return Flow.anim(popAt(hgt.ra, foot)); }),
            Flow.anim(glowBreath(glows[1], 1))
          ]).then(function () { return card.show(); });
        });
        return Promise.all([K.say('h1Right', 'happy'), others, named, angle]);
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return K.handOver(); })
      .then(function () {
        return Promise.all([
          Flow.anim(Beats.cardOut(card.card.el)),
          Flow.anim(Beats.marksOut([diag, tags[0].g, tags[1].g, tags[2].g, footDot.g])),
          Flow.anim(Beats.fadeTo(s.sides[3], 1, 0.4))
        ]);
      })
      .then(function () {
        drop(card.card.el);
        return { g: g, s: s, pts: pts, hgt: hgt, baseLbl: baseLbl, hLbl: hLbl };
      });

    /* The set square: a right triangle sliding along the base until its
       upright side meets the height. */
    function setSquare() {
      var sz = 46;
      if (!setsq) setsq = P.el('path', { 'class': 'pg__setsquare', d: P.pathOf([{ x: A.x, y: A.y }, { x: A.x + sz, y: A.y }, { x: A.x, y: A.y - sz }]) }, g);
      M.set(setsq, { x: 0, opacity: 0 });
      var tl = M.timeline();
      tl.to(setsq, { opacity: 1, duration: M.dur(0.3) })
        .to(setsq, { x: foot.x - A.x, duration: M.dur(1.9), ease: 'power2.inOut' })
        .to({}, { duration: M.dur(1.2) })
        .to(setsq, { opacity: 0, duration: M.dur(0.4) });
      return Flow.anim(tl);
    }
  }
  function clientOf(p) {
    var pt = dom.figure.createSVGPoint();
    pt.x = p.x; pt.y = p.y;
    var m = dom.figure.getScreenCTM();
    var q = m ? pt.matrixTransform(m) : pt;
    return { x: q.x, y: q.y };
  }

  /* ---- page 2: a new base ------------------------------------------------------ */
  function pageNewBase(fig) {
    var g = fig.g, s = fig.s, pts = fig.pts, hgt = fig.hgt, baseLbl = fig.baseLbl;
    var A = pts[0], B = pts[1], C = pts[2], D = pts[3];
    var hgt2 = P.height(g, D, B, C, { raCls: 'is-orange' });
    var f2 = hgt2.foot;
    var h2Glow = glowUnder(s, D, f2, 'is-orange');
    /* the word sits below the new height, clear of it */
    var hLbl = P.label(g, T('lblHeightLower'), { cls: 'is-orange is-italic', at: P.add(P.mid(D, f2), P.mul(P.unit(P.perp(P.sub(f2, D))), 54)) });
    /* where "base" floats to: just outside the slanting side's middle, by a
       curve round the corner B so it never crosses the shape */
    var nBC = s.outward(1);
    var baseTo = P.add(s.mid(1), P.mul(nBC, 44));
    var baseVia = P.add(B, { x: 130, y: 36 });
    var card = null;
    return K.say('h2Ask')
      /* "the highlighted slanting side": it takes the slant's ink and
         breathes as it is said */
      .then(function () {
        var lit = K.onPhrase('h2Tap', 'slanting side', function () {
          s.sides[1].classList.add('is-slant');
          Beats.pulseHold(s.sides[1]);
        });
        return Promise.all([K.say('h2Tap'), lit]);
      })
      .then(function () {
        g.classList.add('is-live');
        var stop = null, touched = false, idle = 0;
        s.hits[1].addEventListener('pointerdown', function () { touched = true; if (stop) { stop(); stop = null; } });
        function armIdle() {
          var mine = ++idle;
          K.quiet(Flow.wait(8000).then(function () {
            if (touched || mine !== idle) return;
            return Flow.anim(Beats.partPulse(s.sides[1], 1)).then(armIdle);
          }));
        }
        K.quiet(Flow.wait(K.NUDGE_AFTER).then(function () { if (!touched) stop = W.handNudge(null, function () { var q = clientOf(P.mid(B, C)); return { x: q.x, y: q.y, h: 56 }; }); }));
        armIdle();
        return K.tapOn([s.hits[1]], { answer: 0, mark: function () { return s.sides[1]; } })
          .then(function () { idle++; if (stop) stop(); g.classList.remove('is-live'); });
      })
      .then(function () { return Flow.anim(Beats.pulseRelease(s.sides[1])); })
      /* first the old height goes away; then the word "base" floats from
         the bottom to the slanting side, and the ink of the base goes with it */
      .then(function () {
        var gone = K.onPhrase('h2Swap', 'goes away', function () {
          return Flow.anim(Beats.fadeTo([hgt.line, hgt.ra, fig.hLbl], 0, 0.6));
        });
        var moved = K.onPhrase('h2Swap', 'base moves', function () {
          s.sides[0].classList.remove('is-base');
          s.sides[1].classList.remove('is-slant', 'is-right');
          s.sides[1].classList.add('is-base');
          return Flow.anim(floatTo(baseLbl, baseTo, baseVia, 1.2));
        });
        return Promise.all([K.say('h2Swap'), gone, moved]);
      })
      /* "a new height": drawn from the top corner down to the new base */
      .then(function () {
        var drawn = K.onPhrase('h2Draw', 'new height', function () {
          return Flow.anim(Beats.dashedIn(hgt2.line, 0.8))
            .then(function () { return Flow.anim(Beats.growLine(hgt2.ra, 0.3)); })
            .then(function () { return Flow.anim(Beats.labelIn(hLbl)); });
        });
        return Promise.all([K.say('h2Draw'), drawn]);
      })
      /* "perpendicular": the right angle it makes, and the rule written in */
      .then(function () {
        card = cardAt('h2Card', { cls: 'card--formula card--line' });
        var acted = K.onPhrase('h2Right', 'perpendicular', function () {
          return Promise.all([Flow.anim(popAt(hgt2.ra, f2)), Flow.anim(glowBreath(h2Glow, 1))])
            .then(function () { return card.show(); });
        });
        return Promise.all([K.say('h2Right', 'happy'), acted]);
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return K.handOver(); })
      .then(function () { return Promise.all([Flow.anim(Beats.cardOut(card.card.el)), Flow.anim(Beats.clearFigure([g]))]); })
      .then(function () { drop(card.card.el); if (g.parentNode) g.parentNode.removeChild(g); });
  }

  /* ---- page 3: the height outside ----------------------------------------------- */
  function pageOutside() {
    var g = P.el('g', {}, group);
    var pts = P.cm(WIDE, ORIGIN_W, KS);
    var A = pts[0], B = pts[1], C = pts[2], D = pts[3];
    var s = P.build(g, pts, { hits: true });
    s.sides[0].classList.add('is-base');
    var baseLbl = P.label(g, T('lblBaseLower'), { cls: 'is-teal is-italic', at: { x: P.mid(A, B).x, y: A.y + 26 } });
    var hgt = P.height(g, C, A, B, { ext: true, raCls: 'is-orange', hit: true });
    var hLbl = P.label(g, T('lblHeightLower'), { cls: 'is-orange is-italic', at: { x: C.x + 14, y: P.mid(C, hgt.foot).y }, anchor: 'start' });
    var card = null;
    return K.lineAway()
      .then(function () {
        return Flow.anim(Beats.drawShape(s, { time: 1.2 }));
      })
      .then(function () { return Flow.anim(Beats.labelIn(baseLbl)); })
      .then(function () { return K.say('h3Title'); })
      /* no Continue here: after a beat the page turns by itself */
      .then(function () { return K.autoTurn(BEAT); })
      /* the sequence plays on: the base extends, the height draws, the
         marker pulses, the takeaway writes in -- as the bird says it */
      .then(function () {
        card = cardAt('h3Card');
        var act1 = K.onPhrase('h3Say', 'outside', function () {
          return Flow.anim(Beats.dashedIn(hgt.ext, 0.4));
        });
        var act2 = K.onPhrase('h3Say', 'stretch', function () {
          return Flow.anim(Beats.dashedIn(hgt.line, 0.5))
            .then(function () { return Flow.anim(Beats.labelIn(hLbl)); })
            .then(function () { return Flow.anim(Beats.growLine(hgt.ra, 0.3)); })
            .then(function () { return Flow.anim(Beats.partPulse(hgt.ra, 1, 0.8)); })
            .then(function () { return card.show(); });
        });
        return Promise.all([K.say('h3Say'), act1, act2]);
      })
      .then(function () { return Flow.wait(BEAT); })
      .then(function () { return K.say('h3Tap'); })
      .then(function () {
        g.classList.add('is-live');
        var hits = [s.hits[1], hgt.hit], lines = [s.sides[1], hgt.line];
        var stop = null, touched = false;
        hits.forEach(function (h) { h.addEventListener('pointerdown', function () { touched = true; if (stop) { stop(); stop = null; } }); });
        K.quiet(Flow.wait(K.NUDGE_AFTER).then(function () { if (!touched) stop = W.handNudge(null, function () { var q = clientOf(P.mid(C, hgt.foot)); return { x: q.x, y: q.y, h: 56 }; }); }));
        return K.tapOn(hits, {
          answer: 1, mark: function (i) { return lines[i]; },
          onWrong: function () {
            M.set(hgt.ra, { opacity: 1 });
            return Promise.all([K.say('h3Wrong', 'confused'), Flow.anim(Beats.partPulse(hgt.ra, 2, 0.8))]);
          }
        }).then(function () { if (stop) stop(); g.classList.remove('is-live'); });
      })
      .then(function () { hgt.line.classList.remove('is-right'); hgt.line.classList.add('is-lit'); return K.say('h3Right', 'happy'); })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return K.handOver(); })
      .then(function () { return Flow.anim(Beats.cardOut(card.card.el)); })
      .then(function () { drop(card.card.el); });
  }

  function sceneHeight() {
    return pageWhich().then(pageNewBase).then(pageOutside);
  }

  function parts() { return [group]; }
  function wipe() { var nodes = layerNodes.slice(); return nodes.length ? [Flow.anim(Beats.cardOut(nodes))] : []; }
  function reset() {
    group.setAttribute('hidden', '');
    group.classList.remove('is-live');
    group.textContent = '';
    layerNodes.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    layerNodes = [];
  }
  function stage() {}

  Pages.addSection({
    name: 'The height',
    scenes: [{ name: 'Which line is the height?', play: sceneHeight }],
    build: build, parts: parts, wipe: wipe, reset: reset, stage: stage
  });
})(window);
