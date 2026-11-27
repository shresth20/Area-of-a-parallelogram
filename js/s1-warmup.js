/* ==========================================================================
 * s1-warmup.js -- the warm-up: spot the parallelogram, and its two pairs
 * --------------------------------------------------------------------------
 * Page 1. Four tiles pop in one by one, each with a light-blue shape on it:
 * a trapezium, the parallelogram, a kite and an irregular quadrilateral. The
 * bird asks from the header; the learner taps. A wrong tile turns soft amber
 * and shakes once; the first wrong try is answered with a hint, every later
 * one by lighting the opposite sides of every shape in pairs (same colour =
 * a pair) for a while. The right tile gets a teal rim and a tick, the others
 * fade, and the page turns itself.
 *
 * Page 2. The parallelogram grows out of its tile to the middle of the
 * board. The top and bottom sides light blue with single arrows ("Pair 1"),
 * the slanting sides orange with double arrows ("Pair 2"), each as the bird
 * names it; then Continue.
 * ========================================================================== */
(function (global) {
  'use strict';

  var Flow = global.Flow, Beats = global.Beats, Pages = global.Pages, P = global.Para, W = global.W, M = global.Motion;
  if (!Pages || !Pages.addSection) { console.error('s1-warmup.js: load js/pages.js first.'); return; }
  var K = Pages.kit;
  function T(k, r) { return global.T ? global.T(k, r) : k; }
  var BEAT = K.BEAT, SHORT = K.SHORT, LOOK = K.LOOK;

  /* The four tiles, left to right, and the shape on each about the tile's
     middle. The parallelogram is the lesson's own (Para.MAIN) at TILE_K, a
     fraction of its later size, so the zoom to the middle keeps its exact shape. */
  var TILE_W = 216, TILE_H = 248, TILE_Y = 86;
  var DEPTH = 13;               /* the card's wall under its face, in figure units */
  var TILE_K = 24;              /* figure units per cm for the tile's parallelogram */
  var TS = TILE_K / 22;         /* the other tiles' shapes, grown to match */
  function around(c, list) { return list.map(function (p) { return { x: c.x + p[0] * TS, y: c.y + p[1] * TS }; }); }
  var TILES = [
    { cx: 145, pts: function (c) { return around(c, [[-74, 52], [74, 52], [44, -52], [-44, -52]]); } },
    { cx: 382, main: true },
    { cx: 618, pts: function (c) { return around(c, [[0, 74], [-52, -4], [0, -58], [52, -4]]); } },
    { cx: 855, pts: function (c) { return around(c, [[-62, 36], [20, 66], [70, -22], [-32, -64]]); } }
  ];
  var ANSWER = 1;
  var ZOOM = P.MAIN.k / TILE_K; /* the tile's parallelogram grows to the board's */

  var dom = null, group = null, tiles = [], shapes = [], marks = [];

  function build(kit) {
    dom = kit.dom();
    group = document.getElementById('figWarm');
  }
  function tileCentre(t) { return { x: t.cx, y: TILE_Y + TILE_H / 2 }; }
  function mainOnTile(c) {
    /* MAIN at the tile's scale, centred on the tile: its own middle is at (4, 1.5) cm */
    var k = P.MAIN.k / ZOOM;
    return P.cm(P.MAIN.cm, { x: c.x - 4 * k, y: c.y + 1.5 * k }, k);
  }
  function buildTiles() {
    tiles = TILES.map(function (t, i) {
      var c = tileCentre(t);
      var g = P.el('g', { 'class': 'shape-card', role: 'button', tabindex: -1 }, group);
      g.setAttribute('aria-label', T('a11yCard'));
      /* The card's wall, under its face and dropped by DEPTH, so the card
         reads as a raised, pressable tile. The face sinks onto it on a press. */
      var wall = P.el('rect', { 'class': 'shape-card__wall', x: t.cx - TILE_W / 2, y: TILE_Y + DEPTH, width: TILE_W, height: TILE_H, rx: 26 }, g);
      var face = P.el('g', { 'class': 'shape-card__face' }, g);
      P.el('rect', { 'class': 'shape-card__bg', x: t.cx - TILE_W / 2, y: TILE_Y, width: TILE_W, height: TILE_H, rx: 26 }, face);
      var pts = t.main ? mainOnTile(c) : t.pts(c);
      var s = P.build(face, pts, {});
      Beats.putShape(s);
      var ring = P.el('circle', { 'class': 'shape-card__ring', cx: t.cx + TILE_W / 2 - 24, cy: TILE_Y + 24, r: 16 }, face);
      var tick = P.el('path', { 'class': 'shape-card__tick',
        d: 'M' + (t.cx + TILE_W / 2 - 31) + ' ' + (TILE_Y + 24) + ' L' + (t.cx + TILE_W / 2 - 26) + ' ' + (TILE_Y + 30) + ' L' + (t.cx + TILE_W / 2 - 17) + ' ' + (TILE_Y + 18) }, face);
      pressable(g, face);
      shapes.push(s);
      return { g: g, shape: s, c: c, ring: ring, tick: tick, wall: wall, i: i };
    });
    return tiles;
  }
  /* The face pressed down onto its wall under the finger, and back up. */
  function pressable(g, face) {
    var down = false;
    function live() { return group.classList.contains('is-live') && !g.classList.contains('is-done'); }
    function push() {
      if (down || !live()) return;
      down = true;
      M.to(face, { y: DEPTH * 0.75, duration: M.dur(0.08), ease: 'power2.out', overwrite: 'auto' });
    }
    function lift() {
      if (!down) return;
      down = false;
      M.to(face, { y: 0, duration: M.dur(0.3), ease: M.POP, overwrite: 'auto',
        onComplete: function () { M.set(face, { clearProps: 'transform' }); } });
    }
    g.addEventListener('pointerdown', push);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (n) { g.addEventListener(n, lift); });
  }
  /* A tile popping in about its own middle. */
  function tileIn(t) {
    var tl = M.timeline({ willChange: t.g, willChangeValue: 'transform, opacity' });
    tl.fromTo(t.g, { opacity: 0, scale: 0.7, svgOrigin: t.c.x + ' ' + t.c.y },
      { opacity: 1, scale: 1, duration: M.dur(0.42), ease: M.POP });
    tl.call(Beats.pop, null, 0);
    return tl;
  }
  /* The opposite sides of every shape lit in pairs for a while. */
  function pairsGlow(seconds) {
    var a = [], b = [];
    shapes.forEach(function (s) { a.push(s.sides[0], s.sides[2]); b.push(s.sides[1], s.sides[3]); });
    return Promise.all([
      Flow.anim(Beats.holdClass(a, 'is-pair-a', seconds)),
      Flow.anim(Beats.holdClass(b, 'is-pair-b', seconds))
    ]);
  }

  /* ---- page 1: spot the parallelogram ------------------------------------ */
  function pageSpot() {
    var stopHand = null, touched = false;
    return K.openBoard()
      .then(function () {
        group.removeAttribute('hidden');
        buildTiles();
        return tiles.reduce(function (chain, t) {
          return chain.then(function () { return Flow.anim(tileIn(t)); }).then(function () { return Flow.wait(300 - 420 * 0); });
        }, Promise.resolve());
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return K.say('w1Ask'); })
      .then(function () { return K.say('w1Tap'); })
      .then(function () {
        group.classList.add('is-live');
        K.quiet(Flow.wait(K.NUDGE_AFTER).then(function () {
          if (!touched) stopHand = W.handNudge(tiles[ANSWER].g, { x: 0.5, y: 0.55 });
        }));
        var targets = tiles.map(function (t) { return t.g; });
        targets.forEach(function (g) { g.addEventListener('pointerdown', function () { touched = true; if (stopHand) { stopHand(); stopHand = null; } }); });
        return K.tapOn(targets, {
          answer: ANSWER,
          origin: function (i) { return tiles[i].c.x + ' ' + tiles[i].c.y; },
          onWrong: function (i, tries) {
            if (tries === 1) return K.say('w1Wrong1', 'confused');
            /* every later try: the hint, and the pairs held longer each time */
            return Promise.all([
              K.say('w1Wrong2', 'confused'),
              pairsGlow(1.5 + 0.5 * (tries - 2))
            ]);
          }
        });
      })
      .then(function () {
        if (stopHand) stopHand();
        group.classList.remove('is-live');
        var t = tiles[ANSWER];
        var others = tiles.filter(function (x) { return x !== t; }).map(function (x) { return x.g; });
        return Promise.all([
          Flow.anim(Beats.fadeIn([t.ring, t.tick], 0.3)),
          Flow.anim(Beats.fadeTo(others, 0.3, 0.4)),
          K.say('w1Right', 'happy')
        ]);
      })
      .then(function () { return K.autoTurn(900); });
  }

  /* ---- page 2: the two pairs ------------------------------------------------ */
  function pagePairs() {
    var t = tiles[ANSWER], s = t.shape;
    var others = tiles.filter(function (x) { return x !== t; }).map(function (x) { return x.g; });
    var middle = { x: 500, y: 210 };
    var pair1 = [s.sides[0], s.sides[2]], pair2 = [s.sides[1], s.sides[3]];
    return K.lineAway()
      /* the other tiles and this tile's own frame go; the shape stays */
      .then(function () {
        return Promise.all([
          Flow.anim(Beats.fadeTo(others, 0, 0.35)),
          Flow.anim(Beats.fadeTo([t.g.querySelector('.shape-card__bg'), t.wall, t.ring, t.tick], 0, 0.35))
        ]);
      })
      .then(function () {
        others.forEach(function (g) { g.setAttribute('hidden', ''); });
        /* the parallelogram grows out of its tile to the middle of the board */
        return Flow.anim(Beats.moveGroup(s.g, { x: middle.x - t.c.x, y: middle.y - t.c.y, scale: ZOOM }, 0.6, 'power3.out', t.c.x + ' ' + t.c.y));
      })
      .then(function () {
        /* the same shape, re-laid out at its new size, so every mark put on
           it from here is in the figure's own units */
        s.set(P.mainPts());
        M.set(s.g, { clearProps: 'transform' });
        marks = [];
        return Flow.wait(SHORT);
      })
      /* pair 1: top and bottom, blue, single arrows, as the bird says it */
      .then(function () {
        var arrows1 = [P.arrows(s.g, s.pts[0], s.pts[1], 1, { cls: 'is-blue' }), P.arrows(s.g, s.pts[3], s.pts[2], 1, { cls: 'is-blue' })];
        var lbl1 = P.label(s.g, T('w2Pair1'), { cls: 'is-small', at: { x: s.mid(2).x, y: s.mid(2).y - 26 } });
        marks.push.apply(marks, arrows1.concat([lbl1]));
        pair1.forEach(function (sd) { sd.classList.add('is-blue'); });
        var act1 = K.onPhrase('w2Line', 'top and bottom', function () {
          return Promise.all([
            Flow.anim(Beats.partPulse(pair1, 2)),
            Flow.anim(Beats.fadeIn(arrows1, 0.3)),
            Flow.anim(Beats.labelIn(lbl1))
          ]);
        });
        var arrows2 = [P.arrows(s.g, s.pts[1], s.pts[2], 2, { cls: 'is-orange' }), P.arrows(s.g, s.pts[0], s.pts[3], 2, { cls: 'is-orange' })];
        var lbl2 = P.label(s.g, T('w2Pair2'), { cls: 'is-small is-orange', at: { x: s.mid(1).x + 34, y: s.mid(1).y - 6 }, anchor: 'start' });
        marks.push.apply(marks, arrows2.concat([lbl2]));
        var act2 = K.onPhrase('w2Line', 'slanting', function () {
          pair2.forEach(function (sd) { sd.classList.add('is-orange'); });
          return Promise.all([
            Flow.anim(Beats.partPulse(pair2, 2)),
            Flow.anim(Beats.fadeIn(arrows2, 0.3)),
            Flow.anim(Beats.labelIn(lbl2))
          ]);
        });
        return Promise.all([K.say('w2Line'), act1, act2]);
      })
      .then(function () { return Flow.wait(BEAT); })
      .then(function () { return K.handOver(); })
      /* the next section takes the shape over where it stands */
      .then(function () { return Flow.anim(Beats.marksOut(marks)); });
  }

  function sceneWarm() {
    return pageSpot().then(pagePairs);
  }

  /* What the next section takes over: the parallelogram standing in the
     middle, in the figure's units. */
  function handShape() {
    var t = tiles[ANSWER];
    return t ? t.shape : null;
  }

  function parts() { return [group]; }
  function reset() {
    group.setAttribute('hidden', '');
    group.classList.remove('is-live');
    group.textContent = '';
    tiles = []; shapes = []; marks = [];
  }
  function stage() { /* the scene opens the board itself */ }

  Pages.addSection({
    name: 'Warm-up',
    scenes: [{ name: 'Spot the parallelogram', play: sceneWarm }],
    build: build, parts: parts, reset: reset, stage: stage
  });
  global.Warm = { shape: handShape, group: function () { return group; } };
})(window);
