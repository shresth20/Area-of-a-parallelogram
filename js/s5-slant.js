/* ==========================================================================
 * s5-slant.js -- the experiment: stretch the slant
 * --------------------------------------------------------------------------
 * A parallelogram with a 6 cm base and a 3 cm height, and the formula
 * written over it in words: Area = Base × Height. A purple handle on the
 * top edge slides left and right: the base stays, the top edge moves, and
 * the height always drops from the TOP-LEFT corner. Slid to the left, that
 * corner leans out past the base, so the height stands outside the shape
 * and the base reaches out to its foot, dashed. After the first drag the
 * question comes: has the area changed? Three answers in the footer; the
 * handle stays live while it is open. A wrong one measures the base and the
 * height again, lighting their words in the formula. The right one carries
 * the 6 cm and the 3 cm off the shape into the formula, each landing where
 * its word stood, and the same line multiplies out:
 *   Area = 6 cm × 3 cm = 18 cm²
 * ========================================================================== */
(function (global) {
  'use strict';

  var Flow = global.Flow, Beats = global.Beats, Pages = global.Pages, P = global.Para, W = global.W, M = global.Motion;
  if (!Pages || !Pages.addSection) { console.error('s5-slant.js: load js/pages.js first.'); return; }
  var K = Pages.kit;
  function T(k, r) { return global.T ? global.T(k, r) : k; }
  var BEAT = K.BEAT;
  var KS = 50, BASE = 6, H = 3, MAX = 4;
  /* the base centred on the board, set low enough to leave the formula
     the room over the top edge */
  var ORIGIN = { x: 500 - BASE / 2 * KS, y: 300 };
  var FORMULA_TOP = 4;          /* % of the stage: the line over the shape */

  var dom = null, group = null, layerNodes = [];
  function build(kit) { dom = kit.dom(); group = document.getElementById('figSlant'); }
  function toFig(ev) {
    var pt = dom.figure.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    var m = dom.figure.getScreenCTM();
    return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
  }
  function centreOf(el) { var r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

  function ptsAt(o) { return P.cm([[0, 0], [BASE, 0], [BASE + o, H], [o, H]], ORIGIN, KS); }

  /* ---- the formula, in pieces ---------------------------------------------- */
  /* Text into an element, "cm²" with its 2 raised. */
  function write(el, text) {
    el.innerHTML = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/²/g, '<sup>2</sup>');
    return el;
  }
  function piece(host, cls, text) {
    var e = document.createElement('span');
    if (cls) e.className = cls;
    if (text != null) write(e, text);
    host.appendChild(e);
    return e;
  }
  /* A word with the value it will become stacked in the same cell. */
  function slot(host, word, value, ink) {
    var el = piece(host, 'formula-slot ' + ink);
    var w = piece(el, 'formula-slot__word', word);
    var v = piece(el, 'formula-slot__val', value);
    v.setAttribute('aria-hidden', 'true');
    M.set(v, { opacity: 0 });
    return { el: el, word: w, val: v };
  }
  /* Screen px per CSS px of an element in the layer: the board may be
     scaled, and the figure held at its size while the answers are open. */
  function scaleOf(el) { var w = el.offsetWidth; return w ? el.getBoundingClientRect().width / w : 1; }

  /* The line changed under its own feet -- a word gone, a piece come -- and
     every piece that was there slides from where it stood to where it
     stands now (measured before and after: transforms only, no frame of
     the move costs a layout). */
  function relayout(row, change, seconds) {
    var list = Array.prototype.slice.call(row.children);
    var k = scaleOf(row);
    var was = list.map(function (p) { return p.hidden ? null : p.getBoundingClientRect().left; });
    change();
    var tl = M.timeline({ willChange: list, willChangeValue: 'transform, opacity',
                          revert: function () { M.set(list, { clearProps: 'transform' }); } });
    list.forEach(function (p, i) {
      if (p.hidden || was[i] == null) return;
      var dx = (was[i] - p.getBoundingClientRect().left) / k;
      if (Math.abs(dx) > 0.5) tl.fromTo(p, { x: dx }, { x: 0, duration: M.dur(seconds || 0.4), ease: 'power2.inOut' }, 0);
    });
    return tl;
  }

  /* A value lifted off the figure and carried into its slot: a copy of the
     label, in the formula's type, rises off the shape, travels up and over
     on a gentle curve, and settles where the word stood; the word steps
     aside as it comes, and the value is the formula's own from then on. */
  function flyInto(lbl, sl, ink) {
    var ghost = document.createElement('div');
    ghost.className = 'fly-value ' + ink;
    ghost.setAttribute('aria-hidden', 'true');
    write(ghost, sl.val.textContent);
    ghost.style.fontSize = (parseFloat(getComputedStyle(sl.val).fontSize) * scaleOf(sl.val)) + 'px';
    document.body.appendChild(ghost);
    var src = lbl.getBoundingClientRect(), dst = sl.val.getBoundingClientRect(), box = ghost.getBoundingClientRect();
    var gw = box.width, gh = box.height;
    var s0 = src.width && gw ? src.width / gw : 1;
    var a = { x: src.left + src.width / 2, y: src.top + src.height / 2 };
    var b = { x: dst.left + dst.width / 2, y: dst.top + dst.height / 2 };
    /* the bend: up past the slot, so the value drops into it from above */
    var c = { x: a.x + (b.x - a.x) * 0.3, y: Math.min(a.y, b.y) - 40 - Math.abs(b.x - a.x) * 0.12 };
    var pen = { t: 0, s: s0 };
    function place() {
      var t = pen.t, u = 1 - t;
      var x = u * u * a.x + 2 * u * t * c.x + t * t * b.x;
      var y = u * u * a.y + 2 * u * t * c.y + t * t * b.y;
      M.set(ghost, { x: x - gw / 2, y: y - gh / 2, scale: pen.s });
    }
    M.set(ghost, { transformOrigin: '50% 50%' });
    place();
    var tl = M.timeline({
      willChange: ghost, willChangeValue: 'transform, opacity',
      revert: function () { if (ghost.parentNode) ghost.parentNode.removeChild(ghost); }
    });
    /* lifted */
    tl.to(ghost, { opacity: 1, duration: M.dur(0.2), ease: 'power2.out' }, 0);
    tl.to(pen, { s: s0 * 1.2, duration: M.dur(0.25), ease: 'power2.out', onUpdate: place }, 0);
    /* carried */
    tl.to(pen, { t: 1, duration: M.dur(0.9), ease: 'power2.inOut', onUpdate: place }, M.gap(0.25));
    tl.to(pen, { s: 1, duration: M.dur(0.9), ease: 'power1.inOut', onUpdate: place }, M.gap(0.25));
    /* the word steps aside, so the value drops into an empty place */
    tl.to(sl.word, { opacity: 0, scale: 0.6, duration: M.dur(0.25), ease: 'power2.in' }, M.gap(0.6));
    /* landed */
    tl.call(function () {
      M.set(sl.val, { opacity: 1 });
      M.set(ghost, { opacity: 0 });
      sl.word.setAttribute('aria-hidden', 'true');
      sl.val.removeAttribute('aria-hidden');
    }, null, M.gap(1.15));
    tl.fromTo(sl.val, { scale: 1.25 }, { scale: 1, duration: M.dur(0.35), ease: 'back.out(2)', immediateRender: false }, M.gap(1.15));
    tl.call(Beats.pop, null, M.gap(1.15));
    return tl;
  }

  function sceneSlant() {
    var g, s, baseLbl, hgt, hg, halo, core, arrows, handle, formula, row, slotB, slotH, tail;
    var off = 2;                                   /* the slant, in cm */
    var outside = false;                           /* the height's foot off the base */
    /* built once the board is wiped, or the wipe would take it with it */
    function make() {
      g = P.el('g', {}, group);
      s = P.build(g, ptsAt(off), {});
      s.sides[0].classList.add('is-base');
      baseLbl = P.label(g, T('lblCm', { n: BASE }), { cls: 'is-teal', at: function () { return { x: P.mid(s.pts[0], s.pts[1]).x, y: s.pts[0].y + 26 }; } });
      s.keep(baseLbl);
      /* the height, always from the top-left corner D. Past A its foot is
         off the base: the base is extended to it, dashed. Its label sits on
         the open side -- inside the shape while the height is, outside
         once it is not. */
      hgt = P.height(g, function () { return s.pts[3]; }, function () { return s.pts[0]; }, function () { return s.pts[1]; },
                     { ext: true, raCls: 'is-orange', label: T('lblCm', { n: H }), labelCls: 'is-orange', labelGap: 40,
                       labelSide: function () { return off >= 0 ? -1 : 1; } });
      hgt.ext.classList.add('is-dashed');
      M.set(hgt.ext, { opacity: 1 });
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
      /* the formula over the shape, in words, each word a piece that a
         value can land in later */
      formula = W.card(dom.layer, { cls: 'card--formula card--line', left: 50, top: FORMULA_TOP, centre: true });
      layerNodes.push(formula.el);
      row = formula.row('', 'is-result is-pieces').el;
      row.textContent = '';
      piece(row, null, T('lblAreaEq'));
      slotB = slot(row, T('lblBaseCap'), T('lblCm', { n: BASE }), 'k-teal');
      piece(row, null, '×');
      slotH = slot(row, T('lblHeightCap'), T('lblCm', { n: H }), 'k-orange');
      tail = piece(row, null, '= ' + T('lblCm2', { n: BASE * H }));
      tail.hidden = true;
    }

    /* ---- the drag ----------------------------------------------------------- */
    var live = false, press = null, dragged = false, stopHand = null, touched = false;
    function setOff(o) {
      off = Math.max(-MAX, Math.min(MAX, o));
      s.set(ptsAt(off));
      /* the moment the height steps outside the shape, the right angle out
         there breathes once, so the eye goes to it; the dashed base stays
         plain */
      var out = hgt.foot && hgt.foot.t < -0.001;
      if (out && !outside && live) K.quiet(Flow.anim(Beats.partPulse(hgt.ra, 1, 0.8)));
      outside = out;
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
      /* the hand shows the way to the left: where the height steps out */
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
    /* the first drag: waited on through the gate; a skip counts as one,
       and leans the shape left so the height is seen outside it */
    function firstDrag() {
      arm();
      return Flow.once(dom.gate, { auto: true }).then(function () {
        if (!dragged) { dragged = true; setOff(-2); }
        touched = true;
        if (stopHand) { stopHand(); stopHand = null; }
      }, function (err) { disarm(); throw err; });
    }

    /* ---- the values into the formula ------------------------------------------ */
    /* one value off the shape and into its slot, its label lit as it goes;
       then the line closes up round it */
    function carry(lbl, sl, ink) {
      return Promise.all([Flow.anim(Beats.glowText(lbl, 1)), Flow.anim(flyInto(lbl, sl, ink))])
        .then(function () { return Flow.anim(relayout(row, function () { sl.el.classList.add('is-set'); }, 0.35)); });
    }
    /* the same line multiplied out: "= 18 cm²" comes in at its end */
    function total() {
      var tl = relayout(row, function () { tail.hidden = false; }, 0.4);
      tl.fromTo(tail, { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: M.dur(0.4), ease: 'power3.out' }, M.gap(0.15));
      tl.call(Beats.pop, null, M.gap(0.15));
      return tl;
    }

    return K.wipeBoard()
      /* the shape draws while the bird wonders aloud, not after */
      .then(function () { group.removeAttribute('hidden'); make(); return Promise.all([K.say('s0Intro'), Flow.anim(Beats.drawShape(s, { time: 1.2 }))]); })
      .then(function () { return Flow.anim(Beats.labelIn(baseLbl)); })
      .then(function () { return Flow.anim(Beats.dashedIn(hgt.line, 0.5)); })
      .then(function () { return Promise.all([Flow.anim(Beats.growLine(hgt.ra, 0.25)), Flow.anim(Beats.labelIn(hgt.label))]); })
      .then(function () { return formula.show(); })
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
          /* measure again: the base, then the height, each lit on the shape
             and in the formula as it is asked about */
          onWrong: function () {
            var b = K.onPhrase('s2Wrong', 'base', function () {
              return Promise.all([Flow.anim(Beats.partPulse(s.sides[0], 2)), Flow.anim(Beats.glowText([baseLbl, slotB.word], 2))]);
            });
            var h = K.onPhrase('s2Wrong', 'height', function () {
              return Promise.all([Flow.anim(Beats.partPulse(hgt.line, 2)), Flow.anim(Beats.glowText([hgt.label, slotH.word], 2))]);
            });
            return Promise.all([K.say('s2Wrong', 'confused'), b, h]);
          }
        });
      })
      /* "Same base and same height means the same area": the 6 cm on
         "same base", the 3 cm on "same height", the answer on "same area" */
      .then(function () {
        disarm();
        var base = K.onPhrase('s2Right', 'Same base', function () { return carry(baseLbl, slotB, 'is-teal'); });
        var height = K.onPhrase('s2Right', 'same height', function () {
          return base.then(function () { return carry(hgt.label, slotH, 'is-orange'); });
        });
        var area = K.onPhrase('s2Right', 'same area', function () {
          return height.then(function () { return Flow.anim(total()); })
            .then(function () { return Flow.anim(Beats.emphasise(formula.el)); });
        });
        return Promise.all([K.say('s2Right', 'happy'), base, height, area]);
      })
      .then(function () { return Flow.wait(BEAT); })
      .then(function () { return K.clearChoices(); })
      /* the finished line, left a moment to be read */
      .then(function () { return K.autoTurn(K.LOOK); });
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
