/* ==========================================================================
 * s6-recall.js -- complete the formula: Area = Base × ____
 * --------------------------------------------------------------------------
 * A recall check before the practice. The parallelogram shows and names all
 * three answers -- the base (teal), the height (orange, dashed, on the right,
 * with its marker at the top), a slanting side (purple) and a diagonal
 * (grey, dash-dot) -- and three answers stand in the footer. A wrong one
 * turns amber and shakes, its part on the figure glows amber, and the
 * right-angle marker pulses; the second wrong try lights the height with
 * the base; the third shows the formula card briefly. Right: "Yes! Area =
 * Base × Height." and Continue.
 * ========================================================================== */
(function (global) {
  'use strict';

  var Flow = global.Flow, Beats = global.Beats, Pages = global.Pages, P = global.Para, W = global.W, M = global.Motion;
  if (!Pages || !Pages.addSection) { console.error('s6-recall.js: load js/pages.js first.'); return; }
  var K = Pages.kit;
  function T(k, r) { return global.T ? global.T(k, r) : k; }
  var BEAT = K.BEAT, SHORT = K.SHORT, LOOK = K.LOOK;
  var KS = 54;
  var ORIGIN = { x: 500 - 4 * KS - 40, y: 200 + 1.5 * KS };

  var dom = null, group = null, layerNodes = [];
  function build(kit) { dom = kit.dom(); group = document.getElementById('figRecall'); }
  function drop(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
    var i = layerNodes.indexOf(el);
    if (i >= 0) layerNodes.splice(i, 1);
  }

  function sceneRecall() {
    var g, pts, A, B, C, D, s, baseLbl, hgt, slantLbl, diag, diagLbl, marks;
    var title = null, formula = null;
    /* built once the board is wiped, or the wipe would take it with it */
    function make() {
      g = P.el('g', {}, group);
      pts = P.cm(P.MAIN.cm, ORIGIN, KS);
      A = pts[0]; B = pts[1]; C = pts[2]; D = pts[3];
      s = P.build(g, pts, {});
      s.sides[0].classList.add('is-base');
      s.sides[1].classList.add('is-slant');
      baseLbl = P.label(g, T('lblBaseLower'), { cls: 'is-teal is-italic', at: { x: P.mid(A, B).x, y: A.y + 26 } });
      /* the height on the right: from the top edge down to the base's right
         end, its marker at the top where it meets the upper side */
      hgt = P.height(g, B, C, D, { raCls: 'is-orange', ra: 'foot', label: T('lblHeightLower'), labelCls: 'is-orange is-italic', labelSide: -1, labelGap: 44 });
      slantLbl = P.label(g, T('lblSlantLower'), { cls: 'is-purple is-italic', at: { x: P.mid(B, C).x + 92, y: P.mid(B, C).y + 30 } });
      diag = P.el('path', { 'class': 'pg__diag', d: P.seg(A, C) }, g);
      diagLbl = P.label(g, T('lblDiagonal'), { cls: 'is-grey is-italic is-small', at: { x: P.mid(A, C).x - 10, y: P.mid(A, C).y - 22 } });
      marks = { 0: hgt.line, 1: s.sides[1], 2: diag };
    }
    return K.wipeBoard()
      .then(function () {
        group.removeAttribute('hidden');
        make();
        title = W.caption(dom.layer, T('r1Title'), { cls: 'is-lime', left: 50, top: 2, centre: true });
        layerNodes.push(title);
        return Flow.anim(Beats.drawShape(s, { time: 1.2 }));
      })
      .then(function () { return Flow.anim(Beats.labelIn(baseLbl)); })
      .then(function () { return Flow.anim(Beats.dashedIn(hgt.line, 0.5)); })
      .then(function () { return Promise.all([Flow.anim(Beats.growLine(hgt.ra, 0.25)), Flow.anim(Beats.labelIn(hgt.label))]); })
      .then(function () { return Flow.anim(Beats.labelIn(slantLbl)); })
      .then(function () { return Flow.anim(Beats.dashedIn(diag, 0.5)); })
      .then(function () { return Flow.anim(Beats.labelIn(diagLbl)); })
      .then(function () { return Flow.anim(Beats.cardIn(title)); })
      .then(function () { return K.say('r1Ask'); })
      .then(function () { return K.offerChoices([T('r1OptH'), T('r1OptS'), T('r1OptD')]); })
      .then(function (btns) {
        return K.askUntilRight(btns, 0, {
          keep: true,
          onWrong: function (i, tries) {
            var mark = marks[i];
            var acts = [K.say(i === 1 ? 'r1WrongS' : 'r1WrongD', 'confused')];
            /* the part on the figure glows amber, then the marker pulses */
            acts.push(Flow.anim(Beats.holdClass([mark], 'is-wrong', 1.6)).then(function () {
              return Flow.anim(Beats.partPulse(hgt.ra, 2, 0.8));
            }));
            if (tries >= 2) acts.push(Flow.wait(1600).then(function () { return Flow.anim(Beats.partPulse([hgt.line, s.sides[0]], 2)); }));
            if (tries >= 3) {
              if (!formula) {
                formula = W.card(dom.layer, { cls: 'card--formula', left: 50, bottom: 3, centre: true });
                layerNodes.push(formula.el);
                var r = formula.row(T('r1Formula'), 'is-result');
                r.el.style.fontSize = 'clamp(22px, 4.4vh, 44px)';
                M.set(r.el, { opacity: 1 });
              }
              acts.push(formula.show().then(function () { return Flow.wait(2200); })
                .then(function () { return Flow.anim(Beats.cardOut(formula.el)); }));
            }
            return Promise.all(acts);
          }
        });
      })
      .then(function () {
        var c = s.centre();
        K.burstAt(c.x, c.y);
        return Promise.all([K.say('r1Right', 'happy'), Flow.anim(Beats.partPulse([hgt.line, s.sides[0]], 2))]);
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return K.handOver(); })
      .then(function () { return K.clearChoices(); });
  }

  function parts() { return [group]; }
  function wipe() { var nodes = layerNodes.slice(); return nodes.length ? [Flow.anim(Beats.cardOut(nodes))] : []; }
  function reset() {
    group.setAttribute('hidden', '');
    group.textContent = '';
    layerNodes.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    layerNodes = [];
  }
  function stage() {}

  Pages.addSection({
    name: 'Recall',
    scenes: [{ name: 'Complete the formula', play: sceneRecall }],
    build: build, parts: parts, wipe: wipe, reset: reset, stage: stage
  });
})(window);
