/* ==========================================================================
 * s8-summary.js -- the recap, and the last screen
 * --------------------------------------------------------------------------
 * Screen 9, the recap. The title plate above; one clean parallelogram on
 * the left -- the base teal, the perpendicular height orange with its
 * marker -- with the formula card (A = b x h, base x corresponding height)
 * under it. The bird on its perch on the right says what to remember, then
 * hands over to Continue.
 *
 * Screen 10, the end. The board goes; the bird stands centre stage with its
 * bubble, says goodbye and celebrates under confetti. One button: Replay,
 * which plays the lesson again from the warm-up. The parent system is told
 * the lesson is complete as this screen opens.
 * ========================================================================== */
(function (global) {
  'use strict';

  var Flow = global.Flow, Beats = global.Beats, Pages = global.Pages, P = global.Para, W = global.W, M = global.Motion;
  if (!Pages || !Pages.addSection) { console.error('s8-summary.js: load js/pages.js first.'); return; }
  var K = Pages.kit;
  function T(k, r) { return global.T ? global.T(k, r) : k; }
  var SHORT = K.SHORT;

  /* The recap's figure: the lesson's parallelogram, its middle at (FIG_X,
     FIG_Y) in the figure's units, at K_END units per cm. */
  var K_END = 52, FIG_X = 290, FIG_Y = 168;

  var dom = null, group = null, layerNodes = [];
  function build(kit) { dom = kit.dom(); group = document.getElementById('figEnd'); }

  function banner(text) {
    var h = W.h('div', 'banner banner--small', dom.layer);
    var tx = W.h('span', 'banner__text', h); var hi = W.h('span', 'banner__hi', tx); hi.textContent = text;
    layerNodes.push(h);
    return h;
  }

  /* ---- screen 9: the recap ------------------------------------------------- */
  function sceneSummary() {
    var g, s, hgt, bracket;
    var k = K_END;
    return K.wipeBoard()
      .then(function () { return Flow.anim(K.collapseHeader(true)); })
      .then(function () {
        /* the bird perches lower here: nothing stands under it, and its
           line is long enough to reach the title plate otherwise */
        dom.board.classList.add('is-ending');
        group.removeAttribute('hidden');
        g = P.el('g', {}, group);
        var pts = P.cm(P.MAIN.cm, { x: FIG_X - 4 * k, y: FIG_Y + 1.5 * k }, k);
        s = P.build(g, pts, {});
        s.sides[0].classList.add('is-base');
        hgt = P.height(g, pts[3], pts[0], pts[1], { raCls: 'is-orange', label: T('lblHeightLower'), labelCls: 'is-orange is-italic', labelSide: -1, labelGap: 58 });
        bracket = P.bracket(g, pts[0], pts[1], { c: s.centre(), label: T('lblBaseLower'), labelCls: 'is-teal is-italic', gap: 16, labelGap: 24 });
        var title = banner(T('eTitle'));
        return Flow.anim(Beats.cardIn(title)).then(function () { return Flow.anim(Beats.drawShape(s, { time: 1.1 })); });
      })
      .then(function () { return Flow.anim(Beats.growLine(bracket.line, 0.5)); })
      .then(function () { return Flow.anim(Beats.labelIn(bracket.label)); })
      .then(function () { return Flow.anim(Beats.dashedIn(hgt.line, 0.5)); })
      .then(function () { return Promise.all([Flow.anim(Beats.growLine(hgt.ra, 0.25)), Flow.anim(Beats.labelIn(hgt.label))]); })
      .then(function () {
        var card = W.card(dom.layer, { cls: 'card--formula card--recap', left: 29, bottom: 5, centre: true });
        layerNodes.push(card.el);
        var r1 = card.row(T('eFormula'), 'is-result is-big');
        var r2 = card.row(T('eRule'), 'is-soft');
        M.set(card.el, { opacity: 1 });
        return Flow.anim(Beats.ruleIn(card.el)).then(function () { return r1.show(); }).then(function () { return r2.show(); });
      })
      .then(function () { return K.perchSay('e2'); })
      .then(function () { K.mascot().settle(); return Flow.wait(SHORT); })
      .then(function () { return K.handOver(); });
  }

  /* ---- screen 10: the end ---------------------------------------------------- */
  function tellParent() {
    try {
      if (global.parent && global.parent !== global) {
        global.parent.postMessage({ type: 'lesson-complete', lesson: 'area-of-parallelogram' }, '*');
      }
    } catch (e) { /* no parent to tell */ }
  }
  /* The one button, shown; resolves when it is pressed. */
  function replayButton() {
    var btn = dom.replayBtn;
    function onPick(ev) { K.ripple(ev, btn); dom.gate.dispatchEvent(new MouseEvent('click')); }
    btn.removeAttribute('hidden');
    btn.addEventListener('click', onPick);
    M.button3d(btn, { edge: 5 });
    dom.endActions.removeAttribute('hidden');
    K.quiet(Flow.anim(Beats.controlIn(btn)));
    function off() { btn.removeEventListener('click', onPick); }
    return Flow.once(dom.gate).then(function () {
      off();
      Beats.sfx('click');
      return Flow.anim(Beats.controlOut(btn)).then(function () { dom.endActions.setAttribute('hidden', ''); });
    }, function (err) { off(); throw err; });
  }
  function sceneEnd() {
    tellParent();
    /* the long goodbye wraps in the bubble; rewind() takes the class off */
    dom.bubble.classList.add('bubble--wrap');
    return K.centreStage(['e1'])
      .then(function () {
        K.celebrate(dom.frame);
        K.mascot().state('celebrating');
        return Flow.wait(1800);
      })
      .then(function () { K.mascot().settle(); return Flow.wait(SHORT); })
      .then(replayButton)
      .then(function () {
        var warm = K.sceneIndex('Spot the parallelogram');
        K.runFrom(warm < 0 ? 1 : warm, 0);
      });
  }

  function parts() { return [group]; }
  function wipe() { var nodes = layerNodes.slice(); return nodes.length ? [Flow.anim(Beats.cardOut(nodes))] : []; }
  function reset() {
    if (dom) dom.board.classList.remove('is-ending');
    group.setAttribute('hidden', '');
    group.textContent = '';
    layerNodes.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    layerNodes = [];
  }
  function stage() {}

  Pages.addSection({
    name: 'Summary',
    scenes: [
      { name: 'Summary', play: sceneSummary },
      { name: 'The end', play: sceneEnd }
    ],
    build: build, parts: parts, wipe: wipe, reset: reset, stage: stage
  });
})(window);
