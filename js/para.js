/* ==========================================================================
 * para.js -- a parallelogram on the board, built from its four corners
 * --------------------------------------------------------------------------
 * Every parallelogram in the lesson is one group made here: the fill, one
 * path per side in its own ink, the outline the pen draws, the pen's tip and
 * (if asked) a tap target over each side. The corners are kept in the
 * figure's own units (1000 x 420) as [A, B, C, D]: A bottom-left, B
 * bottom-right, C top-right, D top-left, so side 0 is the bottom (A-B),
 * 1 the right slant (B-C), 2 the top (C-D), 3 the left slant (D-A).
 *
 * Everything else a page puts on a shape -- a height, a bracket, a label, a
 * dot, a chip, a diagonal -- is made by the helpers below from the shape's
 * own geometry, so nothing can drift away from the corners it belongs to.
 *
 *   Para.cm(spec, origin, k)      cm corners -> figure corners (y up in cm)
 *   Para.build(host, pts, opts)   -> the shape (below); shape.set(pts) re-lays it
 *   Para.foot(p, a, b)            the foot of the perpendicular from p on line ab
 *   Para.raPath(foot, u, v, s)    the right-angle marker at a foot
 *   Para.label(host, text, o)     a word on the figure
 *   Para.height(host, from, a, b, o) a height from a point down onto line ab
 *   Para.bracket(host, a, b, o)   the base's bracket under a side
 *   Para.arrows(host, a, b, n, o) parallel markers on a side
 *   Para.dot(host, p, o)          a glowing point
 *   Para.chip(host, p, text, o)   a name chip (a tap target)
 *   Para.tag(host, p, text)       a number tag on a line
 *   Para.grid(host, origin, k, w, h, o) unit squares over a region
 *
 * Load order: before js/animations.js
 * ========================================================================== */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  function round2(n) { return Math.round(n * 100) / 100; }
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { if (attrs[k] != null) e.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(e);
    return e;
  }

  /* ---- vectors ------------------------------------------------------------ */
  function add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
  function mul(a, k) { return { x: a.x * k, y: a.y * k }; }
  function len(v) { return Math.sqrt(v.x * v.x + v.y * v.y); }
  function unit(v) { var L = len(v) || 1; return { x: v.x / L, y: v.y / L }; }
  function perp(v) { return { x: -v.y, y: v.x }; }
  function dotp(a, b) { return a.x * b.x + a.y * b.y; }
  function lerp(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
  function mid(a, b) { return lerp(a, b, 0.5); }
  function dist(a, b) { return len(sub(a, b)); }
  /* The foot of the perpendicular from p onto the line through a and b
     (not clamped to the segment), and how far along it falls (0 at a, 1 at b). */
  function foot(p, a, b) {
    var ab = sub(b, a), L2 = dotp(ab, ab) || 1;
    var t = dotp(sub(p, a), ab) / L2;
    var f = add(a, mul(ab, t));
    return { x: round2(f.x), y: round2(f.y), t: t };
  }
  function pathOf(pts, open) {
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + round2(p.x) + ' ' + round2(p.y); }).join(' ');
    return open ? d : d + ' Z';
  }
  function seg(a, b) { return 'M' + round2(a.x) + ' ' + round2(a.y) + ' L' + round2(b.x) + ' ' + round2(b.y); }
  function centroid(pts) {
    var x = 0, y = 0;
    pts.forEach(function (p) { x += p.x; y += p.y; });
    return { x: x / pts.length, y: y / pts.length };
  }
  function bbox(pts) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    pts.forEach(function (p) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); });
    return { x0: x0, y0: y0, x1: x1, y1: y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }
  /* The unit normal of side a-b pointing away from the shape's middle c. */
  function outward(a, b, c) {
    var n = unit(perp(sub(b, a)));
    var m = mid(a, b);
    if (dotp(sub(m, c), n) < 0) n = mul(n, -1);
    return n;
  }

  /* Corners given in cm (y up) placed on the figure: origin is where
     (0, 0) cm lands, k is figure units per cm. */
  function cm(spec, origin, k) {
    return spec.map(function (p) {
      return { x: round2(origin.x + p[0] * k), y: round2(origin.y - p[1] * k) };
    });
  }

  /* ---- the shape ----------------------------------------------------------
     opts: cls, id, hits (a tap target over each side), fillCls */
  function build(host, pts, opts) {
    var o = opts || {};
    var g = el('g', { 'class': 'pg' + (o.cls ? ' ' + o.cls : '') });
    if (o.id) g.setAttribute('id', o.id);
    var n = pts.length;
    var s = {
      g: g, pts: pts.slice(), n: n, opts: o,
      fill: el('path', { 'class': 'pg__fill' + (o.fillCls ? ' ' + o.fillCls : '') }, g),
      outline: el('path', { 'class': 'pg__outline' }, g),
      sides: [], hits: [],
      tip: null,
      extras: []
    };
    for (var i = 0; i < n; i++) s.sides.push(el('path', { 'class': 'pg__side' }, g));
    if (o.hits) {
      for (i = 0; i < n; i++) {
        var hit = el('path', { 'class': 'pg__hit', role: 'button', tabindex: -1 }, g);
        hit.setAttribute('aria-label', global.T ? global.T('a11ySide') : 'A side');
        s.hits.push(hit);
      }
    }
    s.tip = el('circle', { 'class': 'pg__tip', r: 7 }, g);

    s.side = function (i) { return { a: s.pts[i], b: s.pts[(i + 1) % s.n] }; };
    s.len = function (i) { return dist(s.pts[i], s.pts[(i + 1) % s.n]); };
    s.mid = function (i) { return mid(s.pts[i], s.pts[(i + 1) % s.n]); };
    s.centre = function () { return centroid(s.pts); };
    s.bbox = function () { return bbox(s.pts); };
    s.outward = function (i) { return outward(s.pts[i], s.pts[(i + 1) % s.n], centroid(s.pts)); };
    /* Something laid out from the corners: its `layout(shape)` is run on
       every set(). */
    s.keep = function (extra) { if (extra && extra.layout) s.extras.push(extra); return extra; };
    s.set = function (pts2) {
      if (pts2) s.pts = pts2.slice();
      var p = s.pts, d = pathOf(p);
      s.fill.setAttribute('d', d);
      s.outline.setAttribute('d', d);
      for (var k = 0; k < s.n; k++) {
        var sd = seg(p[k], p[(k + 1) % s.n]);
        s.sides[k].setAttribute('d', sd);
        if (s.hits[k]) s.hits[k].setAttribute('d', sd);
      }
      s.tip.setAttribute('cx', p[0].x);
      s.tip.setAttribute('cy', p[0].y);
      s.extras.forEach(function (x) { x.layout(s); });
    };
    s.set(pts);
    s.parts = function () { return [g]; };
    if (host) host.appendChild(g);
    return s;
  }

  /* ---- marks on a shape --------------------------------------------------- */

  /* The right-angle marker at `f`: a small square in the corner between the
     directions u (along the base) and v (up the height), both unit vectors
     pointing INTO the angle. */
  function raPath(f, u, v, size) {
    var sz = size || 14;
    var p1 = add(f, mul(u, sz)), p2 = add(add(f, mul(u, sz)), mul(v, sz)), p3 = add(f, mul(v, sz));
    return pathOf([p1, p2, p3], true);
  }

  /* A word on the figure. o: cls (is-teal ...), anchor, dy; at a point
     (o.at) or offset from the middle of a side outward (o.side: {a, b, c,
     gap}). Hands back the <text>, with .layout for a shape to keep. */
  function label(host, text, o) {
    o = o || {};
    var t = el('text', { 'class': 'figure-label pg__label' + (o.cls ? ' ' + o.cls : ''),
                         'text-anchor': o.anchor || 'middle', 'dominant-baseline': 'middle' }, host);
    t.textContent = text;
    t.layout = function () {
      var p;
      if (o.at) p = typeof o.at === 'function' ? o.at() : o.at;
      else if (o.side) {
        var sd = typeof o.side === 'function' ? o.side() : o.side;
        var n = outward(sd.a, sd.b, sd.c);
        p = add(mid(sd.a, sd.b), mul(n, sd.gap == null ? 22 : sd.gap));
      } else p = { x: 0, y: 0 };
      t.setAttribute('x', round2(p.x + (o.dx || 0)));
      t.setAttribute('y', round2(p.y + (o.dy || 0)));
    };
    t.layout();
    return t;
  }

  /* A height from point `from` (a corner, or a function giving one) down
     onto the line a-b (functions too). The foot may fall past the segment
     (the height outside): then o.ext draws the base's extension, dotted,
     from the nearer end to the foot. o: cls, ra (marker: true, or
     'top' to put it at the top end, 'none'), raSize, dotAt ('foot'),
     label (text), labelCls, labelSide (+1 / -1: which side of the line,
     or a function giving one, read on every layout), solid. Hands back { g, line, ext, ra, foot, label, layout }. */
  function height(host, from, a, b, o) {
    o = o || {};
    var g = el('g', { 'class': 'pg__h' }, host);
    var h = { g: g, line: el('path', { 'class': 'pg__height' + (o.solid ? ' is-solid' : '') + (o.cls ? ' ' + o.cls : '') }),
              ext: o.ext ? el('path', { 'class': 'pg__ext' }) : null,
              ra: o.ra === 'none' ? null : el('path', { 'class': 'pg__ra' + (o.raCls ? ' ' + o.raCls : '') }),
              hit: o.hit ? el('path', { 'class': 'pg__hit', role: 'button', tabindex: -1 }) : null,
              label: null, foot: null, top: null };
    if (h.ext) g.appendChild(h.ext);
    g.appendChild(h.line);
    if (h.ra) g.appendChild(h.ra);
    if (h.hit) { h.hit.setAttribute('aria-label', global.T ? global.T('a11yLine') : 'A line'); g.appendChild(h.hit); }
    if (o.label != null) {
      h.label = el('text', { 'class': 'figure-label pg__label' + (o.labelCls ? ' ' + o.labelCls : ''),
                             'text-anchor': 'middle', 'dominant-baseline': 'middle' }, g);
      h.label.textContent = o.label;
    }
    h.layout = function () {
      var P = typeof from === 'function' ? from() : from;
      var A = typeof a === 'function' ? a() : a, B = typeof b === 'function' ? b() : b;
      var f = foot(P, A, B);
      h.foot = f; h.top = P;
      h.line.setAttribute('d', seg(P, f));
      if (h.hit) h.hit.setAttribute('d', seg(P, f));
      if (h.ext) {
        var near = f.t < 0 ? A : f.t > 1 ? B : null;
        h.ext.setAttribute('d', near ? seg(near, f) : 'M0 0');
      }
      if (h.ra) {
        /* the square sits inside the angle: along the base towards the
           segment's middle, and up the height */
        var u = unit(sub(mid(A, B), f));
        if (len(sub(mid(A, B), f)) < 1) u = unit(sub(B, A));
        var v = unit(sub(P, f));
        var at = f, uu = u, vv = v;
        if (o.ra === 'top') { at = P; vv = unit(sub(f, P)); uu = mul(u, o.raFlip ? -1 : 1); }
        h.ra.setAttribute('d', raPath(at, uu, vv, o.raSize || 14));
      }
      if (h.label) {
        var m = mid(P, f), side = (typeof o.labelSide === 'function' ? o.labelSide() : o.labelSide) || 1;
        var nrm = unit(perp(sub(f, P)));
        var q = add(m, mul(nrm, side * (o.labelGap == null ? 24 : o.labelGap)));
        h.label.setAttribute('x', round2(q.x + (o.labelDx || 0)));
        h.label.setAttribute('y', round2(q.y + (o.labelDy || 0)));
      }
    };
    h.layout();
    h.parts = function () { return [h.ext, h.line, h.ra, h.label].filter(Boolean); };
    return h;
  }

  /* The base's bracket under a side: a line a little outside it with a tick
     at each end, and the word under that. o: gap, tick, label, labelCls, c
     (the shape's middle, for which side is out), cls. */
  function bracket(host, a, b, o) {
    o = o || {};
    var g = el('g', { 'class': 'pg__br' }, host);
    var br = { g: g, line: el('path', { 'class': 'pg__bracket' + (o.cls ? ' ' + o.cls : '') }, g), label: null };
    if (o.label != null) {
      br.label = el('text', { 'class': 'figure-label pg__label' + (o.labelCls ? ' ' + o.labelCls : ''),
                              'text-anchor': 'middle', 'dominant-baseline': 'middle' }, g);
      br.label.textContent = o.label;
    }
    br.layout = function () {
      var A = typeof a === 'function' ? a() : a, B = typeof b === 'function' ? b() : b;
      var C = typeof o.c === 'function' ? o.c() : o.c;
      var n = C ? outward(A, B, C) : unit(perp(sub(B, A)));
      var gap = o.gap == null ? 18 : o.gap, tick = o.tick == null ? 9 : o.tick;
      var A2 = add(A, mul(n, gap)), B2 = add(B, mul(n, gap));
      var d = seg(A2, B2) + ' ' + seg(add(A2, mul(n, -tick)), add(A2, mul(n, tick))) +
              ' ' + seg(add(B2, mul(n, -tick)), add(B2, mul(n, tick)));
      br.line.setAttribute('d', d);
      if (br.label) {
        var q = add(mid(A2, B2), mul(n, o.labelGap == null ? 22 : o.labelGap));
        br.label.setAttribute('x', round2(q.x)); br.label.setAttribute('y', round2(q.y));
      }
    };
    br.layout();
    br.parts = function () { return [br.line, br.label].filter(Boolean); };
    return br;
  }

  /* Parallel markers: n chevrons on the middle of side a-b, pointing from
     a to b. */
  function arrows(host, a, b, n, o) {
    o = o || {};
    var p = el('path', { 'class': 'pg__arrow' + (o.cls ? ' ' + o.cls : '') }, host);
    p.layout = function () {
      var A = typeof a === 'function' ? a() : a, B = typeof b === 'function' ? b() : b;
      var u = unit(sub(B, A)), v = perp(u), m = mid(A, B);
      var sz = o.size || 9, gap = o.gap || 10, d = '';
      for (var i = 0; i < (n || 1); i++) {
        var c = add(m, mul(u, (i - (n - 1) / 2) * gap));
        var tipP = add(c, mul(u, sz * 0.6));
        d += pathOf([add(sub(c, mul(u, sz * 0.4)), mul(v, sz)), tipP, add(sub(c, mul(u, sz * 0.4)), mul(v, -sz))], true) + ' ';
      }
      p.setAttribute('d', d.trim());
    };
    p.layout();
    return p;
  }

  /* A glowing point: the halo breathing under a bright core, and a
     finger-sized hit area. o: cls, r, hit. */
  function dot(host, p, o) {
    o = o || {};
    var g = el('g', { 'class': 'pg__dot' + (o.cls ? ' ' + o.cls : '') }, host);
    var d = { g: g, halo: el('circle', { 'class': 'pg__dot-halo', r: (o.r || 7) * 2.4 }, g),
              core: el('circle', { 'class': 'pg__dot-core', r: o.r || 7 }, g),
              hit: o.hit ? el('circle', { 'class': 'pg__dot-hit', r: 30, role: 'button', tabindex: -1 }, g) : null, p: p };
    if (d.hit) d.hit.setAttribute('aria-label', global.T ? global.T('a11yDot') : 'A point');
    d.layout = function () {
      var q = typeof p === 'function' ? p() : p;
      d.p = q;
      [d.halo, d.core, d.hit].forEach(function (c) { if (c) { c.setAttribute('cx', round2(q.x)); c.setAttribute('cy', round2(q.y)); } });
    };
    d.layout();
    return d;
  }

  /* A name chip at p: a pill with a word and a tick for when it is right.
     Hands back { g, rect, text, w, h, centre }. */
  function chip(host, p, text, o) {
    o = o || {};
    var g = el('g', { 'class': 'pg__chip' + (o.cls ? ' ' + o.cls : ''), role: 'button', tabindex: -1 }, host);
    g.setAttribute('aria-label', text);
    var w = o.w || Math.max(90, text.length * 12.5 + 36), hh = o.h || 38;
    var c = { g: g, w: w, h: hh, text: null, rect: null, tick: null, centre: p, name: o.name };
    c.rect = el('rect', { 'class': 'pg__chip-rect', width: w, height: hh, rx: hh / 2 }, g);
    c.tick = el('path', { 'class': 'pg__chip-tick' }, g);
    c.text = el('text', { 'class': 'figure-label pg__chip-text', 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, g);
    c.text.textContent = text;
    c.layout = function () {
      var q = typeof p === 'function' ? p() : p;
      c.centre = q;
      c.rect.setAttribute('x', round2(q.x - w / 2)); c.rect.setAttribute('y', round2(q.y - hh / 2));
      c.text.setAttribute('x', round2(q.x + 6)); c.text.setAttribute('y', round2(q.y + 1));
      var tx = q.x - w / 2 + 12, ty = q.y;
      c.tick.setAttribute('d', 'M' + (tx) + ' ' + ty + ' L' + (tx + 5) + ' ' + (ty + 5) + ' L' + (tx + 13) + ' ' + (ty - 5));
    };
    c.layout();
    return c;
  }

  /* A number tag beside a line. */
  function tag(host, p, text) {
    var g = el('g', { 'class': 'pg__tag' }, host);
    var t = { g: g, ring: el('circle', { 'class': 'pg__tag-ring', r: 15 }, g),
              text: el('text', { 'class': 'figure-label pg__tag-text', 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, g) };
    t.text.textContent = text;
    t.layout = function () {
      var q = typeof p === 'function' ? p() : p;
      t.ring.setAttribute('cx', round2(q.x)); t.ring.setAttribute('cy', round2(q.y));
      t.text.setAttribute('x', round2(q.x)); t.text.setAttribute('y', round2(q.y + 1));
    };
    t.layout();
    return t;
  }

  /* Unit squares over a parallelogram: w x h cells of k units from
     `origin` (the bottom-left corner, cm (0, 0)), sheared by `shear` units
     per row (the top edge's offset), so the squares follow the shape.
     Returns the <path>. */
  function grid(host, origin, k, w, h, o) {
    o = o || {};
    var shear = o.shear || 0;
    var d = '';
    for (var r = 0; r <= h; r++) {
      var y = origin.y - r * k, off = shear * r / h;
      d += 'M' + round2(origin.x + off) + ' ' + round2(y) + ' L' + round2(origin.x + off + w * k) + ' ' + round2(y) + ' ';
    }
    for (var c = 0; c <= w; c++) {
      var x = origin.x + c * k;
      d += 'M' + round2(x) + ' ' + round2(origin.y) + ' L' + round2(x + shear) + ' ' + round2(origin.y - h * k) + ' ';
    }
    return el('path', { 'class': 'pg__grid', d: d.trim() }, host);
  }

  /* ---- the lesson's one parallelogram ----------------------------------------
     The shape every teaching page is built on: A(0,0) B(6,0) C(8,3) D(2,3)
     in cm, its height's foot at (2, 0), so the cut triangle is A, D and that
     foot. MAIN.k is figure units per cm when it stands alone in the middle
     of the board; mainPts(origin, k) places it anywhere. */
  var MAIN = { cm: [[0, 0], [6, 0], [8, 3], [2, 3]], k: 56, origin: { x: 276, y: 294 }, footCm: [2, 0] };
  function mainPts(origin, k) { return cm(MAIN.cm, origin || MAIN.origin, k || MAIN.k); }

  global.Para = {
    NS: NS, el: el, round2: round2, MAIN: MAIN, mainPts: mainPts,
    add: add, sub: sub, mul: mul, len: len, unit: unit, perp: perp, dotp: dotp, lerp: lerp, mid: mid, dist: dist,
    foot: foot, pathOf: pathOf, seg: seg, centroid: centroid, bbox: bbox, outward: outward,
    cm: cm, build: build, raPath: raPath,
    label: label, height: height, bracket: bracket, arrows: arrows, dot: dot, chip: chip, tag: tag, grid: grid
  };
})(window);
