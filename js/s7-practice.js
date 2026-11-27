/* ==========================================================================
 * s7-practice.js -- the practice: six parallelograms, a number pad
 * --------------------------------------------------------------------------
 * Every question is laid out and played the same way, as the recall before
 * it:
 *   - the shape is drawn in the left half of the board;
 *   - the bird stands on its perch in the right half and asks in its bubble;
 *   - under it, centred in the right half, the answer line comes up:
 *     "Area = [ ] cm²";
 *   - pressing the box opens the number pad beside the bird -- the keys
 *     (0 two wide, backspace beside it) and the check button; a hand taps
 *     the box if it is left alone;
 *   - Check. A wrong number turns the box amber and shakes it, the bubble
 *     turns amber with the reason -- the slip the storyboard names for that
 *     number, or the general one -- and the keys wait until it is said; the
 *     hints on the figure deepen with each try. The formula itself is never
 *     put up as a hint;
 *   - the right number turns the box green, the pad folds away, the bubble
 *     turns green and confetti bursts over the shape -- no working is
 *     written out. Then Next, and the next question opens the same way.
 *   1. guided: tap the base, tap its height (each lands under the bird),
 *      then 4 x 3
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
  var SHORT = K.SHORT;
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

  /* ---- the right half: the bird on its perch ------------------------------- */
  /* A wrong answer's reason: in the bubble, tinted amber. */
  function no(key) { return K.perchSay(key, 'confused', 'no'); }
  /* A line under the bird, centred in the right half (css/para.css:
     .perch__under). */
  function underBird() {
    var slot = W.h('div', 'perch__under', K.perchRoot());
    layerNodes.push(slot);
    return slot;
  }

  /* ---- the ask: the answer line under the bird, the pad beside it ------------
     q: { ask (key), label, unit, check, answer, feedback(value, tries) ->
     promise, right (key), onRight() }; s: the shape (its centre takes the
     confetti); g: its group, cleared once Next is pressed. No working is
     written out: the right answer in its box is the whole of it. */
  function askNumber(q, g, s) {
    var pad = W.keypad(K.perchRoot(), {
      label: T(q.label || 'lblAreaEq'), unit: T(q.unit || 'unitCm2'), answer: q.answer,
      check: T(q.check || 'btnCheckArea'), max: 3, nudgeAfter: K.NUDGE_AFTER,
      onWrong: function (v, tries) { return q.feedback(v, tries); }
    });
    layerNodes.push(pad.el, pad.pad);
    return K.perchSay(q.ask)
      .then(function () { return pad.show(); })
      .then(function () { return pad.ask(); })
      .then(function (res) {
        var c = s.centre();
        K.burstAt(c.x, c.y);
        return Promise.all([K.perchRight(q.right, res), q.onRight ? q.onRight() : null]);
      })
      .then(function () { K.mascot().settle(); return Flow.wait(SHORT); })
      .then(function () { return K.handOver(); })
      .then(function () { return clearQuestion(g); });
  }
  /* Next pressed: the answer line, the pad and the shape go; the bird
     stays on its perch for the next question. */
  function clearQuestion(g) {
    var nodes = layerNodes.slice();
    return Promise.all([Flow.anim(Beats.cardOut(nodes)), Flow.anim(Beats.clearFigure([g]))]).then(function () {
      nodes.forEach(drop);
      if (g.parentNode) g.parentNode.removeChild(g);
    });
  }

  /* ---- 1. guided: 4 x 3 --------------------------------------------------- */
  function q1() {
    var k = 50;
    var g = P.el('g', {}, group);
    var pts = place([[0, 0], [4, 0], [5.5, 3], [1.5, 3]], k, 188);
    var A = pts[0], B = pts[1], D = pts[3];
    var s = P.build(g, pts, { hits: true });
    var hgt = P.height(g, D, A, B, { cls: 'is-grey', raCls: 'is-orange', hit: true, label: cm(3), labelCls: 'is-grey', labelSide: 1, labelGap: 30 });
    var baseLbl = P.label(g, cm(4), { cls: 'is-grey', at: { x: P.mid(A, B).x, y: A.y + 26 } });
    var facts = null, grid = null;
    /* the shape drawn on the left while the bird jumps onto its perch on the
       right with its first line */
    var drawn = Flow.anim(Beats.drawShape(s, { time: 1.2 }))
      .then(function () { return Flow.anim(Beats.labelIn(baseLbl)); })
      .then(function () { return Flow.anim(Beats.dashedIn(hgt.line, 0.5)); })
      .then(function () { return Promise.all([Flow.anim(Beats.growLine(hgt.ra, 0.25)), Flow.anim(Beats.labelIn(hgt.label))]); });
    return Promise.all([drawn, K.perchSay('p0Intro')])
      .then(function () { return K.perchSay('p1Ask'); })
      .then(function () { return K.perchSay('p1TapBase'); })
      /* step A: the base */
      .then(function () {
        g.classList.add('is-live');
        var hits = [s.hits[0], s.hits[1], s.hits[3], hgt.hit], lines = [s.sides[0], s.sides[1], s.sides[3], hgt.line];
        return K.tapOn(hits, {
          answer: 0, mark: function (i) { return lines[i]; },
          onWrong: function () { return no('p1WrongBase'); }
        }).then(function () { g.classList.remove('is-live'); });
      })
      .then(function () {
        s.sides[0].classList.remove('is-right');
        s.sides[0].classList.add('is-base');
        baseLbl.classList.remove('is-grey'); baseLbl.classList.add('is-teal');
        /* what was found lands under the bird */
        facts = W.card(underBird(), { cls: 'card--formula' });
        var r1 = facts.row(T('p1BaseIs'), 'is-result');
        M.set(r1.el, { opacity: 1 });
        return Promise.all([facts.show(), Flow.anim(Beats.partPulse(s.sides[0], 1))]);
      })
      .then(function () { return K.perchSay('p1TapHeight'); })
      /* step B: its height */
      .then(function () {
        g.classList.add('is-live');
        var hits = [hgt.hit, s.hits[1], s.hits[3]], lines = [hgt.line, s.sides[1], s.sides[3]];
        hits.forEach(function (h) { h.classList.remove('is-done'); });
        return K.tapOn(hits, {
          answer: 0, mark: function (i) { return lines[i]; },
          onWrong: function () { return no('p1WrongHeight'); }
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
      /* step 2: the facts make way for the answer line */
      .then(function () {
        var slot = facts.el.parentNode;
        return Flow.anim(Beats.cardOut(slot)).then(function () { drop(slot); });
      })
      .then(function () {
        return askNumber({
          ask: 'p2Ask', answer: 12, right: 'p2Right',
          /* the hints point at the figure only -- the formula is never shown */
          feedback: function (v, tries) {
            var acts = [no(tries === 1 ? 'p2Wrong1' : 'p2Wrong2'), Flow.anim(Beats.partPulse([s.sides[0], hgt.line], 2))];
            if (tries >= 2) acts.push(Flow.anim(Beats.glowText([baseLbl, hgt.label], 2)));
            if (tries >= 3) {
              if (!grid) grid = P.grid(g, { x: A.x, y: A.y }, k, 4, 3, { shear: D.x - A.x });
              acts.push(Flow.anim(Beats.fadeIn(grid, 0.5)));
            }
            return Promise.all(acts);
          }
        }, g, s);
      });
  }

  /* The shape's own marks drawn in after its outline: the base's label,
     then the height -- dashed, its right angle, its label. */
  function drawMarks(s, labels, hgt) {
    return Flow.anim(Beats.drawShape(s, { time: 1.1 }))
      .then(function () { return Flow.anim(labels.length > 1 ? Beats.labelsIn(labels, 0.2) : Beats.labelIn(labels[0])); })
      .then(function () { return hgt.ext ? Flow.anim(Beats.dashedIn(hgt.ext, 0.4)) : null; })
      .then(function () { return Flow.anim(Beats.dashedIn(hgt.line, 0.5)); })
      .then(function () { return Promise.all([Flow.anim(Beats.growLine(hgt.ra, 0.25)), Flow.anim(Beats.labelIn(hgt.label))]); });
  }

  /* ---- 2. solo: the base on top, 8 x 3 --------------------------------------- */
  function q2() {
    var k = 37;
    var g = P.el('g', {}, group);
    var pts = place([[1.5, 0], [9.5, 0], [8, 3], [0, 3]], k);
    var A = pts[0], C = pts[2], D = pts[3];
    var s = P.build(g, pts, {});
    s.sides[2].classList.add('is-base');
    var hgt = P.height(g, A, D, C, { raCls: 'is-orange', label: cm(3), labelCls: 'is-orange', labelSide: -1, labelGap: 30 });
    var baseLbl = P.label(g, cm(8), { cls: 'is-teal', at: { x: P.mid(C, D).x, y: D.y - 24 } });
    return drawMarks(s, [baseLbl], hgt)
      .then(function () {
        return askNumber({
          ask: 'p3Ask', answer: 24, right: 'p3Right',
          feedback: function (v, tries) {
            var acts = [no(v === 11 ? 'p3Wrong' : 'p3WrongOther')];
            if (tries >= 2) acts.push(Flow.anim(Beats.glowText([baseLbl, hgt.label], 2)), Flow.anim(Beats.partPulse([s.sides[2], hgt.line], 2)));
            return Promise.all(acts);
          },
          onRight: function () { return Flow.anim(Beats.partPulse([s.sides[2], hgt.line], 2)); }
        }, g, s);
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
    return drawMarks(s, [botLbl, baseLbl], hgt)
      .then(function () {
        return askNumber({
          ask: 'p4Ask', answer: 48, right: 'p4Right',
          feedback: function (v) {
            var key = v === 72 ? 'p4Wrong72' : v === 96 ? 'p4Wrong96' : 'p4WrongOther';
            return Promise.all([no(key), Flow.anim(Beats.partPulse([s.sides[1], hgt.line], 2))]);
          },
          onRight: function () { return Flow.anim(Beats.partPulse([s.sides[1], hgt.line], 2)); }
        }, g, s);
      });
  }

  /* ---- 4. the area given: 40 / 8 ------------------------------------------- */
  function q4() {
    var k = 37;
    var g = P.el('g', {}, group);
    var pts = place([[0, 0], [8, 0], [10, 5], [2, 5]], k, 190);
    var A = pts[0], B = pts[1], D = pts[3];
    var s = P.build(g, pts, {});
    s.sides[0].classList.add('is-base');
    var hgt = P.height(g, D, A, B, { raCls: 'is-orange', label: T('lblQcm'), labelCls: 'is-orange', labelSide: 1, labelGap: 32 });
    var baseLbl = P.label(g, cm(8), { cls: 'is-teal', at: { x: P.mid(A, B).x, y: A.y + 26 } });
    /* what is given, over the shape */
    var area = W.card(dom.layer, { cls: 'card--formula', left: 26, top: 4, centre: true });
    layerNodes.push(area.el);
    var ar = area.row(T('p5Area'), 'is-result'); M.set(ar.el, { opacity: 1 });
    return drawMarks(s, [baseLbl], hgt)
      .then(function () { return area.show(); })
      .then(function () {
        return askNumber({
          ask: 'p5Ask', label: 'lblHeightEq', unit: 'unitCm', check: 'btnCheckHeight', answer: 5, right: 'p5Right',
          feedback: function (v) {
            var key = v === 32 ? 'p5Wrong32' : v === 320 ? 'p5Wrong320' : 'p5WrongOther';
            return Promise.all([no(key), Flow.anim(Beats.emphasise(area.el))]);
          },
          onRight: function () {
            return Flow.anim(Beats.labelsOut(hgt.label)).then(function () {
              hgt.label.textContent = cm(5);
              return Flow.anim(Beats.labelIn(hgt.label));
            });
          }
        }, g, s);
      });
  }

  /* ---- 5. the garden bed: 9 x 4 ---------------------------------------------- */
  function q5() {
    var k = 35;
    var g = P.el('g', {}, group);
    var pts = place([[0, 0], [9, 0], [11, 4], [2, 4]], k);
    var A = pts[0], B = pts[1], D = pts[3];
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
          ask: 'p6Ask', unit: 'unitM2', answer: 36, right: 'p6Right',
          feedback: function (v) {
            var key = v === 13 ? 'p6Wrong13' : v === 26 ? 'p6Wrong26' : 'p6WrongOther';
            return Promise.all([no(key), Flow.anim(Beats.partPulse([s.sides[0], hgt.line], 2))]);
          }
        }, g, s);
      });
  }

  /* ---- 6. three measurements, two needed: 6 x 3 ------------------------------ */
  function q6() {
    var k = 37;
    var g = P.el('g', {}, group);
    var pts = place([[0, 0], [6, 0], [10, 3], [4, 3]], k);
    var A = pts[0], B = pts[1], C = pts[2];
    var s = P.build(g, pts, {});
    s.sides[0].classList.add('is-base');
    var hgt = P.height(g, C, A, B, { ext: true, raCls: 'is-orange', label: cm(3), labelCls: 'is-orange', labelSide: -1, labelGap: 30 });
    var baseLbl = P.label(g, cm(6), { cls: 'is-teal', at: { x: P.mid(A, B).x, y: A.y + 26 } });
    var slantLbl = P.label(g, cm(5), { at: P.add(P.mid(B, C), { x: -36, y: -4 }) });
    return drawMarks(s, [baseLbl, slantLbl], hgt)
      .then(function () {
        return askNumber({
          ask: 'p7Ask', answer: 18, right: 'p7Right',
          feedback: function (v) {
            if (v === 30) {
              /* the slanting side and its label glow amber for the first line,
                 the marker pulses for the second */
              return Promise.all([no('p7Wrong30a'), Flow.anim(Beats.holdClass([s.sides[1], slantLbl], 'is-wrong', 2.2))])
                .then(function () { return Promise.all([no('p7Wrong30b'), Flow.anim(Beats.partPulse(hgt.ra, 3, 0.8))]); });
            }
            return Promise.all([no('p7WrongOther'),
              Flow.anim(Beats.partPulse(s.sides[0], 1)).then(function () { return Flow.anim(Beats.partPulse(hgt.line, 1)); })]);
          },
          onRight: function () { return Flow.anim(Beats.partPulse([s.sides[0], hgt.line], 2)); }
        }, g, s);
      });
  }

  function scenePractice() {
    return K.wipeBoard()
      /* the header shut first, so every shape is drawn at the size it keeps
         and the bird's perch has the right half to itself */
      .then(function () { return Flow.anim(K.collapseHeader(true)); })
      .then(function () {
        /* the perch laid out for the pad (css/para.css: .perch--keypad),
           before the bird jumps onto it */
        K.perchRoot().classList.add('perch--keypad');
        group.removeAttribute('hidden');
      })
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
