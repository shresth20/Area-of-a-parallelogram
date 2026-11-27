/* ==========================================================================
 * s7-practice.js -- the practice: six parallelograms, a keypad
 * --------------------------------------------------------------------------
 * Every question is laid out the same way: the figure in the left half, the
 * bird asking from the header, the keypad in the right half (the answer box
 * with its unit, the keys, Check). A wrong number turns the box soft amber
 * and shakes it; the bird answers it -- the slip the storyboard names for
 * that number, or the general one -- and the keys wait until it has; the
 * hints deepen with each try. The right number turns the box green, the
 * working writes in under the figure, and Continue arrives.
 *   1. guided: tap the base, tap its height, then 4 x 3
 *   2. solo: the base on top, 8 x 3
 *   3. the slanting side as the base: 8 x 6 (not 12 x 6)
 *   4. the area given, the height asked for: 40 / 8
 *   5. a garden bed in metres: 9 x 4
 *   6. three measurements, two needed: 6 x 3 (not 6 x 5)
 * ========================================================================== */
(function (global) {
  'use strict';

  var Flow = global.Flow, Beats = global.Beats, Pages = global.Pages, P = global.Para, W = global.W, M = global.Motion;
  if (!Pages || !Pages.addSection) { console.error('s7-practice.js: load js/pages.js first.'); return; }
  var K = Pages.kit;
  function T(k, r) { return global.T ? global.T(k, r) : k; }
  var BEAT = K.BEAT, SHORT = K.SHORT, LOOK = K.LOOK;
  var LEFT = 255;                         /* the middle of the left half, in figure units */

  var dom = null, group = null, layerNodes = [];
  function build(kit) { dom = kit.dom(); group = document.getElementById('figPractice'); }
  function drop(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
    var i = layerNodes.indexOf(el);
    if (i >= 0) layerNodes.splice(i, 1);
  }
  function cm(n) { return T('lblCm', { n: n }); }
  function m(n) { return T('lblM', { n: n }); }
  /* corners placed so the shape's box is centred on (LEFT, cy) */
  function place(spec, k, cy) {
    var xs = spec.map(function (p) { return p[0]; }), ys = spec.map(function (p) { return p[1]; });
    var midX = (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2;
    var midY = (Math.min.apply(null, ys) + Math.max.apply(null, ys)) / 2;
    return P.cm(spec, { x: LEFT - midX * k, y: (cy || 215) + midY * k }, k);
  }
  /* A working stacked the way it is written on paper: the first line up to
     its first "=", every later "= ..." on a line of its own. The string
     itself stays in the locale file whole. */
  function stacked(key) {
    var parts = T(key).split(/\s=\s/);
    return parts.map(function (p, i) { return i ? '= ' + p : p; });
  }
  function calcCard(rows) {
    var c = W.card(dom.layer, { cls: 'card--formula card--calc', left: 26, bottom: 3, centre: true });
    layerNodes.push(c.el);
    var made = rows.map(function (r) { return c.row(r, 'is-result'); });
    return { card: c, show: function () {
      M.set(c.el, { opacity: 1 });
      return Flow.anim(Beats.ruleIn(c.el)).then(function () {
        return made.reduce(function (chain, r) { return chain.then(function () { return r.show(); }); }, Promise.resolve());
      });
    } };
  }
  function formulaCard() {
    var c = W.card(dom.layer, { cls: 'card--formula', left: 26, top: 4, centre: true });
    layerNodes.push(c.el);
    var r = c.row(T('pFormula'), 'is-result');
    M.set(r.el, { opacity: 1 });
    return c;
  }

  /* ---- the ask on the keypad -------------------------------------------------
     q: { label, unit, answer, check, ask (key), feedback(value, tries) ->
     promise, right (key), calc [rows], onRight() } */
  function askNumber(q, g) {
    var pad = W.keypad(dom.layer, { label: T(q.label || 'lblAreaEq'), unit: T(q.unit || 'unitCm2'), answer: q.answer,
                                   check: T(q.check || 'btnCheckArea'), max: 3,
                                   onWrong: function (v, tries) { return q.feedback(v, tries); } });
    layerNodes.push(pad.el);
    return K.say(q.ask)
      .then(function () { return pad.show(); })
      .then(function () { return pad.ask(); })
      .then(function (res) {
        var card = calcCard(q.calc);
        var done = q.onRight ? q.onRight() : null;
        return Promise.all([K.say(q.right, 'happy'), card.show(), done]).then(function () { return res; });
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return K.handOver(); })
      .then(function () {
        var nodes = layerNodes.slice();
        return Promise.all([Flow.anim(Beats.cardOut(nodes)), Flow.anim(Beats.clearFigure([g])), K.lineAway()]).then(function () {
          nodes.forEach(drop);
          if (g.parentNode) g.parentNode.removeChild(g);
        });
      });
  }

  /* ---- 1. guided: 4 x 3 --------------------------------------------------- */
  function q1() {
    var k = 50;
    var g = P.el('g', {}, group);
    var pts = place([[0, 0], [4, 0], [5.5, 3], [1.5, 3]], k, 188);
    var A = pts[0], B = pts[1], C = pts[2], D = pts[3];
    var s = P.build(g, pts, { hits: true });
    var hgt = P.height(g, D, A, B, { cls: 'is-grey', raCls: 'is-orange', hit: true, label: cm(3), labelCls: 'is-grey', labelSide: 1, labelGap: 30 });
    var baseLbl = P.label(g, cm(4), { cls: 'is-grey', at: { x: P.mid(A, B).x, y: A.y + 26 } });
    var facts = null, formula = null, grid = null;
    return K.say('p0Intro')
      .then(function () { return Flow.anim(Beats.drawShape(s, { time: 1.2 })); })
      .then(function () { return Flow.anim(Beats.labelIn(baseLbl)); })
      .then(function () { return Flow.anim(Beats.dashedIn(hgt.line, 0.5)); })
      .then(function () { return Promise.all([Flow.anim(Beats.growLine(hgt.ra, 0.25)), Flow.anim(Beats.labelIn(hgt.label))]); })
      .then(function () { return K.say('p1Ask'); })
      .then(function () { return K.say('p1TapBase'); })
      /* step A: the base */
      .then(function () {
        g.classList.add('is-live');
        var hits = [s.hits[0], s.hits[1], s.hits[3], hgt.hit], lines = [s.sides[0], s.sides[1], s.sides[3], hgt.line];
        return K.tapOn(hits, {
          answer: 0, mark: function (i) { return lines[i]; },
          onWrong: function () { return K.say('p1WrongBase', 'confused'); }
        }).then(function () { g.classList.remove('is-live'); });
      })
      .then(function () {
        s.sides[0].classList.remove('is-right');
        s.sides[0].classList.add('is-base');
        baseLbl.classList.remove('is-grey'); baseLbl.classList.add('is-teal');
        facts = W.card(dom.layer, { cls: 'card--formula', left: 76, top: 22, centre: true });
        layerNodes.push(facts.el);
        var r1 = facts.row(T('p1BaseIs'), 'is-result');
        M.set(r1.el, { opacity: 1 });
        return Promise.all([facts.show(), Flow.anim(Beats.partPulse(s.sides[0], 1))]);
      })
      .then(function () { return K.say('p1TapHeight'); })
      /* step B: its height */
      .then(function () {
        g.classList.add('is-live');
        var hits = [hgt.hit, s.hits[1], s.hits[3]], lines = [hgt.line, s.sides[1], s.sides[3]];
        hits.forEach(function (h) { h.classList.remove('is-done'); });
        return K.tapOn(hits, {
          answer: 0, mark: function (i) { return lines[i]; },
          onWrong: function () { return K.say('p1WrongHeight', 'confused'); }
        }).then(function () { g.classList.remove('is-live'); });
      })
      .then(function () {
        hgt.line.classList.remove('is-grey', 'is-right');
        hgt.ra.classList.remove('is-right');
        hgt.label.classList.remove('is-grey'); hgt.label.classList.add('is-orange');
        var r2 = facts.row(T('p1HeightIs'), 'is-result');
        return Promise.all([r2.show(), Flow.anim(Beats.partPulse([hgt.line, hgt.ra], 1))]);
      })
      .then(function () { return K.autoTurn(700); })
      /* step 2: the area */
      .then(function () { return Flow.anim(Beats.cardOut(facts.el)).then(function () { drop(facts.el); }); })
      .then(function () {
        return askNumber({
          ask: 'p2Ask', answer: 12, right: 'p2Right', calc: stacked('p2Calc'),
          feedback: function (v, tries) {
            if (tries === 1) {
              formula = formula || formulaCard();
              return Promise.all([K.say('p2Wrong1', 'confused'), formula.show().then(function () { return Flow.anim(Beats.cardLit(formula.el, 1.8)); })]);
            }
            var acts = [K.say('p2Wrong2', 'confused'), Flow.anim(Beats.partPulse([s.sides[0], hgt.line], 2)), Flow.anim(Beats.glowText([baseLbl, hgt.label], 2))];
            if (tries >= 3) {
              if (!grid) grid = P.grid(g, { x: A.x, y: A.y }, k, 4, 3, { shear: D.x - A.x });
              acts.push(Flow.anim(Beats.fadeIn(grid, 0.5)));
            }
            return Promise.all(acts);
          }
        }, g);
      });
  }

  /* ---- 2. solo: the base on top, 8 x 3 --------------------------------------- */
  function q2() {
    var k = 37;
    var g = P.el('g', {}, group);
    var pts = place([[1.5, 0], [9.5, 0], [8, 3], [0, 3]], k);
    var A = pts[0], B = pts[1], C = pts[2], D = pts[3];
    var s = P.build(g, pts, {});
    s.sides[2].classList.add('is-base');
    var hgt = P.height(g, A, D, C, { raCls: 'is-orange', label: cm(3), labelCls: 'is-orange', labelSide: -1, labelGap: 30 });
    var baseLbl = P.label(g, cm(8), { cls: 'is-teal', at: { x: P.mid(C, D).x, y: D.y - 24 } });
    var formula = null;
    return Flow.anim(Beats.drawShape(s, { time: 1.1 }))
      .then(function () { return Flow.anim(Beats.labelIn(baseLbl)); })
      .then(function () { return Flow.anim(Beats.dashedIn(hgt.line, 0.5)); })
      .then(function () { return Promise.all([Flow.anim(Beats.growLine(hgt.ra, 0.25)), Flow.anim(Beats.labelIn(hgt.label))]); })
      .then(function () {
        return askNumber({
          ask: 'p3Ask', answer: 24, right: 'p3Right', calc: stacked('p3Calc'),
          feedback: function (v, tries) {
            var acts = [K.say(v === 11 ? 'p3Wrong' : 'p3WrongOther', 'confused')];
            if (tries >= 2) acts.push(Flow.anim(Beats.glowText([baseLbl, hgt.label], 2)), Flow.anim(Beats.partPulse([s.sides[2], hgt.line], 2)));
            if (tries >= 3) { formula = formula || formulaCard(); acts.push(formula.show()); }
            return Promise.all(acts);
          },
          onRight: function () { return Flow.anim(Beats.partPulse([s.sides[2], hgt.line], 2)); }
        }, g);
      });
  }

  /* ---- 3. the slanting side as the base: 8 x 6 ------------------------------- */
  function q3() {
    var k = 25, c30 = Math.cos(Math.PI / 6) * 8, s30 = 4;
    var g = P.el('g', {}, group);
    var spec = [[0, 0], [12, 0], [12 + c30, s30], [c30, s30]];
    /* the height to the 8 cm side lands past its end: the box holds its foot too */
    var pts = place(spec.concat([[9.92, -1.2]]), k).slice(0, 4);
    var A = pts[0], B = pts[1], C = pts[2], D = pts[3];
    var s = P.build(g, pts, {});
    s.sides[1].classList.add('is-base');
    var hgt = P.height(g, D, B, C, { ext: true, raCls: 'is-orange', label: cm(6), labelCls: 'is-orange', labelSide: 1, labelGap: 30 });
    var baseLbl = P.label(g, cm(8), { cls: 'is-teal', at: P.add(P.mid(B, C), { x: 22, y: 22 }) });
    var botLbl = P.label(g, cm(12), { cls: 'is-grey', at: { x: P.mid(A, B).x - 60, y: A.y + 26 } });
    var formula = null;
    return Flow.anim(Beats.drawShape(s, { time: 1.1 }))
      .then(function () { return Flow.anim(Beats.labelsIn([botLbl, baseLbl], 0.2)); })
      .then(function () { return Flow.anim(Beats.dashedIn(hgt.ext, 0.4)); })
      .then(function () { return Flow.anim(Beats.dashedIn(hgt.line, 0.5)); })
      .then(function () { return Promise.all([Flow.anim(Beats.growLine(hgt.ra, 0.25)), Flow.anim(Beats.labelIn(hgt.label))]); })
      .then(function () {
        return askNumber({
          ask: 'p4Ask', answer: 48, right: 'p4Right', calc: stacked('p4Calc'),
          feedback: function (v, tries) {
            var key = v === 72 ? 'p4Wrong72' : v === 96 ? 'p4Wrong96' : 'p4WrongOther';
            var acts = [K.say(key, 'confused'), Flow.anim(Beats.partPulse([s.sides[1], hgt.line], 2))];
            if (tries >= 3) { formula = formula || formulaCard(); acts.push(formula.show()); }
            return Promise.all(acts);
          },
          onRight: function () { return Flow.anim(Beats.partPulse([s.sides[1], hgt.line], 2)); }
        }, g);
      });
  }

  /* ---- 4. the area given: 40 / 8 ------------------------------------------- */
  function q4() {
    var k = 37;
    var g = P.el('g', {}, group);
    var pts = place([[0, 0], [8, 0], [10, 5], [2, 5]], k, 190);
    var A = pts[0], B = pts[1], C = pts[2], D = pts[3];
    var s = P.build(g, pts, {});
    s.sides[0].classList.add('is-base');
    var hgt = P.height(g, D, A, B, { raCls: 'is-orange', label: T('lblQcm'), labelCls: 'is-orange', labelSide: 1, labelGap: 32 });
    var baseLbl = P.label(g, cm(8), { cls: 'is-teal', at: { x: P.mid(A, B).x, y: A.y + 26 } });
    var area = W.card(dom.layer, { cls: 'card--formula', left: 26, top: 4, centre: true });
    layerNodes.push(area.el);
    var ar = area.row(T('p5Area'), 'is-result'); M.set(ar.el, { opacity: 1 });
    return Flow.anim(Beats.drawShape(s, { time: 1.1 }))
      .then(function () { return Flow.anim(Beats.labelIn(baseLbl)); })
      .then(function () { return Flow.anim(Beats.dashedIn(hgt.line, 0.5)); })
      .then(function () { return Promise.all([Flow.anim(Beats.growLine(hgt.ra, 0.25)), Flow.anim(Beats.labelIn(hgt.label))]); })
      .then(function () { return area.show(); })
      .then(function () {
        return askNumber({
          ask: 'p5Ask', label: 'lblHeightEq', unit: 'unitCm', check: 'btnCheckHeight', answer: 5, right: 'p5Right',
          calc: [T('p5Calc'), T('p5Check')],
          feedback: function (v) {
            var key = v === 32 ? 'p5Wrong32' : v === 320 ? 'p5Wrong320' : 'p5WrongOther';
            return Promise.all([K.say(key, 'confused'), Flow.anim(Beats.emphasise(area.el))]);
          },
          onRight: function () {
            return Flow.anim(Beats.labelsOut(hgt.label)).then(function () {
              hgt.label.textContent = cm(5);
              return Flow.anim(Beats.labelIn(hgt.label));
            });
          }
        }, g);
      });
  }

  /* ---- 5. the garden bed: 9 x 4 ---------------------------------------------- */
  function q5() {
    var k = 35;
    var g = P.el('g', {}, group);
    var pts = place([[0, 0], [9, 0], [11, 4], [2, 4]], k);
    var A = pts[0], B = pts[1], C = pts[2], D = pts[3];
    var s = P.build(g, pts, { fillCls: 'is-garden' });
    var dots = P.el('path', { 'class': 'pg__garden-dots', d: P.pathOf(pts) }, g);
    s.g.insertBefore(dots, s.outline);
    /* a few sprigs */
    var plants = P.el('g', { 'class': 'pg__plant' }, g);
    [[0.3, 0.3], [0.55, 0.65], [0.72, 0.25], [0.42, 0.78], [0.85, 0.6]].forEach(function (f) {
      var p = P.add(P.add(A, P.mul(P.sub(B, A), f[0])), P.mul(P.sub(D, A), f[1]));
      P.el('path', { d: 'M' + p.x + ' ' + (p.y + 8) + ' L' + p.x + ' ' + (p.y - 8) + ' M' + p.x + ' ' + (p.y - 2) + ' L' + (p.x - 7) + ' ' + (p.y - 9) + ' M' + p.x + ' ' + (p.y - 4) + ' L' + (p.x + 7) + ' ' + (p.y - 11) }, plants);
      P.el('circle', { cx: p.x, cy: p.y - 11, r: 3 }, plants);
    });
    s.g.insertBefore(plants, s.outline);
    s.sides[0].classList.add('is-base');
    var hgt = P.height(g, D, A, B, { raCls: 'is-orange', label: m(4), labelCls: 'is-orange', labelSide: 1, labelGap: 30 });
    var baseLbl = P.label(g, m(9), { cls: 'is-teal', at: { x: P.mid(A, B).x, y: A.y + 26 } });
    return Flow.anim(Beats.drawShape(s, { time: 1.1 }))
      .then(function () { return Flow.anim(Beats.fadeIn([dots, plants], 0.5)); })
      .then(function () { return Flow.anim(Beats.labelIn(baseLbl)); })
      .then(function () { return Flow.anim(Beats.dashedIn(hgt.line, 0.5)); })
      .then(function () { return Promise.all([Flow.anim(Beats.growLine(hgt.ra, 0.25)), Flow.anim(Beats.labelIn(hgt.label))]); })
      .then(function () {
        return askNumber({
          ask: 'p6Ask', unit: 'unitM2', answer: 36, right: 'p6Right', calc: stacked('p6Calc'),
          feedback: function (v) {
            var key = v === 13 ? 'p6Wrong13' : v === 26 ? 'p6Wrong26' : 'p6WrongOther';
            return Promise.all([K.say(key, 'confused'), Flow.anim(Beats.partPulse([s.sides[0], hgt.line], 2))]);
          }
        }, g);
      });
  }

  /* ---- 6. three measurements, two needed: 6 x 3 ------------------------------ */
  function q6() {
    var k = 37;
    var g = P.el('g', {}, group);
    var pts = place([[0, 0], [6, 0], [10, 3], [4, 3]], k);
    var A = pts[0], B = pts[1], C = pts[2], D = pts[3];
    var s = P.build(g, pts, {});
    s.sides[0].classList.add('is-base');
    var hgt = P.height(g, C, A, B, { ext: true, raCls: 'is-orange', label: cm(3), labelCls: 'is-orange', labelSide: -1, labelGap: 30 });
    var baseLbl = P.label(g, cm(6), { cls: 'is-teal', at: { x: P.mid(A, B).x, y: A.y + 26 } });
    var slantLbl = P.label(g, cm(5), { at: P.add(P.mid(B, C), { x: -36, y: -4 }) });
    var formula = null;
    return Flow.anim(Beats.drawShape(s, { time: 1.1 }))
      .then(function () { return Flow.anim(Beats.labelsIn([baseLbl, slantLbl], 0.2)); })
      .then(function () { return Flow.anim(Beats.dashedIn(hgt.ext, 0.4)); })
      .then(function () { return Flow.anim(Beats.dashedIn(hgt.line, 0.5)); })
      .then(function () { return Promise.all([Flow.anim(Beats.growLine(hgt.ra, 0.25)), Flow.anim(Beats.labelIn(hgt.label))]); })
      .then(function () {
        return askNumber({
          ask: 'p7Ask', answer: 18, right: 'p7Right', calc: stacked('p7Calc'),
          feedback: function (v) {
            if (v === 30) {
              /* the slanting side and its label glow amber for the first line,
                 the marker pulses for the second */
              return Promise.all([K.say('p7Wrong30a', 'confused'), Flow.anim(Beats.holdClass([s.sides[1], slantLbl], 'is-wrong', 2.2))])
                .then(function () { return Promise.all([K.say('p7Wrong30b', 'confused'), Flow.anim(Beats.partPulse(hgt.ra, 3, 0.8))]); });
            }
            formula = formula || formulaCard();
            return Promise.all([K.say('p7WrongOther', 'confused'), formula.show(),
              Flow.anim(Beats.partPulse(s.sides[0], 1)).then(function () { return Flow.anim(Beats.partPulse(hgt.line, 1)); })]);
          },
          onRight: function () { return Flow.anim(Beats.partPulse([s.sides[0], hgt.line], 2)); }
        }, g);
      });
  }

  function scenePractice() {
    return K.wipeBoard()
      .then(function () { group.removeAttribute('hidden'); })
      .then(q1).then(q2).then(q3).then(q4).then(q5).then(q6);
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
    name: 'Practice',
    scenes: [{ name: 'Find the area', play: scenePractice }],
    build: build, parts: parts, wipe: wipe, reset: reset, stage: stage
  });
})(window);
