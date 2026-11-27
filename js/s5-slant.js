/* ==========================================================================
 * s5-slant.js -- the experiment: stretch the slant
 * --------------------------------------------------------------------------
 * A parallelogram with a 6 cm base and a 3 cm height, its area hidden. A
 * purple handle on the top edge slides left and right: the base stays, the
 * top edge moves, the height guide keeps to whichever top corner stands
 * over the base, and the shape is always a parallelogram. After the first
 * drag the question comes: has the area changed? Three answers in the
 * footer; the handle stays live while it is open. A wrong one measures the
 * base and the height again; the right one writes the working in, and
 * "Area = ?" becomes "Area = 18 cm²".
 * ========================================================================== */
(function (global) {
  'use strict';

  var Flow = global.Flow, Beats = global.Beats, Pages = global.Pages, P = global.Para, W = global.W, M = global.Motion;
  if (!Pages || !Pages.addSection) { console.error('s5-slant.js: load js/pages.js first.'); return; }
  var K = Pages.kit;
  function T(k, r) { return global.T ? global.T(k, r) : k; }
  var BEAT = K.BEAT, SHORT = K.SHORT, LOOK = K.LOOK;
  var KS = 50, BASE = 6, H = 3, MAX = 4;
  var ORIGIN = { x: 500 - 3 * KS - 70, y: 215 + 1.5 * KS };

  var dom = null, group = null, layerNodes = [];
  function build(kit) { dom = kit.dom(); group = document.getElementById('figSlant'); }
  function drop(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
    var i = layerNodes.indexOf(el);
    if (i >= 0) layerNodes.splice(i, 1);
  }
  function toFig(ev) {
    var pt = dom.figure.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    var m = dom.figure.getScreenCTM();
    return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
  }
  function centreOf(el) { var r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

  function ptsAt(o) { return P.cm([[0, 0], [BASE, 0], [BASE + o, H], [o, H]], ORIGIN, KS); }

  function sceneSlant() {
    var g, s, baseLbl, hgt, hg, halo, core, arrows, handle, areaCard, areaRow;
    var off = 2;                                   /* the slant, in cm */
    var topPt = function () { return off >= 0 ? s.pts[3] : s.pts[2]; };
    /* built once the board is wiped, or the wipe would take it with it */
    function make() {
    g = P.el('g', {}, group);
    s = P.build(g, ptsAt(off), {});
    s.sides[0].classList.add('is-base');
    baseLbl = P.label(g, T('lblCm', { n: 6 }), { cls: 'is-teal', at: function () { return { x: P.mid(s.pts[0], s.pts[1]).x, y: s.pts[0].y + 26 }; } });
    s.keep(baseLbl);
    /* the height guide, dropped from whichever top corner stands over the base */
    hgt = P.height(g, topPt, function () { return s.pts[0]; }, function () { return s.pts[1]; },
                       { raCls: 'is-orange', label: T('lblCm', { n: 3 }), labelCls: 'is-orange', labelSide: 1, labelGap: 30 });
    s.keep(hgt);
    /* the handle on the top edge */
    hg = P.el('g', { 'class': 'pg__handle', role: 'slider', tabindex: -1 }, g);
    hg.setAttribute('aria-label', T('a11yHandle'));
    hg.setAttribute('aria-valuemin', -MAX); hg.setAttribute('aria-valuemax', MAX);
    halo = P.el('circle', { 'class': 'pg__handle-halo', r: 30 }, hg);
    core = P.el('circle', { 'class': 'pg__handle-core', r: 13 }, hg);
    arrows = P.el('path', { 'class': 'pg__handle-arrows' }, hg);
    handle = { layout: function () {
      var m = P.mid(s.pts[2], s.pts[3]);
      [halo, core].forEach(function (c) { c.setAttribute('cx', m.x); c.setAttribute('cy', m.y); });
      arrows.setAttribute('d', 'M' + (m.x - 24) + ' ' + m.y + ' L' + (m.x - 32) + ' ' + m.y + ' M' + (m.x - 28) + ' ' + (m.y - 5) + ' L' + (m.x - 33) + ' ' + m.y + ' L' + (m.x - 28) + ' ' + (m.y + 5) +
                               ' M' + (m.x + 24) + ' ' + m.y + ' L' + (m.x + 32) + ' ' + m.y + ' M' + (m.x + 28) + ' ' + (m.y - 5) + ' L' + (m.x + 33) + ' ' + m.y + ' L' + (m.x + 28) + ' ' + (m.y + 5));
      hg.setAttribute('aria-valuenow', off.toFixed(1));
    } };
    s.keep(handle);
    s.set();
    areaCard = W.card(dom.layer, { cls: 'card--formula', left: 79, top: 36, centre: true });
    layerNodes.push(areaCard.el);
    areaRow = areaCard.row(T('lblAreaQ'), 'is-result');
    }
    var formula = null, calc = null;

    /* ---- the drag ----------------------------------------------------------- */
    var live = false, press = null, dragged = false, stopHand = null, touched = false;
    function setOff(o) {
      off = Math.max(-MAX, Math.min(MAX, o));
      s.set(ptsAt(off));
    }
    function onDown(ev) {
      if (!live || press) return;
      if (ev.cancelable) ev.preventDefault();
      touched = true;
      if (stopHand) { stopHand(); stopHand = null; }
      var q = toFig(ev);
      press = { id: ev.pointerId, x0: q.x, o0: off, moved: false };
      try { hg.setPointerCapture(ev.pointerId); } catch (e) {}
      hg.classList.add('is-held');
      hg.classList.remove('is-calling');
    }
    function onMove(ev) {
      if (!press || ev.pointerId !== press.id) return;
      var q = toFig(ev);
      var o = press.o0 + (q.x - press.x0) / KS;
      if (Math.abs(q.x - press.x0) > 3) press.moved = true;
      setOff(o);
    }
    function onUp(ev) {
      if (!press || ev.pointerId !== press.id) return;
      var p = press; press = null;
      hg.classList.remove('is-held');
      if (p.moved && !dragged) { dragged = true; dom.gate.dispatchEvent(new MouseEvent('click')); }
    }
    function onKey(ev) {
      if (!live) return;
      var d = ev.key === 'ArrowLeft' ? -0.5 : ev.key === 'ArrowRight' ? 0.5 : 0;
      if (!d) return;
      ev.preventDefault();
      touched = true;
      if (stopHand) { stopHand(); stopHand = null; }
      setOff(off + d);
      if (!dragged) { dragged = true; dom.gate.dispatchEvent(new MouseEvent('click')); }
    }
    function arm() {
      live = true;
      g.classList.add('is-live');
      hg.setAttribute('tabindex', '0');
      hg.classList.add('is-calling');
      hg.addEventListener('pointerdown', onDown);
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
      hg.addEventListener('keydown', onKey);
      K.quiet(Flow.wait(K.NUDGE_AFTER).then(function () {
        if (!touched && live) stopHand = W.handDrag(function () { return centreOf(core); }, function () { var c = centreOf(core); return { x: c.x - 120, y: c.y }; }, 56);
      }));
    }
    function disarm() {
      live = false;
      if (stopHand) { stopHand(); stopHand = null; }
      g.classList.remove('is-live');
      hg.classList.remove('is-calling', 'is-held');
      hg.setAttribute('tabindex', '-1');
      hg.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      hg.removeEventListener('keydown', onKey);
    }
    /* the first drag: waited on through the gate; a skip counts as one */
    function firstDrag() {
      arm();
      return Flow.once(dom.gate, { auto: true }).then(function () {
        if (!dragged) { dragged = true; setOff(-2); }
        touched = true;
        if (stopHand) { stopHand(); stopHand = null; }
      }, function (err) { disarm(); throw err; });
    }

    return K.wipeBoard()
      /* the shape draws while the bird wonders aloud, not after */
      .then(function () { group.removeAttribute('hidden'); make(); return Promise.all([K.say('s0Intro'), Flow.anim(Beats.drawShape(s, { time: 1.2 }))]); })
      .then(function () { return Flow.anim(Beats.labelIn(baseLbl)); })
      .then(function () { return Flow.anim(Beats.dashedIn(hgt.line, 0.5)); })
      .then(function () { return Promise.all([Flow.anim(Beats.growLine(hgt.ra, 0.25)), Flow.anim(Beats.labelIn(hgt.label))]); })
      .then(function () { return areaCard.show(); })
      .then(function () { return K.say('s1Ask'); })
      .then(function () { return K.say('s1Tap'); })
      .then(function () { return Flow.anim(Beats.fadeIn(hg, 0.3)); })
      .then(firstDrag)
      .then(function () { return K.autoTurn(400); })

      /* ---- has the area changed? ------------------------------------------- */
      .then(function () { return K.say('s2Ask'); })
      .then(function () { return K.offerChoices([T('s2OptA'), T('s2OptB'), T('s2OptC')]); })
      .then(function (btns) {
        return K.askUntilRight(btns, 2, {
          keep: true,
          onWrong: function () {
            var acts = [K.say('s2Wrong', 'confused'),
                        Flow.anim(Beats.partPulse([s.sides[0], hgt.line], 2)),
                        Flow.anim(Beats.glowText([baseLbl, hgt.label], 2))];
            if (!formula) {
              formula = W.card(dom.layer, { cls: 'card--formula', left: 79, top: 56, centre: true });
              layerNodes.push(formula.el);
              var r = formula.row(T('s2Formula'), 'is-result');
              M.set(r.el, { opacity: 1 });
              acts.push(formula.show());
            }
            return Promise.all(acts);
          }
        });
      })
      .then(function () {
        disarm();
        calc = W.card(dom.layer, { cls: 'card--formula card--calc', left: 50, bottom: 3, centre: true });
        layerNodes.push(calc.el);
        var rows = [calc.row(T('s2Formula'), 'is-result'), calc.row('= 6 × 3', 'is-result'), calc.row('= 18 cm²', 'is-result')];
        var acted = K.onPhrase('s2Right', 'Same', function () {
          var chain = formula ? Flow.anim(Beats.cardOut(formula.el)).then(function () { drop(formula.el); }) : Promise.resolve();
          return chain.then(function () { M.set(calc.el, { opacity: 1 }); return Flow.anim(Beats.ruleIn(calc.el)); })
            .then(function () { return rows[0].show(); })
            .then(function () { return rows[1].show(); })
            .then(function () { return rows[2].show(); })
            .then(function () { areaRow.set(T('lblArea18')); return Flow.anim(Beats.emphasise(areaCard.el)); });
        });
        return Promise.all([K.say('s2Right', 'happy'), acted]);
      })
      .then(function () { return Flow.wait(BEAT); })
      .then(function () { return K.clearChoices(); })
      .then(function () { return K.autoTurn(900); });
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
    name: 'Stretch the slant',
    scenes: [{ name: 'Does the area change?', play: sceneSlant }],
    build: build, parts: parts, wipe: wipe, reset: reset, stage: stage
  });
})(window);
