/* ==========================================================================
 * widgets.js -- the controls a page puts in front of the learner
 * --------------------------------------------------------------------------
 *   W.handNudge(el, at)       a faint hand tapping el, until stopped
 *   W.handDrag(from, to, px)  a faint hand carrying something from a to b
 *   W.dragGuide(tray, to)     a blank card and a hand, tray -> box, twice
 *   W.card(host, o)           a dark panel in the layer, rows landing one by one
 *   W.caption(host, text, o)  a short chip on the figure
 *   W.button(host, text, o)   a small pill button on the stage
 *   W.keypad(host, o)         the answer line; its box opens the number pad
 *   W.dropdown(host, o)       a blank a formula is chosen from
 *   W.eq(host)                the equation built line by line
 * Every demonstration loop is endless and marked so Skip leaves it; the
 * caller stops it the moment the learner moves. Nothing under reduced motion.
 *
 * Load order: js/animations.js -> js/widgets.js -> js/pages.js
 * ========================================================================== */
(function (global) {
  'use strict';

  var M = global.Motion;
  var Flow = global.Flow;
  var Beats = global.Beats;
  var NS = 'http://www.w3.org/2000/svg';

  function T(key, r) { return global.T ? global.T(key, r) : key; }
  function round2(n) { return Math.round(n * 100) / 100; }
  function gate() { return document.getElementById('gate'); }
  function quiet(p) { if (p && p.catch) p.catch(function () {}); return p; }
  function h(tag, cls, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }
  function write(el, text) {
    if (global.MathText) global.MathText.write(el, text);
    else el.textContent = text;
    return el;
  }
  /* "cm²" with its 2 raised; "A = b × h" as it is. */
  function html(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/²/g, '<sup>2</sup>');
  }

  /* ---- the hand ------------------------------------------------------------- */
  var HAND_D =
    'M-3.5 26 C-5 24 -7 23 -9.5 23.5 C-13 24.5 -14 28 -12 31 L-6 39 C-3 44 3 47 9 47 ' +
    'C18 47 24.5 41 24.5 31 L24.5 18.5 A3.5 3.5 0 0 0 17.5 18.5 ' +
    'L17.5 16 A3.5 3.5 0 0 0 10.5 16 ' +
    'L10.5 13.5 A3.5 3.5 0 0 0 3.5 13.5 ' +
    'L3.5 3.5 A3.5 3.5 0 0 0 -3.5 3.5 Z ' +
    'M17.5 18.5 L17.5 22 M10.5 16 L10.5 22 M3.5 13.5 L3.5 22';
  var HAND_H = 50;

  /* Every hand on screen, so a page change can take them all off at once
     (pages.js wipeBoard / rewind): a nudge armed on a timer can otherwise
     outlive the thing it points at. */
  var hands = [];
  function handsOff() { hands.slice().forEach(function (L) { if (L.stop) L.stop(); }); }
  function handLayer() {
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'hand-layer');
    svg.setAttribute('aria-hidden', 'true');
    var ring = document.createElementNS(NS, 'circle');
    ring.setAttribute('class', 'hand__ring');
    var hand = document.createElementNS(NS, 'path');
    hand.setAttribute('class', 'hand');
    hand.setAttribute('d', HAND_D);
    svg.appendChild(ring);
    svg.appendChild(hand);
    document.body.appendChild(svg);
    var L = { svg: svg, hand: hand, ring: ring, stop: null };
    hands.push(L);
    return L;
  }
  function stopper(tl, L) {
    var stopped = false;
    function stop() {
      if (stopped) return;
      stopped = true;
      var i = hands.indexOf(L);
      if (i >= 0) hands.splice(i, 1);
      if (tl) tl.kill();
      M.to(L.hand, { opacity: 0, duration: M.dur(0.2), ease: 'power2.in', overwrite: 'auto',
        onComplete: function () { if (L.svg.parentNode) L.svg.parentNode.removeChild(L.svg); } });
      L.ring.style.opacity = 0;
    }
    L.stop = stop;
    return stop;
  }
  function none() { return function () {}; }

  /* Tap here: the hand over `el`, pressing and lifting, twice, then again.
     `at` is where on el (fractions), or a function giving a client point. */
  function handNudge(el, at) {
    if (Flow.isFast() || M.reducedMotion()) return none();
    var L = handLayer();
    function tip() {
      if (typeof at === 'function') { var q = at(); return { x: q.x, y: q.y, h: q.h || 56 }; }
      var r = el.getBoundingClientRect();
      var fx = at ? at.x : 0.62, fy = at ? at.y : 0.62;
      return { x: r.left + r.width * fx, y: r.top + r.height * fy, h: Math.max(28, Math.min(r.height, r.width, 90)) };
    }
    var p = { s: 1 }, q = { k: 0.7, a: 0 };
    function move() {
      if (el && !el.isConnected) { if (L.stop) L.stop(); return; }
      var t = tip();
      L.hand.setAttribute('transform', 'translate(' + round2(t.x) + ' ' + round2(t.y) + ') scale(' + round2(t.h / HAND_H * p.s) + ')');
    }
    function wave() {
      var t = tip();
      L.ring.setAttribute('cx', round2(t.x)); L.ring.setAttribute('cy', round2(t.y));
      L.ring.setAttribute('r', round2(t.h * 0.42 * q.k));
      L.ring.style.opacity = q.a;
    }
    move(); wave();
    var tl = M.timeline();
    tl.__motionEndless = true;
    tl.call(function () { p.s = 1; q.k = 0.7; q.a = 0; move(); wave(); }, null, 0);
    tl.to(L.hand, { opacity: 0.92, duration: 0.3, ease: 'power2.out' }, 0);
    [0.35, 1.05].forEach(function (t0) {
      tl.to(p, { s: 1.22, duration: 0.22, ease: 'power2.out', onUpdate: move }, t0)
        .to(p, { s: 1, duration: 0.36, ease: 'power2.inOut', onUpdate: move }, t0 + 0.22);
      tl.fromTo(q, { k: 0.7, a: 0.9 }, { k: 1.15, a: 0, duration: 0.62, ease: 'power2.out', onUpdate: wave }, t0);
    });
    tl.to(L.hand, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 1.85);
    tl.to({}, { duration: 0.8 });
    tl.repeat(-1);
    return stopper(tl, L);
  }

  /* Carry it there: from point `from()` to point `to()` (client px, read
     every frame), the hand `size` px tall. o.once: one trip, then gone. */
  function handDrag(from, to, size, o) {
    o = o || {};
    if (Flow.isFast() || M.reducedMotion()) return none();
    var L = handLayer();
    var p = { t: 0, g: 14 };
    function move() {
      var a = from(), b = to();
      var x = a.x + (b.x - a.x) * p.t, y = a.y + (b.y - a.y) * p.t + p.g * 0.6;
      L.hand.setAttribute('transform', 'translate(' + round2(x) + ' ' + round2(y) + ') scale(' + round2((size || 56) / HAND_H) + ')');
    }
    move();
    var tl = M.timeline();
    tl.__motionEndless = true;
    tl.call(function () { p.t = 0; p.g = 14; move(); }, null, 0);
    tl.to(L.hand, { opacity: 0.92, duration: 0.3, ease: 'power2.out' }, 0);
    tl.to(p, { g: 1.5, duration: 0.24, ease: 'power2.in', onUpdate: move }, 0.2);
    tl.to(p, { t: 1, duration: o.seconds || 1.3, ease: 'power1.inOut', onUpdate: move }, 0.5);
    tl.to(p, { g: 14, duration: 0.24, ease: 'power2.out', onUpdate: move }, 0.5 + (o.seconds || 1.3) + 0.05);
    tl.to(L.hand, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 0.5 + (o.seconds || 1.3) + 0.1);
    tl.to({}, { duration: 0.7 });
    if (!o.once) tl.repeat(-1);
    var stop = stopper(tl, L);
    if (o.once) tl.eventCallback('onComplete', stop);
    return stop;
  }
  function handSlide(track, from, to) {
    return handDrag(function () {
      var r = track.getBoundingClientRect();
      return { x: r.left + r.width * from, y: r.top + r.height / 2 };
    }, function () {
      var r = track.getBoundingClientRect();
      return { x: r.left + r.width * to, y: r.top + r.height / 2 };
    }, 52);
  }

  /* A blank card the size of a name, carried from the tray to `to` by the
     hand, twice. Stops the moment a name is pressed. */
  function dragGuide(tray, to) {
    var stop = none();
    if (!to || Flow.isFast() || M.reducedMotion() || tray.hasAttribute('hidden')) return stop;
    var sample = tray.querySelector('[data-name]');
    var tr = tray.getBoundingClientRect(), end = to.getBoundingClientRect();
    if (!sample || !tr.width || !end.width) return stop;
    var size = sample.getBoundingClientRect();
    var wrap = document.createElement('div');
    wrap.className = 'drag-guide';
    wrap.setAttribute('aria-hidden', 'true');
    var card = document.createElement('div');
    card.className = 'drag-guide__card';
    card.style.width = size.width + 'px'; card.style.height = size.height + 'px';
    card.style.left = -size.width / 2 + 'px'; card.style.top = -size.height / 2 + 'px';
    wrap.appendChild(card);
    var hand = document.createElementNS(NS, 'svg');
    hand.setAttribute('class', 'drag-guide__hand');
    hand.setAttribute('viewBox', '-16 -2 44 52');
    var path = document.createElementNS(NS, 'path');
    path.setAttribute('d', HAND_D);
    hand.appendChild(path);
    wrap.appendChild(hand);
    document.body.appendChild(wrap);
    var sx = tr.left + tr.width / 2, sy = tr.top;
    var ex = end.left + end.width / 2, ey = end.top + end.height / 2;
    var tl = M.timeline({
      willChange: [wrap, card], willChangeValue: 'transform, opacity',
      revert: function () {
        tray.removeEventListener('pointerdown', halt, true);
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      }
    });
    function halt() { if (tl.totalProgress() < 1) tl.totalProgress(1); }
    tl.set(wrap, { x: sx, y: sy, opacity: 0 })
      .to(wrap, { opacity: 0.5, duration: M.dur(0.3), ease: 'power2.out' })
      .to(card, { scale: 0.94, duration: M.dur(0.15), ease: 'power2.out' })
      .to(wrap, { x: ex, y: ey, duration: M.dur(1.0), ease: 'power2.inOut' })
      .to(card, { scale: 1, duration: M.dur(0.2), ease: 'back.out(2)' })
      .to(wrap, { opacity: 0, duration: M.dur(0.3), ease: 'power2.in' }, '+=' + M.dur(0.25));
    tl.repeat(1).repeatDelay(M.dur(0.4));
    tray.addEventListener('pointerdown', halt, true);
    return halt;
  }

  /* ---- cards, captions and small buttons in the layer ------------------------
     Positions are percentages of the layer (the stage), so they hold at
     every board size. */
  function place(el, o) {
    if (o.left != null) el.style.left = o.left + '%';
    if (o.right != null) el.style.right = o.right + '%';
    if (o.top != null) el.style.top = o.top + '%';
    if (o.bottom != null) el.style.bottom = o.bottom + '%';
    if (o.centre) el.style.transform = 'translateX(-50%)';
    if (o.middle) el.style.transform = (o.centre ? 'translate(-50%, -50%)' : 'translateY(-50%)');
  }
  /* o: cls, title, rows (html strings), left/top/... (%), centre. Hands
     back { el, row(html, cls) -> { el, show() }, title, rows }. */
  function card(host, o) {
    o = o || {};
    var el = h('div', 'card' + (o.cls ? ' ' + o.cls : ''), host);
    place(el, o);
    var api = { el: el, rows: [], title: null };
    if (o.title) { api.title = h('p', 'card__title', el); api.title.innerHTML = html(o.title); }
    api.row = function (text, cls) {
      var r = h('div', 'card__row' + (cls ? ' ' + cls : ''), el);
      r.innerHTML = html(text);
      M.set(r, { opacity: 0 });
      api.rows.push(r);
      return { el: r, show: function () { return Flow.anim(Beats.rowIn(r)); },
               set: function (t) { r.innerHTML = html(t); } };
    };
    (o.rows || []).forEach(function (t) { api.row(t); });
    /* every row shown at once with the card */
    api.show = function () {
      M.set(api.rows, { opacity: 1 });
      return Flow.anim(Beats.cardIn(el));
    };
    api.remove = function () { if (el.parentNode) el.parentNode.removeChild(el); };
    return api;
  }
  function caption(host, text, o) {
    o = o || {};
    var el = h('div', 'caption' + (o.cls ? ' ' + o.cls : ''), host);
    el.innerHTML = html(text);
    place(el, o);
    return el;
  }
  function button(host, text, o) {
    o = o || {};
    var b = h('button', 'pill-btn' + (o.cls ? ' ' + o.cls : ''), host);
    b.type = 'button';
    b.textContent = text;
    place(b, o);
    M.button3d(b, { edge: 3 });
    return b;
  }

  /* ---- the keypad --------------------------------------------------------------
     Two pieces. The answer line -- label ("Area ="), the answer box, the unit
     ("cm²") -- goes in `host`. The number pad -- the keys in a grid and the
     check button under them -- goes in o.padHost (host if none), shut.
     Pressing the box opens the pad (so does typing a digit); it stays open
     until the answer is right, then folds away.
     o: label, unit, answer (number), check (the button's word), max (digits),
     nudgeAfter (ms before a hand taps the box, if the pad is still shut),
     onWrong(value, tries) -> promise.
     ask() resolves { tries, auto } once the answer is in -- at once, put in,
     under Skip. A wrong number turns the box soft amber and shakes it; the
     keys wait while the reason is said; then the box is cleared for another
     try. Never fills the answer in for the learner. */
  function keypad(host, o) {
    o = o || {};
    var el = h('div', 'keypad', host);
    var entry = h('div', 'keypad__entry', el);
    var lab = h('span', 'keypad__label', entry); lab.textContent = o.label || '';
    var box = h('button', 'keypad__box', entry);
    box.type = 'button';
    box.setAttribute('aria-label', T('a11yAnswerBox'));
    box.setAttribute('aria-haspopup', 'true');
    box.setAttribute('aria-expanded', 'false');
    var val = h('span', 'keypad__value', box);
    val.setAttribute('aria-live', 'polite');
    var tick = document.createElementNS(NS, 'svg');
    tick.setAttribute('class', 'keypad__tick'); tick.setAttribute('viewBox', '0 0 24 24');
    tick.setAttribute('aria-hidden', 'true');
    var tp = document.createElementNS(NS, 'path');
    tp.setAttribute('d', 'M4 12.5 L9.5 18 L20 7'); tp.setAttribute('fill', 'none'); tp.setAttribute('stroke', 'currentColor');
    tp.setAttribute('stroke-width', '3.2'); tp.setAttribute('stroke-linecap', 'round'); tp.setAttribute('stroke-linejoin', 'round');
    tick.appendChild(tp); box.appendChild(tick);
    var unit = h('span', 'keypad__unit', entry); unit.innerHTML = html(o.unit || '');

    /* the pad: a region (placed by css) with the panel in it -- the panel is
       what springs open, so the region's own placement is never animated */
    var pad = h('div', 'keypad__pad', o.padHost || host);
    pad.setAttribute('hidden', '');
    var panel = h('div', 'keypad__panel', pad);
    panel.setAttribute('role', 'group');
    panel.setAttribute('aria-label', T('a11yKeypad'));
    var keys = h('div', 'keypad__keys', panel);
    var btns = [];
    /* 1-9 in rows of three; then 0, two keys wide, and backspace beside it */
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '⌫'].forEach(function (k) {
      var b = h('button', 'keypad__key' + (k === '⌫' ? ' keypad__key--back' : k === '0' ? ' keypad__key--zero' : ''), keys);
      b.type = 'button';
      b.textContent = k;
      b.dataset.key = k;
      b.setAttribute('aria-label', k === '⌫' ? T('a11yBackspace') : k);
      M.button3d(b, { edge: 3 });
      btns.push(b);
    });
    var check = h('button', 'keypad__check', panel);
    check.type = 'button';
    check.textContent = o.check || T('btnCheckArea');
    check.disabled = true;
    M.button3d(check, { edge: 4 });

    var value = '', live = false, busy = false, tries = 0, done = false, auto = false;
    var opened = false, stopHand = null;
    var max = o.max || 3;
    function paint() {
      val.textContent = value;
      check.disabled = !value.length || !live || busy;
      /* the box breathes while it waits to be pressed */
      box.classList.toggle('is-asking', live && !busy && !value.length && !opened);
    }
    function unNudge() { if (stopHand) { stopHand(); stopHand = null; } }
    /* the pad, opened from the box */
    function open() {
      if (opened || !live || done) return;
      opened = true;
      unNudge();
      box.classList.add('is-open');
      box.setAttribute('aria-expanded', 'true');
      pad.removeAttribute('hidden');
      paint();
      Beats.pop();
      quiet(Flow.anim(Beats.padIn(panel)));
    }
    /* and folded away again */
    function close() {
      if (!opened) return Promise.resolve();
      opened = false;
      box.classList.remove('is-open');
      box.setAttribute('aria-expanded', 'false');
      return Flow.anim(Beats.padOut(panel)).then(function () { pad.setAttribute('hidden', ''); });
    }
    function onBox(ev) {
      if (!live || done) return;
      if (ev && ev.clientX != null && M.tapRipple) M.tapRipple(ev.clientX, ev.clientY);
      open();
    }
    function press(k) {
      if (!live || busy || done) return;
      if (k === '⌫') value = value.slice(0, -1);
      else if (value.length < max) value += k;
      Beats.pop();
      paint();
    }
    function onKey(ev) { press(ev.currentTarget.dataset.key); }
    function onCheck() {
      if (!live || busy || done || !value.length) return;
      tries++;
      var n = parseInt(value, 10);
      if (n === o.answer) {
        done = true; live = false;
        box.classList.remove('is-wrong');
        box.classList.add('is-right');
        el.classList.add('is-done');
        pad.classList.add('is-done');
        Beats.sfx('correct');
        quiet(Flow.anim(M.correct(box)));
        paint();
        quiet(close());
        gate().dispatchEvent(new MouseEvent('click'));
        return;
      }
      busy = true;
      pad.classList.add('is-hearing');
      box.classList.add('is-wrong');
      Beats.sfx('wrong');
      paint();
      var said = o.onWrong ? o.onWrong(n, tries) : null;
      quiet(Promise.all([Flow.anim(M.incorrect(box)), said]).then(function () {
        if (done) return;
        box.classList.remove('is-wrong');
        value = '';
        busy = false;
        pad.classList.remove('is-hearing');
        paint();
      }, function () { busy = false; }));
    }
    /* the keyboard as well: a digit opens the pad if it is shut */
    function onType(ev) {
      if (!live || busy || done) return;
      if (/^[0-9]$/.test(ev.key)) { open(); press(ev.key); ev.preventDefault(); }
      else if (ev.key === 'Backspace') { press('⌫'); ev.preventDefault(); }
      else if (ev.key === 'Enter' && value.length) { onCheck(); ev.preventDefault(); }
    }
    box.addEventListener('click', onBox);
    btns.forEach(function (b) { b.addEventListener('click', onKey); });
    check.addEventListener('click', onCheck);
    paint();

    /* put in for the learner (a skip): the answer in the box, marked, the
       pad shut, no chime */
    function putIn() {
      auto = true; done = true; live = false;
      value = String(o.answer);
      box.classList.remove('is-wrong'); box.classList.add('is-right');
      el.classList.add('is-done'); pad.classList.add('is-done'); pad.classList.remove('is-hearing');
      paint();
      quiet(close());
    }

    var api = {
      el: el, pad: pad, box: box, check: check,
      value: function () { return value; },
      show: function () { return Flow.anim(Beats.cardIn(el)); },
      open: open,
      close: close,
      ask: function () {
        live = true;
        paint();
        document.addEventListener('keydown', onType);
        if (Flow.isFast()) {
          putIn();
          document.removeEventListener('keydown', onType);
          return Promise.resolve({ tries: tries, auto: true });
        }
        if (o.nudgeAfter) {
          quiet(Flow.wait(o.nudgeAfter).then(function () {
            if (live && !opened && !done && !stopHand) stopHand = handNudge(box, { x: 0.5, y: 0.62 });
          }));
        }
        return Flow.once(gate(), { auto: true }).then(function () {
          document.removeEventListener('keydown', onType);
          unNudge();
          if (!done) putIn();       /* answered by a skip mid-way */
          return { tries: tries, auto: auto };
        }, function (err) {
          document.removeEventListener('keydown', onType);
          unNudge();
          live = false;
          throw err;
        });
      },
      remove: function () {
        unNudge();
        if (el.parentNode) el.parentNode.removeChild(el);
        if (pad.parentNode) pad.parentNode.removeChild(pad);
      }
    };
    return api;
  }

  /* ---- the dropdown ---------------------------------------------------------
     o: options [{ key, text }], right (a key), placeholder. The list opens
     under the blank; a choice is checked at once. A wrong one turns the
     blank amber and shakes it, the reason is said (o.onWrong(key, tries),
     awaited), then the blank goes back to its placeholder and the options
     are shuffled. The right one turns green with a tick. ask() resolves
     { tries, auto }. */
  function dropdown(host, o) {
    o = o || {};
    var root = h('span', 'dropdown', host);
    var btn = h('button', 'dropdown__btn', root);
    btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', T('a11yDropdown'));
    var word = h('span', 'dropdown__word', btn);
    var tick = document.createElementNS(NS, 'svg');
    tick.setAttribute('class', 'dropdown__tick'); tick.setAttribute('viewBox', '0 0 24 24');
    var tp = document.createElementNS(NS, 'path');
    tp.setAttribute('d', 'M4 12.5 L9.5 18 L20 7'); tp.setAttribute('fill', 'none'); tp.setAttribute('stroke', 'currentColor');
    tp.setAttribute('stroke-width', '3.2'); tp.setAttribute('stroke-linecap', 'round'); tp.setAttribute('stroke-linejoin', 'round');
    tick.appendChild(tp); btn.appendChild(tick);
    var chev = document.createElementNS(NS, 'svg');
    chev.setAttribute('class', 'chev'); chev.setAttribute('viewBox', '0 0 14 10');
    var cp = document.createElementNS(NS, 'path');
    cp.setAttribute('d', 'M1.5 2 L7 8 L12.5 2'); cp.setAttribute('fill', 'none'); cp.setAttribute('stroke', 'currentColor');
    cp.setAttribute('stroke-width', '2.4'); cp.setAttribute('stroke-linecap', 'round'); cp.setAttribute('stroke-linejoin', 'round');
    chev.appendChild(cp); btn.appendChild(chev);
    var list = h('ul', 'dropdown__list', root);
    list.setAttribute('role', 'listbox');
    list.setAttribute('hidden', '');
    var items = [];
    var placeholder = o.placeholder || T('f3Select');
    word.textContent = placeholder;

    var live = false, busy = false, open = false, done = false, tries = 0, auto = false, focus = -1;
    function fill(order) {
      list.textContent = '';
      items = order.map(function (opt) {
        var li = h('li', 'dropdown__item', list);
        li.setAttribute('role', 'option');
        li.dataset.key = opt.key;
        write(li, opt.text);
        li.addEventListener('click', function () { choose(opt.key, opt.text); });
        return li;
      });
    }
    function shuffled() {
      var a = o.options.slice();
      for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
      return a;
    }
    function setOpen(on) {
      open = on;
      if (on) list.removeAttribute('hidden'); else list.setAttribute('hidden', '');
      btn.setAttribute('aria-expanded', on ? 'true' : 'false');
      items.forEach(function (li) { li.classList.remove('is-focus'); });
      focus = -1;
    }
    function toggle() {
      if (!live || busy || done) return;
      setOpen(!open);
    }
    function choose(key, text) {
      if (!live || busy || done) return;
      setOpen(false);
      tries++;
      write(word, text);
      if (key === o.right) {
        done = true; live = false;
        btn.classList.remove('is-wrong', 'is-asking');
        btn.classList.add('is-right');
        root.classList.add('is-done');
        Beats.sfx('correct');
        quiet(Flow.anim(M.correct(btn)));
        gate().dispatchEvent(new MouseEvent('click'));
        return;
      }
      busy = true;
      btn.classList.remove('is-asking');
      btn.classList.add('is-wrong');
      Beats.sfx('wrong');
      var said = o.onWrong ? o.onWrong(key, tries) : null;
      quiet(Promise.all([Flow.anim(M.incorrect(btn)), said]).then(function () {
        if (done) return;
        btn.classList.remove('is-wrong');
        btn.classList.add('is-asking');
        word.textContent = placeholder;
        fill(shuffled());
        busy = false;
      }, function () { busy = false; }));
    }
    function onKey(ev) {
      if (!live || busy || done) return;
      if (ev.key === 'Escape') { setOpen(false); return; }
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        if (!open) setOpen(true);
        focus = (focus + (ev.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach(function (li, i) { li.classList.toggle('is-focus', i === focus); });
        return;
      }
      if ((ev.key === 'Enter' || ev.key === ' ') && open && focus >= 0) {
        ev.preventDefault();
        items[focus].click();
      }
    }
    function onDocDown(ev) { if (open && !root.contains(ev.target)) setOpen(false); }
    btn.addEventListener('click', toggle);
    btn.addEventListener('keydown', onKey);
    fill(o.options.slice());

    return {
      el: root, btn: btn,
      ask: function () {
        live = true;
        btn.classList.add('is-asking');
        document.addEventListener('pointerdown', onDocDown, true);
        if (Flow.isFast()) {
          var r = o.options.filter(function (x) { return x.key === o.right; })[0];
          done = true; live = false; auto = true;
          if (r) write(word, r.text);
          btn.classList.remove('is-asking'); btn.classList.add('is-right'); root.classList.add('is-done');
          document.removeEventListener('pointerdown', onDocDown, true);
          return Promise.resolve({ tries: tries, auto: true });
        }
        return Flow.once(gate(), { auto: true }).then(function () {
          document.removeEventListener('pointerdown', onDocDown, true);
          if (!done) {
            var r2 = o.options.filter(function (x) { return x.key === o.right; })[0];
            done = true; live = false; auto = true; setOpen(false);
            if (r2) write(word, r2.text);
            btn.classList.remove('is-asking', 'is-wrong'); btn.classList.add('is-right'); root.classList.add('is-done');
          }
          return { tries: tries, auto: auto };
        }, function (err) { document.removeEventListener('pointerdown', onDocDown, true); live = false; throw err; });
      }
    };
  }

  /* ---- the equation, built line by line ----------------------------------
     eq.line(n, html) -> { el, show(), words } : a numbered line; `html` may
     hold <span class="eq__word">...</span> spans a later beat swaps. */
  function eq(host, o) {
    o = o || {};
    var el = h('div', 'eq' + (o.cls ? ' ' + o.cls : ''), host);
    if (o.left != null || o.bottom != null || o.top != null) { el.style.transform = 'none'; place(el, o); }
    var api = { el: el, lines: [] };
    api.line = function (n, content) {
      var row = h('div', 'eq__line', el);
      if (n != null) { var num = h('span', 'eq__num', row); num.textContent = String(n); }
      var body = h('span', 'eq__body', row);
      if (typeof content === 'string') body.innerHTML = content;
      else if (content) body.appendChild(content);
      var line = { el: row, body: body,
                   show: function () { return Flow.anim(Beats.rowIn(row)); } };
      api.lines.push(line);
      return line;
    };
    api.show = function () { return Flow.anim(Beats.cardIn(el)); };
    api.remove = function () { if (el.parentNode) el.parentNode.removeChild(el); };
    return api;
  }

  global.W = {
    HAND_D: HAND_D, HAND_H: HAND_H, html: html, h: h,
    handNudge: handNudge, handDrag: handDrag, handSlide: handSlide, dragGuide: dragGuide, handsOff: handsOff,
    card: card, caption: caption, button: button, keypad: keypad, dropdown: dropdown, eq: eq
  };
})(window);
