/* ==========================================================================
 * s3-formula.js -- discovering the formula
 * --------------------------------------------------------------------------
 * The rectangle the cut made stands in the right half, the parallelogram it
 * came from (lighter) in the left. Three pages:
 *   1. which part of the parallelogram matches the rectangle's length? --
 *      three name chips on the figure (Base, Height, Slanting side); Base
 *      lights teal, a dotted connector runs to the length, "Length = Base"
 *   2. ...and the breadth? -- Height: the height turns solid orange, its
 *      marker shows, a connector runs to the breadth, "Breadth = Height"
 *   3. the equation builds line by line; line 3 ends in a drop-down the
 *      rule is chosen from, checked at once and shuffled after a wrong
 *      choice, the hints deepening each time; then the final card
 * ========================================================================== */
(function (global) {
  'use strict';

  var Flow = global.Flow, Beats = global.Beats, Pages = global.Pages, P = global.Para, W = global.W, M = global.Motion;
  if (!Pages || !Pages.addSection) { console.error('s3-formula.js: load js/pages.js first.'); return; }
  var K = Pages.kit;
  function T(k, r) { return global.T ? global.T(k, r) : k; }
  var BEAT = K.BEAT, SHORT = K.SHORT, LOOK = K.LOOK;

  var dom = null, group = null, layerNodes = [];
  var para = null, rect = null, pts = null, rpts = null, F = null;
  var hgt = null, chips = {}, lenMark = null, brMark = null, lenLbl = null, brLbl = null;
  var conn1 = null, conn2 = null, card1 = null, card2 = null;

  function build(kit) {
    dom = kit.dom();
    group = document.getElementById('figFormula');
  }
  function drop(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
    var i = layerNodes.indexOf(el);
    if (i >= 0) layerNodes.splice(i, 1);
  }

  /* The two figures as the derivation leaves them (built afresh on a jump):
     the rectangle right, the lighter parallelogram left, the length and
     breadth named. Then the cut's own figure is put away, unseen. */
  function ensureFigures() {
    if (para) return;
    group.removeAttribute('hidden');
    var k = P.MATCH.k;
    pts = P.cm(P.MAIN.cm, P.MATCH.para, k);
    para = P.build(group, pts, {});
    para.fill.classList.add('is-faint');
    Beats.putShape(para);
    F = { x: pts[3].x, y: pts[0].y };
    /* the rectangle: 6 by 3 cm at the right */
    rpts = P.cm([[0, 0], [6, 0], [6, 3], [0, 3]], P.MATCH.rect, k);
    rect = P.build(group, rpts, {});
    Beats.putShape(rect);
    lenMark = P.el('path', { 'class': 'pg__side is-base', d: P.seg(rpts[0], rpts[1]) }, rect.g);
    brMark = P.el('path', { 'class': 'pg__side is-orange', d: P.seg(rpts[1], rpts[2]) }, rect.g);
    lenLbl = P.label(rect.g, T('lblLength'), { cls: 'is-teal is-italic is-small', at: { x: (rpts[0].x + rpts[1].x) / 2, y: rpts[0].y + 22 } });
    brLbl = P.label(rect.g, T('lblBreadth'), { cls: 'is-orange is-italic is-small', at: { x: rpts[1].x + 12, y: (rpts[1].y + rpts[2].y) / 2 }, anchor: 'start' });
    M.set([lenMark, brMark, lenLbl, brLbl], { opacity: 1 });
    /* the parallelogram's height, dashed grey until it is matched */
    hgt = P.height(para.g, pts[3], pts[0], pts[1], { cls: 'is-grey', raCls: 'is-orange' });
    M.set(hgt.line, { opacity: 1 });
    /* the connectors, drawn later */
    conn1 = P.el('path', { 'class': 'pg__connector' }, group);
    conn2 = P.el('path', { 'class': 'pg__connector is-orange' }, group);
    /* the name chips on the parts */
    var mBase = P.mid(pts[0], pts[1]), mSlant = P.mid(pts[1], pts[2]), mH = P.mid(pts[3], F);
    chips.base = P.chip(group, { x: mBase.x, y: mBase.y + 30 }, T('lblBase'), { name: 'base' });
    chips.height = P.chip(group, { x: mH.x - 70, y: mH.y + 46 }, T('lblHeight'), { name: 'height' });
    chips.slant = P.chip(group, { x: pts[2].x + 96, y: mSlant.y - 2 }, T('lblSlant'), { name: 'slant' });
    var cutG = document.getElementById('figCut');
    if (cutG && !cutG.hasAttribute('hidden')) { cutG.setAttribute('hidden', ''); cutG.textContent = ''; }
  }
  function chipList() { return [chips.base, chips.height, chips.slant]; }
  function chipsIn() {
    var list = chipList().map(function (c) { return c.g; });
    var tl = M.timeline({ willChange: list, willChangeValue: 'transform, opacity' });
    list.forEach(function (g, i) {
      var c = chipList()[i].centre;
      tl.fromTo(g, { opacity: 0, scale: 0.7, svgOrigin: c.x + ' ' + c.y }, { opacity: 1, scale: 1, duration: M.dur(0.36), ease: M.POP }, M.gap(i * 0.12));
      tl.call(Beats.pop, null, M.gap(i * 0.12));
    });
    return tl;
  }
  function askPart(answerName, o) {
    var list = chipList();
    group.classList.add('is-live');
    var stopHand = null, touched = false;
    list.forEach(function (c) { c.g.addEventListener('pointerdown', function () { touched = true; if (stopHand) { stopHand(); stopHand = null; } }); });
    K.quiet(Flow.wait(K.NUDGE_AFTER).then(function () {
      if (!touched) stopHand = W.handNudge(chips[answerName].g, { x: 0.5, y: 0.5 });
    }));
    return K.tapOn(list.map(function (c) { return c.g; }), {
      answer: list.indexOf(chips[answerName]),
      origin: function (i) { return list[i].centre.x + ' ' + list[i].centre.y; },
      onWrong: o.onWrong
    }).then(function (res) {
      if (stopHand) stopHand();
      group.classList.remove('is-live');
      return res;
    });
  }
  /* A copy of a part carried beside the rectangle's side to compare, and
     back: the second wrong try's demonstration. */
  function compare(from, to, cls) {
    var ghost = P.el('path', { 'class': 'pg__side ' + cls, d: P.seg(from.a, from.b) }, group);
    M.set(ghost, { opacity: 1 });
    var dx = to.a.x - from.a.x, dy = to.a.y - from.a.y;
    var tl = M.timeline({ revert: function () { if (ghost.parentNode) ghost.parentNode.removeChild(ghost); } });
    tl.to(ghost, { x: dx, y: dy, duration: M.dur(0.9), ease: 'power2.inOut' })
      .to({}, { duration: M.dur(0.8) })
      .to(ghost, { x: 0, y: 0, duration: M.dur(0.7), ease: 'power2.inOut' })
      .to(ghost, { opacity: 0, duration: M.dur(0.3) });
    return Flow.anim(tl);
  }

  /* ---- page 1: the length ------------------------------------------------- */
  function pageLength() {
    return K.say('f1Ask')
      .then(function () { return Flow.anim(chipsIn()); })
      .then(function () {
        return askPart('base', {
          onWrong: function (i, tries) {
            var said = K.say('f1Wrong', 'confused');
            if (tries >= 2) {
              return Promise.all([said, compare({ a: pts[0], b: pts[1] }, { a: rpts[0], b: rpts[1] }, 'is-base')]);
            }
            return said;
          }
        });
      })
      .then(function () {
        /* the base turns teal, the connector runs to the length, the card writes in */
        para.sides[0].classList.add('is-base');
        conn1.setAttribute('d', P.seg(P.mid(pts[0], pts[1]), P.mid(rpts[0], rpts[1])));
        card1 = W.card(dom.layer, { cls: 'card--formula', left: 30, bottom: 4, centre: true });
        layerNodes.push(card1.el);
        var row = card1.row(T('f1Card'), 'is-result');
        var acted = K.onPhrase('f1Right', 'base', function () {
          return Flow.anim(Beats.partPulse(para.sides[0], 2))
            .then(function () { return Flow.anim(Beats.dashedIn(conn1, 0.4)); })
            .then(function () { M.set(card1.el, { opacity: 1 }); return Flow.anim(Beats.ruleIn(card1.el)); })
            .then(function () { return row.show(); });
        });
        return Promise.all([K.say('f1Right', 'happy'), acted]);
      })
      .then(function () { return K.autoTurn(700); });
  }

  /* ---- page 2: the breadth --------------------------------------------------- */
  function pageBreadth() {
    return Flow.anim(Beats.fadeTo(conn1, 0, 0.3))
      .then(function () { return K.say('f2Ask'); })
      .then(function () {
        chipList().forEach(function (c) { c.g.classList.remove('is-right', 'is-wrong', 'is-done'); });
        return askPart('height', {
          onWrong: function (i, tries) {
            var said = K.say('f2Wrong', 'confused');
            var pulse = Flow.anim(Beats.partPulse(hgt.ra, 2, 0.8));
            M.set(hgt.ra, { opacity: 1 });
            if (tries >= 2) {
              return Promise.all([said, pulse, compare({ a: pts[3], b: F }, { a: rpts[2], b: rpts[1] }, 'is-orange')]);
            }
            return Promise.all([said, pulse]);
          }
        });
      })
      .then(function () {
        hgt.line.classList.remove('is-grey');
        hgt.line.classList.add('is-solid');
        conn2.setAttribute('d', P.seg(P.mid(pts[3], F), P.mid(rpts[1], rpts[2])));
        card2 = W.card(dom.layer, { cls: 'card--formula', left: 70, bottom: 4, centre: true });
        layerNodes.push(card2.el);
        var row = card2.row(T('f2Card'), 'is-result');
        var acted = K.onPhrase('f2Right', 'height', function () {
          return Promise.all([Flow.anim(Beats.partPulse(hgt.line, 2)), Flow.anim(Beats.growLine(hgt.ra, 0.3))])
            .then(function () { return Flow.anim(Beats.dashedIn(conn2, 0.4)); })
            .then(function () { M.set(card2.el, { opacity: 1 }); return Flow.anim(Beats.ruleIn(card2.el)); })
            .then(function () { return row.show(); });
        });
        return Promise.all([K.say('f2Right', 'happy'), acted]);
      })
      .then(function () { return K.autoTurn(700); });
  }

  /* ---- page 3: the rule, from the drop-down -------------------------------- */
  function pageRule() {
    var eq = null, l1 = null, l2 = null, l3 = null, dd = null, wLen = null, wBr = null, wEq = null;
    var options = [{ key: 'A', text: T('f3OptA') }, { key: 'B', text: T('f3OptB') }, { key: 'C', text: T('f3OptC') }];
    return Promise.all([Flow.anim(Beats.fadeTo(conn2, 0, 0.3)), Flow.anim(Beats.cardOut([card1.el, card2.el]))])
      .then(function () {
        drop(card1.el); drop(card2.el);
        /* the figures make room: both step up a little */
        return Flow.anim(Beats.moveGroup(group, { y: -40, scale: 0.86 }, 0.7, 'power2.inOut', '500 150'));
      })
      .then(function () {
        eq = W.eq(dom.layer, {});
        layerNodes.push(eq.el);
        l1 = eq.line(1, W.html(T('f3Line1')));
        wLen = W.h('span', 'eq__word'); wLen.textContent = T('f3Line2Length');
        wBr = W.h('span', 'eq__word'); wBr.textContent = T('f3Line2Breadth');
        wEq = W.h('span', 'eq__word'); wEq.textContent = T('f3Line2b');
        var body2 = document.createDocumentFragment();
        body2.appendChild(document.createTextNode(T('f3Line2a')));
        body2.appendChild(wLen);
        body2.appendChild(document.createTextNode(' × '));
        body2.appendChild(wBr);
        body2.appendChild(wEq);
        var wrap2 = W.h('span', 'eq__body-in'); wrap2.appendChild(body2);
        l2 = eq.line(2, wrap2);
        var wrap3 = W.h('span', 'eq__body-in');
        wrap3.appendChild(document.createTextNode(T('f3Line3') + ' '));
        dd = W.dropdown(wrap3, {
          options: options, right: 'B', placeholder: T('f3Select'),
          onWrong: function (key, tries) {
            var fb = key === 'A' ? 'f3WrongA' : 'f3WrongC';
            return K.say(fb, 'confused').then(function () {
              if (tries === 1) return K.say('f3Hint1');
              if (tries === 2) {
                return Promise.all([K.say('f3Hint2'), Flow.anim(Beats.holdClass([l2.el], 'is-lit', 3)),
                                    Flow.anim(Beats.partPulse([para.sides[0], hgt.line], 2))]);
              }
              /* the third: the words in line 2 become base and height, one by one */
              return K.say('f3Hint3').then(function () {
                return Flow.anim(Beats.swapWord(wLen, T('f3Line2Base')));
              }).then(function () { return Flow.wait(SHORT); })
                .then(function () { return Flow.anim(Beats.swapWord(wBr, T('f3Line2Height'))); })
                .then(function () { return Flow.anim(Beats.swapWord(wEq, T('f3Line2c'))); });
            });
          }
        });
        l3 = eq.line(3, wrap3);
        return eq.show();
      })
      .then(function () { return l1.show(); })
      .then(function () { return Flow.wait(300); })
      .then(function () { return l2.show(); })
      .then(function () { return Flow.wait(300); })
      .then(function () { return l3.show(); })
      .then(function () { return K.say('f3Ask'); })
      .then(function () { return K.say('f3Tap'); })
      .then(function () {
        var stop = null;
        K.quiet(Flow.wait(K.NUDGE_AFTER).then(function () { if (!dd.el.classList.contains('is-done')) stop = W.handNudge(dd.btn, { x: 0.5, y: 0.5 }); }));
        dd.el.addEventListener('pointerdown', function () { if (stop) { stop(); stop = null; } }, true);
        return dd.ask().then(function (res) { if (stop) stop(); return res; });
      })
      /* line 3 becomes the final statement card */
      .then(function () {
        l3.el.classList.add('is-done');
        return Flow.wait(BEAT);
      })
      .then(function () {
        var fin = W.card(dom.layer, { cls: 'card--formula', left: 50, bottom: 4, centre: true });
        layerNodes.push(fin.el);
        var r1 = fin.row(T('f4Thus'), 'is-result');
        var r2 = fin.row(T('f4Formula'), 'is-result');
        r2.el.style.fontSize = 'clamp(22px, 4.4vh, 44px)';
        var r3 = fin.row(T('f4Note'), 'is-note');
        return Flow.anim(Beats.cardOut(eq.el)).then(function () {
          drop(eq.el);
          M.set(fin.el, { opacity: 1 });
          return Flow.anim(Beats.ruleIn(fin.el));
        }).then(function () { return r1.show(); })
          .then(function () { return r2.show(); })
          .then(function () { return r3.show(); })
          .then(function () { return Flow.anim(Beats.cardLit(fin.el, 1.4)); });
      })
      .then(function () { return K.say('f4Right', 'happy'); })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return K.handOver(); });
  }

  function sceneFormula() {
    ensureFigures();
    return pageLength().then(pageBreadth).then(pageRule);
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
    para = null; rect = null; chips = {}; hgt = null;
  }
  function stage() {
    var cutG = document.getElementById('figCut');
    if (cutG) { cutG.setAttribute('hidden', ''); cutG.textContent = ''; }
    ensureFigures();
  }

  Pages.addSection({
    name: 'The formula',
    scenes: [{ name: 'Discover the formula', play: sceneFormula }],
    build: build, parts: parts, wipe: wipe, reset: reset, stage: stage
  });
})(window);
