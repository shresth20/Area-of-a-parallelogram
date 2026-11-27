/* ==========================================================================
 * s4-height.js -- the corresponding height
 * --------------------------------------------------------------------------
 * Three pages on the lesson's parallelogram, drawn afresh in the middle:
 *   1. which of three lines is the real height? -- a slanting side, a
 *      diagonal and the perpendicular, each a tap target; a wrong one turns
 *      amber and shakes, and is answered; the third wrong try slides a set
 *      square along the base until it meets the height
 *   2. a slanting side made the base -- the old height fades, a new one
 *      draws at a right angle to the new base
 *   3. a wider parallelogram whose height lands outside: Continue starts the
 *      sequence (the base extended, dotted; the height drawn; the marker),
 *      then a quick check: tap the height
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

  /* ---- page 1: which line is the height? ------------------------------------ */
  function pageWhich() {
    var g, pts, A, B, C, D, s, foot, diag, diagHit, hgt, footDot, baseLbl, tags, lines, hits;
    var setsq = null, card = null;
    /* built once the board is wiped, or the wipe would take it with it */
    function make() {
      g = P.el('g', {}, group);
      pts = P.cm(P.MAIN.cm, ORIGIN, KS);
      A = pts[0]; B = pts[1]; C = pts[2]; D = pts[3];
      s = P.build(g, pts, { hits: true });
      foot = P.foot(D, A, B);
      diag = P.el('path', { 'class': 'pg__diag', d: P.seg(D, B) }, g);
      diagHit = P.el('path', { 'class': 'pg__hit', d: P.seg(D, B), role: 'button', tabindex: -1 }, g);
      diagHit.setAttribute('aria-label', T('a11yLine'));
      hgt = P.height(g, D, A, B, { cls: 'is-grey', raCls: 'is-orange', hit: true });
      footDot = P.dot(g, foot, { cls: 'is-orange', r: 5 });
      baseLbl = P.label(g, T('lblBaseLower'), { cls: 'is-teal is-italic', at: { x: P.mid(A, B).x + 60, y: A.y + 26 } });
      tags = [
        P.tag(g, P.add(P.mid(D, A), { x: -26, y: 0 }), '1'),
        P.tag(g, P.add(P.mid(D, B), { x: 14, y: -22 }), '2'),
        P.tag(g, P.add(P.mid(D, foot), { x: 24, y: 0 }), '3')
      ];
      lines = [s.sides[3], diag, hgt.line];
      hits = [s.hits[3], diagHit, hgt.hit];
      s.sides[0].classList.add('is-base');
    }
    return K.wipeBoard()
      .then(function () {
        group.removeAttribute('hidden');
        make();
        return Flow.anim(Beats.drawShape(s, { time: 1.2 }));
      })
      .then(function () { return Flow.anim(Beats.labelIn(baseLbl)); })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        return Promise.all([Flow.anim(Beats.dashedIn(diag, 0.5)), Flow.anim(Beats.dashedIn(hgt.line, 0.5))]);
      })
      .then(function () { return Flow.anim(Beats.labelsIn(tags.map(function (t) { return t.g; }), 0.12)); })
      .then(function () { return K.say('h1Ask'); })
      .then(function () { return K.say('h1Tap'); })
      .then(function () {
        g.classList.add('is-live');
        var stop = null, touched = false;
        hits.forEach(function (h) { h.addEventListener('pointerdown', function () { touched = true; if (stop) { stop(); stop = null; } }); });
        K.quiet(Flow.wait(K.NUDGE_AFTER).then(function () {
          if (!touched) stop = W.handNudge(null, function () { var q = clientOf(P.mid(D, foot)); return { x: q.x, y: q.y, h: 56 }; });
        }));
        return K.tapOn(hits, {
          answer: 2,
          mark: function (i) { return lines[i]; },
          onWrong: function (i, tries) {
            var said = K.say(i === 0 ? 'h1WrongSlant' : 'h1WrongDiag', 'confused');
            var acts = [said];
            if (i === 0) {
              M.set(hgt.ra, { opacity: 1 });
              acts.push(Flow.anim(Beats.partPulse(s.sides[0], 2)), Flow.anim(Beats.partPulse(hgt.ra, 2, 0.8)));
            }
            if (tries >= 3) acts.push(setSquare());
            return Promise.all(acts).then(function () { if (i === 0) M.set(hgt.ra, { opacity: 0 }); });
          }
        }).then(function (res) { if (stop) stop(); g.classList.remove('is-live'); return res; });
      })
      .then(function () {
        hgt.line.classList.remove('is-grey', 'is-right');
        card = cardAt('h1Card');
        var acted = K.onPhrase('h1Right', 'Line 3', function () {
          return Promise.all([
            Flow.anim(Beats.dotIn(footDot)),
            Flow.anim(Beats.growLine(hgt.ra, 0.3)),
            Flow.anim(Beats.fadeTo([s.sides[3], diag, tags[0].g, tags[1].g], 0.25, 0.4)),
            Flow.anim(Beats.partPulse(hgt.line, 2))
          ]).then(function () { return card.show(); });
        });
        return Promise.all([K.say('h1Right', 'happy'), acted]);
      })
      .then(function () { return K.autoTurn(900); })
      .then(function () {
        return Promise.all([Flow.anim(Beats.cardOut(card.card.el)), Flow.anim(Beats.marksOut([diag, tags[0].g, tags[1].g, tags[2].g, footDot.g]))]);
      })
      .then(function () {
        drop(card.card.el);
        return { g: g, s: s, pts: pts, hgt: hgt, baseLbl: baseLbl };
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
    var g = fig.g, s = fig.s, pts = fig.pts, hgt = fig.hgt;
    var A = pts[0], B = pts[1], C = pts[2], D = pts[3];
    var hgt2 = P.height(g, D, B, C, { raCls: 'is-orange' });
    var hLbl = P.label(g, T('lblHeightLower'), { cls: 'is-orange is-italic', at: { x: P.mid(D, hgt2.foot).x, y: P.mid(D, hgt2.foot).y - 24 } });
    var card = null;
    return K.say('h2Ask')
      .then(function () { return K.say('h2Tap'); })
      .then(function () {
        s.sides[1].classList.add('is-slant');
        Beats.pulseHold(s.sides[1]);
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
      .then(function () {
        return Promise.all([Flow.anim(Beats.pulseRelease(s.sides[1])), Flow.anim(Beats.fadeTo([hgt.line, hgt.ra], 0, 0.4))]);
      })
      .then(function () {
        /* the old base returns to the outline, the slanting side is the base */
        s.sides[0].classList.remove('is-base');
        s.sides[1].classList.remove('is-slant', 'is-right');
        s.sides[1].classList.add('is-base');
        return Flow.anim(Beats.fadeTo(fig.baseLbl, 0, 0.3));
      })
      .then(function () {
        var lbl = P.label(g, T('lblBaseLower'), { cls: 'is-teal is-italic', at: { x: P.mid(B, C).x + 40, y: P.mid(B, C).y + 10 } });
        return Flow.anim(Beats.labelIn(lbl));
      })
      .then(function () { return Flow.anim(Beats.dashedIn(hgt2.line, 0.6)); })
      .then(function () { return Flow.anim(Beats.growLine(hgt2.ra, 0.3)); })
      .then(function () { return Flow.anim(Beats.labelIn(hLbl)); })
      .then(function () {
        card = cardAt('h2Card');
        var acted = K.onPhrase('h2Right', 'pair', function () { return card.show(); });
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
      .then(function () { return K.handOver(); })
      /* Continue starts the sequence: the base extends, the height draws,
         the marker pulses, the takeaway writes in -- as the bird says it */
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
