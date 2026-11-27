/* ==========================================================================
 * s6-recall.js -- complete the formula: Area = Base × ____
 * --------------------------------------------------------------------------
 * A recall check before the practice, played in this order:
 *   1. the board clears and the parallelogram is drawn in the middle
 *   2. its lines are named one at a time, each lit as its name pops in:
 *      the base (teal), the height (orange, dashed, with its right-angle
 *      marker), a slanting side (purple), a diagonal (grey, dash-dot)
 *   3. the whole figure glides into the left half, and the formula with its
 *      blank -- Area = Base × ____ -- writes in above it
 *   4. the bird jumps onto its perch on the right and asks; the three
 *      answers come up under it, shuffled
 *   5. a wrong pick: the pill shakes amber and is spent, the word drops
 *      into the blank in amber and falls out again, its line on the figure
 *      glows amber, the bubble turns amber with the reason, and the height's
 *      right angle pulses as the hint. Once only the answer is left it is
 *      lit for the learner.
 *   6. the right pick: the pill goes green, "Height" lands in the blank,
 *      the formula glows, confetti bursts over the shape, the base and the
 *      height pulse together, the bubble turns green -- then Next, on to
 *      the practice.
 * ========================================================================== */
(function (global) {
  'use strict';

  var Flow = global.Flow, Beats = global.Beats, Pages = global.Pages, P = global.Para, W = global.W, M = global.Motion;
  if (!Pages || !Pages.addSection) { console.error('s6-recall.js: load js/pages.js first.'); return; }
  var K = Pages.kit;
  function T(k, r) { return global.T ? global.T(k, r) : k; }
  var BEAT = K.BEAT, SHORT = K.SHORT;

  /* The shape drawn in the middle of the board: MAIN (8 cm wide with its
     slant, 3 cm high) at KS units per cm, its box centred on (500, MID_Y). */
  var KS = 50;
  var MID_Y = 200;
  var ORIGIN = { x: 500 - 4 * KS, y: MID_Y + 1.5 * KS };
  /* Where it goes once named: the left half of the board (figure units),
     under the formula. The bird's perch takes the right half. */
  var LEFT_BOX = { x0: 24, x1: 476, y0: 84, y1: 364 };
  var NAME_GAP = 0.45;        /* s between one name and the next           */

  /* the three answers, and the part of the figure each one names */
  var OPTS = ['r1OptH', 'r1OptS', 'r1OptD'];
  var RIGHT = 'r1OptH';
  var WRONG_LINE = { r1OptS: 'r1WrongS', r1OptD: 'r1WrongD' };

  var dom = null, group = null, layerNodes = [];
  function build(kit) { dom = kit.dom(); group = document.getElementById('figRecall'); }

  /* ---- the figure ------------------------------------------------------------ */
  /* A soft glow along a line, laid under the shape's ink. */
  function glowUnder(s, a, b, cls) {
    var gl = P.el('path', { 'class': 'pg__glowline ' + cls, d: P.seg(a, b) });
    s.g.insertBefore(gl, s.sides[0]);
    return gl;
  }
  function makeFigure() {
    var g = P.el('g', { 'class': 'pg-recall' }, group);
    var pts = P.cm(P.MAIN.cm, ORIGIN, KS);
    var A = pts[0], B = pts[1], C = pts[2];
    var s = P.build(g, pts, {});
    var hgtH = C.y - A.y;   /* negative: up */

    /* the height, on the right: from the base's right end up to the top
       side, its marker at the top where it meets that side */
    var hgt = P.height(g, B, C, pts[3], { raCls: 'is-orange' });
    var diag = P.el('path', { 'class': 'pg__diag', d: P.seg(A, C) }, g);

    /* the names, each placed clear of the others: the height's low on the
       left of its line, the diagonal's above its line towards A, the slanting
       side's outside its side */
    var dirAC = P.unit(P.sub(C, A));
    var upLeft = { x: dirAC.y, y: -dirAC.x };
    var nBC = s.outward(1);
    var labels = {
      base: P.label(g, T('lblBaseLower'), { cls: 'is-teal is-italic', at: { x: P.mid(A, B).x, y: A.y + 28 } }),
      height: P.label(g, T('lblHeightLower'), { cls: 'is-orange is-italic', anchor: 'end',
                                                at: { x: B.x - 12, y: A.y + hgtH * 0.27 } }),
      slant: P.label(g, T('lblSlantLower'), { cls: 'is-purple is-italic', anchor: 'start',
                                              at: P.add(s.mid(1), P.mul(nBC, 18)) }),
      diag: P.label(g, T('lblDiagonal'), { cls: 'is-grey is-italic is-small',
                                           at: P.add(P.lerp(A, C, 0.28), P.mul(upLeft, 34)) })
    };
    var glows = {
      base: glowUnder(s, A, B, 'is-teal'),
      height: glowUnder(s, B, hgt.foot, 'is-orange'),
      slant: glowUnder(s, B, C, 'is-purple'),
      diag: glowUnder(s, A, C, 'is-grey')
    };
    return { g: g, s: s, pts: pts, hgt: hgt, diag: diag, labels: labels, glows: glows };
  }

  /* ---- step 2: the lines named one at a time --------------------------------- */
  /* The glow rises along the line, the line takes its colour (or is drawn,
     for the height and the diagonal), the name pops in, and the glow sinks
     back. */
  function nameOne(fig, key) {
    var gl = fig.glows[key], lbl = fig.labels[key], s = fig.s;
    var tl = M.timeline({ willChange: gl, willChangeValue: 'opacity' });
    tl.to(gl, { opacity: 1, duration: M.dur(0.35), ease: 'power2.out' }, 0);
    if (key === 'base') tl.call(function () { s.sides[0].classList.add('is-base'); }, null, M.gap(0.1));
    if (key === 'slant') tl.call(function () { s.sides[1].classList.add('is-slant'); }, null, M.gap(0.1));
    if (key === 'height') {
      tl.add(Beats.dashedIn(fig.hgt.line, 0.55), 0);
      tl.add(Beats.growLine(fig.hgt.ra, 0.25), M.gap(0.5));
    }
    if (key === 'diag') tl.add(Beats.dashedIn(fig.diag, 0.6), 0);
    tl.add(Beats.labelIn(lbl), M.gap(key === 'height' || key === 'diag' ? 0.45 : 0.2));
    tl.to(gl, { opacity: 0, duration: M.dur(0.4), ease: 'power2.in' }, M.gap(0.95));
    return tl;
  }
  function nameLines(fig) {
    return ['base', 'height', 'slant', 'diag'].reduce(function (chain, key, i) {
      return chain
        .then(function () { return i ? Flow.wait(NAME_GAP * 1000) : null; })
        .then(function () { return Flow.anim(nameOne(fig, key)); });
    }, Promise.resolve());
  }

  /* ---- step 3: the figure into the left half ----------------------------------- */
  /* The group's box (names and all) fitted into LEFT_BOX: never grown, only
     shrunk if it would not fit. Measured once, before the move. */
  var placed = { k: 1, x: 0, y: 0 };
  function fitLeft(fig) {
    var b = fig.g.getBBox();
    var k = Math.min(1, (LEFT_BOX.x1 - LEFT_BOX.x0) / b.width, (LEFT_BOX.y1 - LEFT_BOX.y0) / b.height);
    var cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    var tx = (LEFT_BOX.x0 + LEFT_BOX.x1) / 2, ty = (LEFT_BOX.y0 + LEFT_BOX.y1) / 2;
    placed = { k: k, x: P.round2(tx - k * cx), y: P.round2(ty - k * cy) };
    return placed;
  }
  function toLeft(fig) {
    var to = fitLeft(fig);
    return Beats.moveGroup(fig.g, { x: to.x, y: to.y, scale: to.k }, 1.0, 'power2.inOut', '0 0');
  }
  /* a point of the figure, where it stands now that the group has moved */
  function moved(p) { return { x: placed.k * p.x + placed.x, y: placed.k * p.y + placed.y }; }

  /* ---- the formula, with its blank ----------------------------------------------- */
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  /* "Area = Base × {blank}": the words around the blank as they stand in the
     locale (so a language may put the blank where it likes), "Base" in the
     base's teal, and a cell as wide as the answer. A word landing in it
     takes no room of its own (css: .r1-blank__word), so the line never
     moves; a longer wrong word is shrunk to the cell (blankWrong). */
  function formulaCard() {
    var c = W.card(dom.layer, { cls: 'card--formula card--blank', left: 25, top: 3, centre: true });
    layerNodes.push(c.el);
    var row = c.row('', 'is-result is-big');
    var parts = T('r1Card').split('{blank}');
    var baseW = esc(T('lblBaseCap'));
    function words(t) { return esc(t).replace(baseW, '<span class="k-teal">' + baseW + '</span>'); }
    row.el.innerHTML = words(parts[0] || '');
    var blank = document.createElement('span');
    blank.className = 'r1-blank';
    var ghost = document.createElement('span');
    ghost.className = 'r1-blank__ghost';
    ghost.setAttribute('aria-hidden', 'true');
    ghost.textContent = T(RIGHT);
    blank.appendChild(ghost);
    var word = document.createElement('span');
    word.className = 'r1-blank__word';
    var text = document.createElement('span');
    word.appendChild(text);
    blank.appendChild(word);
    row.el.appendChild(blank);
    if (parts[1]) row.el.insertAdjacentHTML('beforeend', words(parts[1]));
    M.set(row.el, { opacity: 1 });
    M.set(word, { opacity: 0 });
    return { card: c, row: row.el, blank: blank, word: word, text: text };
  }
  /* A word put in the blank, and the scale that fits it to the cell. */
  function fill(f, key) {
    M.set(f.word, { scale: 1, y: 0 });
    f.text.textContent = T(key);
    var room = f.blank.getBoundingClientRect().width;
    var need = f.text.getBoundingClientRect().width;
    return need > room && need ? room / need : 1;
  }
  /* A wrong word dropped into the blank in amber: it lands, the cell shakes
     its head, and the word falls out again, leaving the blank empty. */
  function blankWrong(f, key) {
    var w = f.word;
    var k = fill(f, key);
    w.classList.remove('is-right');
    w.classList.add('is-wrong');
    f.blank.classList.add('is-wrong');
    var tl = M.timeline({
      willChange: w, willChangeValue: 'transform, opacity',
      revert: function () { f.blank.classList.remove('is-wrong'); }
    });
    tl.fromTo(w, { opacity: 0, y: -18, scale: k }, { opacity: 1, y: 0, duration: M.dur(0.28), ease: 'power2.out' }, 0);
    tl.add(M.incorrect(f.blank), M.gap(0.3));
    tl.to(w, { opacity: 0, y: 14, duration: M.dur(0.3), ease: 'power2.in' }, M.gap(1.3));
    return tl;
  }
  /* The answer landing in the blank: a pop, and the whole line glows. */
  function blankRight(f) {
    var w = f.word;
    var k = fill(f, RIGHT);
    w.classList.remove('is-wrong');
    w.classList.add('is-right');
    f.blank.classList.add('is-filled');
    var tl = M.timeline({ willChange: w, willChangeValue: 'transform, opacity' });
    tl.fromTo(w, { opacity: 0, y: -22, scale: 0.6 * k }, { opacity: 1, y: 0, scale: k, duration: M.dur(0.45), ease: 'back.out(2)' }, 0);
    tl.call(function () { f.card.el.classList.add('is-lit'); }, null, M.gap(0.3));
    tl.add(M.correct(f.row), M.gap(0.35));
    return tl;
  }

  /* ---- the scene ------------------------------------------------------------------ */
  function sceneRecall() {
    var fig = null, f = null, order = null;
    return K.wipeBoard()
      /* the header shut first, so the figure is drawn at the size it keeps */
      .then(function () { return Flow.anim(K.collapseHeader(true)); })
      /* 1. the shape is drawn in the middle */
      .then(function () {
        group.removeAttribute('hidden');
        fig = makeFigure();
        return Flow.anim(Beats.drawShape(fig.s, { time: 1.2 }));
      })
      .then(function () { return Flow.wait(SHORT); })
      /* 2. its lines named, one by one */
      .then(function () { return nameLines(fig); })
      .then(function () { return Flow.wait(BEAT * 1.5); })
      /* 3. into the left half, and the formula with its blank above it */
      .then(function () { return Flow.anim(toLeft(fig)); })
      .then(function () {
        f = formulaCard();
        return f.card.show();
      })
      .then(function () { return Flow.wait(SHORT); })
      /* 4. the bird jumps onto its perch on the right and asks; the answers
         come up under it */
      .then(function () { return K.perchSay('r1Ask'); })
      .then(function () {
        order = K.shuffle(OPTS);
        return K.perchChoices(order.map(function (k) { return T(k); }));
      })
      /* 5. until it is right */
      .then(function (btns) {
        return K.perchAsk(btns, order.indexOf(RIGHT), {
          onWrong: function (i) {
            var key = order[i];
            var line = key === 'r1OptS' ? fig.s.sides[1] : fig.diag;
            var lbl = key === 'r1OptS' ? fig.labels.slant : fig.labels.diag;
            lbl.classList.add('is-amber');
            return Promise.all([
              K.perchSay(WRONG_LINE[key], 'confused', 'no'),
              Flow.anim(blankWrong(f, key)),
              Flow.anim(Beats.holdClass([line], 'is-wrong', 1.6)).then(function () {
                lbl.classList.remove('is-amber');
                /* the hint: the line that DOES make a right angle with the base */
                M.set(fig.glows.height, { opacity: 0 });
                return Promise.all([
                  Flow.anim(Beats.partPulse(fig.hgt.ra, 2, 0.8)),
                  Flow.anim(M.timeline().to(fig.glows.height, { opacity: 1, duration: M.dur(0.3), ease: 'power2.out' })
                    .to(fig.glows.height, { opacity: 0, duration: M.dur(0.4), ease: 'power2.in' }, '+=' + M.dur(0.8)))
                ]);
              }, function (err) { lbl.classList.remove('is-amber'); throw err; })
            ]);
          }
        });
      })
      /* 6. right: the word lands, the shape celebrates, the bubble goes green */
      .then(function (res) {
        var c = moved(fig.s.centre());
        K.burstAt(c.x, c.y);
        return Promise.all([
          K.perchRight('r1Right', res),
          Flow.anim(blankRight(f)),
          Flow.anim(Beats.fadeTo([fig.diag, fig.labels.diag, fig.labels.slant], 0.35, 0.4)),
          Flow.anim(Beats.partPulse([fig.hgt.line, fig.s.sides[0]], 2)),
          Flow.anim(Beats.glowText([fig.labels.base, fig.labels.height], 2))
        ]);
      })
      .then(function () { K.mascot().settle(); return Flow.wait(SHORT); })
      /* Next: on to the practice (its own wipe takes this board away) */
      .then(function () { return K.handOver(); });
  }

  function parts() { return [group]; }
  function wipe() { var nodes = layerNodes.slice(); return nodes.length ? [Flow.anim(Beats.cardOut(nodes))] : []; }
  function reset() {
    group.setAttribute('hidden', '');
    group.textContent = '';
    layerNodes.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    layerNodes = [];
    placed = { k: 1, x: 0, y: 0 };
  }
  function stage() {}

  Pages.addSection({
    name: 'Recall',
    scenes: [{ name: 'Complete the formula', play: sceneRecall }],
    build: build, parts: parts, wipe: wipe, reset: reset, stage: stage
  });
})(window);
