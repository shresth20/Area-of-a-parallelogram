/* ==========================================================================
 * pages.js -- the board's kit, the welcome, and the lesson's scene list
 * --------------------------------------------------------------------------
 * One scene is one `await` chain. Everything it waits on -- a stretch of
 * time, an animation, a tap -- is taken out through Flow, so the whole chain
 * unwinds in one go if the scene is replayed, and collapses to a few frames
 * if Skip is pressed. Nothing in here sets a timeout of its own.
 *
 * The sections (js/s1-*.js ...) register through Pages.addSection and speak
 * through the kit handed to them: the bird's moves, the header line, the
 * perch beside the figure, the hand-over, the activities, the board's
 * housekeeping. The behaviour is the circle game's; the look is the theme's.
 *
 * Load order: motion.js -> flow.js -> mathtext.js -> typer.js -> mascot.js
 *             -> para.js -> animations.js -> widgets.js -> pages.js
 * ========================================================================== */
(function (global) {
  'use strict';

  var M = global.Motion;
  var Flow = global.Flow;
  var Beats = global.Beats;
  var W = global.W;

  function T(key, repl) { return global.T ? global.T(key, repl) : key; }

  /* ---- pacing ---------------------------------------------------------- */
  var BEAT  = 560;      /* between one line and the next                   */
  var SHORT = 280;      /* between two marks of one drawing                */
  var LOOK  = 1400;     /* a finished mark, left to be looked at           */
  var AUTO_TURN = 2000; /* a self-turning page, held to be read            */
  var NUDGE_AFTER = 2400; /* ms with nothing done before the hand shows   */

  var VB_W = 1000, VB_H = 420;

  var dom = null;
  var mascot = null;
  var chips = [];
  var choiceBtns = [];
  var sayBubble, sayPrompt;

  function $(id) { return document.getElementById(id); }
  function collect() {
    return {
      welcome: $('welcome'), title: $('welcomeTitle'), startBtn: $('startBtn'),
      frame: $('frame'), slotHero: $('slotHero'), bubble: $('bubble'),
      board: $('board'), slotHeader: $('slotHeader'), promptLine: document.querySelector('.prompt__line'),
      figure: $('figure'), layer: $('layer'), burst: $('figBurst'),
      tray: $('tray'), choices: $('choices'), gate: $('gate'),
      nextBtn: $('nextBtn'), endActions: $('endActions'), replayBtn: $('replayBtn')
    };
  }

  function round2(n) { return Math.round(n * 100) / 100; }

  /* ---- the names in the tray, the answers ------------------------------- */
  function buildChips(tray, names) {
    tray.textContent = '';
    return names.map(function (name) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = T(name);
      b.dataset.name = name;
      b.setAttribute('aria-label', T('a11yChip', { name: T(name) }));
      tray.appendChild(b);
      return b;
    });
  }
  function buildChoices(host, labels) {
    host.textContent = '';
    return labels.map(function (text) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'choice';
      global.MathText.write(b, text);
      b.dataset.name = text;
      host.appendChild(b);
      return b;
    });
  }
  function shuffle(list) {
    var a = list.slice();
    for (var tries = 0; tries < 8; tries++) {
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
      }
      if (a.join() !== list.join()) break;
    }
    return a;
  }

  /* ---- the figure as a whole ---------------------------------------------- */
  function figureParts() {
    return sections.reduce(function (all, s) { return s.parts ? all.concat(s.parts()) : all; }, []);
  }
  function clearInline(els) {
    M.set(els, { clearProps: 'opacity,transform,strokeWidth' });
    els.forEach(function (p) {
      if (!p.style) return;
      p.style.strokeDasharray = '';
      p.style.strokeDashoffset = '';
    });
  }
  function resetFigure() {
    sections.forEach(function (s) { if (s.reset) s.reset(); });
    dom.burst.textContent = '';
    Array.prototype.forEach.call(dom.figure.querySelectorAll('.is-lit, .is-pulsing, .is-dim, .is-glowing, .is-calling'), function (e) {
      e.classList.remove('is-lit', 'is-pulsing', 'is-dim', 'is-glowing', 'is-calling');
      e.style.removeProperty('--pulse-times');
    });
    clearInline([dom.figure].concat(Array.prototype.slice.call(dom.figure.querySelectorAll('*'))));
  }
  function resetFooter() {
    dom.tray.setAttribute('hidden', ''); dom.tray.textContent = ''; chips = [];
    dom.choices.setAttribute('hidden', ''); dom.choices.textContent = ''; choiceBtns = [];
    letGoFigure();
  }
  function ripple(ev, target) {
    var r = target.getBoundingClientRect();
    M.tapRipple((ev && ev.clientX) || (r.left + r.width / 2), (ev && ev.clientY) || (r.top + r.height / 2));
  }
  function quiet(p) { if (p && p.catch) p.catch(function () {}); return p; }

  /* ---- Next (Continue) ------------------------------------------------------ */
  function handOver(btn) {
    btn = btn || dom.nextBtn;
    note(at, page);
    announce();
    if (seek > 0) {
      seek--;
      turned();
      if (!seek) Flow.resume();
      return Promise.resolve();
    }
    Flow.resume();
    M.button3d(btn, { edge: 5 });
    Beats.controlIn(btn);
    return Flow.once(btn).then(function () {
      Beats.sfx('click');
      turned();
      return Flow.anim(Beats.controlOut(btn));
    });
  }
  function autoTurn(ms) {
    note(at, page);
    announce();
    if (seek > 0) {
      seek--;
      turned();
      if (!seek) Flow.resume();
      return Promise.resolve();
    }
    Flow.resume();
    return Flow.wait(ms == null ? AUTO_TURN : ms).then(turned);
  }

  /* ---- the header line ----------------------------------------------------- */
  function clearPrompt() {
    sayPrompt.clear();
    M.set(dom.promptLine, { clearProps: 'opacity,transform,filter' });
  }
  function sayInHeader(text, over) {
    var slot = dom.slotHeader;
    var before = slot.getBoundingClientRect().left;
    var reveal = sayPrompt.reserve(text, over);
    var shift = before - slot.getBoundingClientRect().left;
    if (Math.abs(shift) > 0.5) {
      M.set(slot, { x: shift });
      M.to(slot, { x: 0, duration: M.dur(0.42), ease: 'power2.inOut' });
    }
    return reveal();
  }

  var speaking = 0;
  function lineOf(text) {
    if (text && typeof text === 'object') return text;
    return { text: String(text), vo: null };
  }
  function hear(key) {
    if (!key || !global.I18n || Flow.isFast()) return Promise.resolve(false);
    var done = false, ok = false;
    quiet(global.I18n.say(key)).then(function (r) { done = true; ok = r; }, function () { done = true; });
    function heard() {
      if (Flow.isFast()) { global.I18n.stop(); return false; }
      if (done) return ok;
      return Flow.wait(80).then(heard, function (err) { global.I18n.stop(); throw err; });
    }
    return heard();
  }
  function voiceOf(line) { return line.vo ? hear(line.vo) : Promise.resolve(false); }

  /* A line on its recording's clock (see the circle game's pages.js). */
  var keyOfText = null, patterns = null;
  function plain(text) { return String(text).replace(/ /g, ' '); }
  function cuesFor(text, key) {
    var I = global.I18n;
    if (!I || !I.cues) return null;
    if (key && I.voiced().indexOf(key) >= 0) return I.cues(key, plain(text));
    if (!keyOfText) {
      keyOfText = {}; patterns = [];
      I.voiced().forEach(function (k) {
        var s = I.t(k);
        keyOfText[s] = k;
        if (/\{\w+\}/.test(s)) {
          patterns.push({ key: k, re: new RegExp('^' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{\w+\\\}/g, '.+?') + '$') });
        }
      });
    }
    var line = plain(text);
    var k2 = keyOfText[line];
    if (!k2) patterns.some(function (p) { if (p.re.test(line)) { k2 = p.key; return true; } });
    return k2 ? I.cues(k2, line) : null;
  }
  function wordAt(text, phrase) {
    var i = plain(text).indexOf(plain(phrase));
    if (i < 0) return 0;
    var cues = cuesFor(text);
    if (!cues) return i * global.Typer.TYPE_MS;
    var cuts = global.Typer.wordCuts(plain(text));
    for (var w = 0; w < cuts.length && w < cues.length; w++) if (i < cuts[w]) return cues[w];
    return cues[cues.length - 1];
  }
  var begun = { text: null, at: 0 };
  var awaiting = [];
  function began(text) {
    begun = { text: text, at: performance.now() };
    awaiting = awaiting.filter(function (w) {
      if (w.text !== text) return true;
      w.resolve(begun.at);
      return false;
    });
  }
  function lineBegins(text) {
    if (begun.text === text && performance.now() - begun.at < 100) return Promise.resolve(begun.at);
    return new Promise(function (resolve) { awaiting.push({ text: text, resolve: resolve }); });
  }
  /* fn, run as `phrase` is heard (or typed) in the line `text`. A line of
     several sentences is shown a sentence at a time, so the phrase is timed
     from the start of ITS sentence. */
  function onWord(text, phrase, fn) {
    var parts = sentencesOf(text), from = text;
    if (parts) {
      parts.some(function (s) {
        if (plain(s).indexOf(plain(phrase)) < 0) return false;
        from = s.trim();
        return true;
      });
    }
    return lineBegins(from)
      .then(function (t0) {
        var into = from === text ? wordAt(text, phrase) : Math.max(0, wordAt(text, phrase) - wordAt(text, from));
        return Flow.wait(t0 + into - performance.now());
      })
      .then(fn);
  }
  /* The same by key: armed BEFORE the line is said. */
  function onPhrase(key, phrase, fn) {
    return quiet(onWord(T(key), phrase, fn));
  }
  function onVoice(say) {
    function reserve(text, over) {
      var key = text && typeof text === 'object' ? text.vo : null;
      text = text && typeof text === 'object' ? text.text : text;
      var cues = over ? null : cuesFor(text, key);
      var reveal = say.reserve(text, over || (cues ? { at: cues } : undefined));
      return function () { began(text); return reveal(); };
    }
    function said(text, over) { return reserve(text, over)(); }
    said.reserve = reserve;
    said.clear = say.clear;
    return said;
  }

  /* The bird on the header saying its next line. `along(line)` is acted out
     on the figure while it is said. */
  function speak(text, mood, along) {
    var line = lineOf(text);
    var mine = ++speaking;
    var has = dom.promptLine.textContent.trim().length > 0;
    var gone = has ? Flow.anim(Beats.lineOut(dom.promptLine)) : Promise.resolve();
    return gone.then(function () {
      if (mine !== speaking) return;
      M.set(dom.promptLine, { clearProps: 'opacity,transform,filter' });
      mascot.state(mood || 'talking');
      var heard = quiet(voiceOf(line));
      var said = sayInHeader(line);
      return Promise.all([said, heard, along ? along(line) : null]);
    }).then(function () {
      if (mine === speaking) mascot.settle();
    });
  }

  /* ---- the mascot's jump on and off the board ------------------------------
     The bird drops onto its spot from above the screen, squashed on landing
     and recovering, and leaves by crouching and springing back up out of
     sight. The apex is always above the viewport, so no second element has
     to stand in for the bird behind the (translucent) board. */
  var FOOT = 0.90, CLEAR = 8;
  function apexFor(cell) {
    var b = dom.board.getBoundingClientRect();
    return Math.min(b.top - CLEAR - (FOOT - 0.5) * cell.height, -cell.height * 0.6);
  }
  function jumpDone() { M.set(mascot.el, { clearProps: 'transform' }); }
  function mascotJumpIn(slot) {
    var e = mascot.el;
    slot = slot || dom.slotHeader;
    if (slot === dom.slotHeader) quiet(Flow.anim(openHeader()));
    e.classList.add('is-away');
    e.hidden = false;
    mascot.placeIn(slot);
    var cell = e.getBoundingClientRect();
    if (!cell.width || M.reducedMotion()) { e.classList.remove('is-away'); return Promise.resolve(); }
    var from = apexFor(cell) - (cell.top + cell.height / 2);
    M.set(e, { y: from });
    e.classList.remove('is-away');
    return Flow.anim(Beats.landOn(e, from)).then(jumpDone, function (err) { jumpDone(); throw err; });
  }
  function mascotJumpOut(keep) {
    var e = mascot.el;
    if (e.hidden || e.classList.contains('is-away')) return Promise.resolve();
    if (e.parentNode === dom.slotHero && !dom.board.classList.contains('show')) return Promise.resolve();
    var closes = e.parentNode === dom.slotHeader && !keep;
    var shut = function () { if (closes) quiet(Flow.anim(collapseHeader(true))); };
    var cell = e.getBoundingClientRect();
    if (!cell.width || M.reducedMotion()) { e.classList.add('is-away'); shut(); return Promise.resolve(); }
    return Flow.anim(Beats.springOff(e, apexFor(cell) - (cell.top + cell.height / 2)))
      .then(function () { e.classList.add('is-away'); jumpDone(); shut(); },
            function (err) { jumpDone(); throw err; });
  }
  function arriveSaying(text, mood, along) {
    var line = lineOf(text);
    speaking++;
    var reveal = sayPrompt.reserve(line);
    return mascotJumpIn().then(function () {
      mascot.state(mood || 'talking');
      var heard = quiet(voiceOf(line));
      return Promise.all([reveal(), heard, along ? along(line) : null]);
    });
  }

  /* ONE sentence on screen at a time, everywhere: every line the bird says
     comes through say(), and a line of several sentences is shown a
     sentence at a time -- each one replacing the one before. */
  function sayOne(line, mood, along) {
    return birdOnHeader() ? speak(line, mood, along) : arriveSaying(line, mood, along);
  }
  function say(key, mood, along) {
    var line = typeof key === 'string' ? keyed(key) : lineOf(key);
    if (perch && perch.open) return perchLine(line, mood);
    var parts = sentencesOf(line.text);
    if (!parts) return sayOne(line, mood, along);
    parts = parts.map(function (s) { return s.trim(); });
    if (Flow.isFast()) {
      began(line.text);
      parts.forEach(function (s) { began(s); });
      return sayOne({ text: parts[parts.length - 1], vo: null }, mood, along);
    }
    return bySentence(line, parts, mood, along);
  }
  function speakBySentence(key, mood, repl) {
    return say(keyed(key, repl), mood);
  }
  function speakLine(text, mood, along) {
    return say(lineOf(text), mood, along);
  }
  function keyed(key, repl) {
    return { text: global.I18n ? global.I18n.t(key, repl) : key, vo: key };
  }

  /* A sentence ends at . ! or ? followed by a space or the end of the line
     (so a "4.5" is never cut in two). */
  var OUT_LEAD = 280;
  function sentencesOf(text) {
    var parts = String(text).match(/[\s\S]*?[.!?]+(?=\s|$)\s*/g);
    return parts && parts.length > 1 && parts.join('') === String(text) ? parts : null;
  }
  function bySentence(line, parts, mood, along) {
    var acting = along ? quiet(along(line)) : null;
    var cues = cuesFor(line.text, line.vo);
    if (!cues) {
      var heard = null;
      var chain = parts.reduce(function (c, s, i) {
        return c.then(function (n) {
          if (i > 0 && n !== speaking) return n;
          if (i === 0) began(line.text);
          var said = sayOne({ text: s, vo: null }, mood);
          if (i === 0) heard = quiet(voiceOf(line));
          var mine = speaking;
          return said.then(function () { return mine; });
        });
      }, Promise.resolve(speaking));
      return Promise.all([chain.then(function () { return heard; }), acting]);
    }
    var w = 0;
    var split = parts.map(function (s) {
      var n = (s.match(/\S+\s*/g) || []).length;
      var at2 = cues.slice(w, w + n);
      w += n;
      return { text: s, at: at2 };
    });
    var up = birdOnHeader() ? Promise.resolve() : mascotJumpIn();
    return up.then(function () {
      var mine = ++speaking;
      var has = dom.promptLine.textContent.trim().length > 0;
      var gone = has ? Flow.anim(Beats.lineOut(dom.promptLine)) : Promise.resolve();
      return gone.then(function () {
        if (mine !== speaking) return;
        M.set(dom.promptLine, { clearProps: 'opacity,transform,filter' });
        mascot.state(mood || 'talking');
        var t0 = performance.now();
        began(line.text);
        var heard2 = quiet(voiceOf(line));
        var typed = split.reduce(function (chain, s, i) {
          return chain.then(function () {
            if (mine !== speaking) return;
            var out = i === 0 ? Promise.resolve() :
              Flow.wait(t0 + s.at[0] - OUT_LEAD - performance.now()).then(function () {
                if (mine !== speaking) return;
                return Flow.anim(Beats.lineOut(dom.promptLine));
              });
            return out.then(function () {
              if (mine !== speaking) return;
              M.set(dom.promptLine, { clearProps: 'opacity,transform,filter' });
              var late = performance.now() - t0;
              return sayInHeader(s.text, { at: s.at.map(function (c) { return Math.max(0, c - late); }) });
            });
          });
        }, Promise.resolve());
        return Promise.all([typed, heard2, acting]);
      }).then(function () { if (mine === speaking) mascot.settle(); });
    });
  }
  function typedFor(text) {
    var cues = cuesFor(text);
    if (cues) return (cues[cues.length - 1] + global.Typer.WORD_IN * 2) / 1000;
    return text.length * global.Typer.TYPE_MS / 1000;
  }
  /* A line said by the voice alone; a line not yet recorded is given the
     time it would take, so the beats round it keep their pace. */
  var VO_MIN = 1600, VO_PACE = 65;
  function voiceOver(key) {
    if (Flow.isFast() || !global.I18n) return Flow.wait(0);
    var from = Date.now();
    var floor = Math.max(VO_MIN, global.I18n.t(key).length * VO_PACE);
    return hear(key).then(function (played) {
      if (!played) return Flow.wait(floor - (Date.now() - from));
    });
  }
  function birdVoice(key) {
    mascot.state('talking');
    return voiceOver(key).then(function () { mascot.settle(); });
  }
  function birdAway() {
    return Promise.all([mascotJumpOut(true), Flow.anim(Beats.lineOut(dom.promptLine))]).then(clearPrompt);
  }
  function lineAway() {
    return Flow.anim(Beats.lineOut(dom.promptLine)).then(function () {
      var slot = dom.slotHeader;
      var before = slot.getBoundingClientRect().left;
      clearPrompt();
      var shift = before - slot.getBoundingClientRect().left;
      if (Math.abs(shift) <= 0.5) return;
      M.set(slot, { x: shift });
      return Flow.anim(M.to(slot, { x: 0, duration: M.dur(0.42), ease: 'power2.inOut' }));
    });
  }
  function birdOnHeader() {
    var e = mascot.el;
    return e.parentNode === dom.slotHeader && !e.hidden && !e.classList.contains('is-away');
  }

  /* ======================================================================
   * The bird beside the figure -- the perch
   * ----------------------------------------------------------------------
   * A question asked beside the figure rather than from the header: the
   * figure stands on the left of the board, and on the right the bird has a
   * spot of its own, with a bubble over its head and a row under its feet
   * for the answers (and, once answered, for the working). While the perch
   * is up, the question and every verdict on it are said in that bubble and
   * the header stays shut. Laid out and behaving as the circle game's
   * formula pane; drawn in the theme's own colours (style.css).
   * ====================================================================== */
  var perch = null;
  var SENTENCE_HOLD = 560;

  function div(cls, parent) {
    var e = document.createElement('div');
    e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }
  function perchBuild() {
    var root = div('perch', dom.layer);
    var stand = div('perch__stand', root);
    var bubble = dom.bubble.cloneNode(true);
    bubble.removeAttribute('id');
    bubble.removeAttribute('style');
    Array.prototype.forEach.call(bubble.querySelectorAll('[id]'), function (n) { n.removeAttribute('id'); });
    bubble.querySelector('.type-wrap').removeAttribute('style');
    bubble.querySelector('.type-ghost').textContent = '';
    bubble.querySelector('.type .txt').textContent = '';
    bubble.classList.add('bubble--perch');
    bubble.setAttribute('hidden', '');
    stand.appendChild(bubble);
    var answers = div('perch__answers', root);
    answers.setAttribute('role', 'group');
    answers.setAttribute('aria-label', T('a11yAnswers'));
    var typer = global.Typer.create(bubble.querySelector('.type-wrap'), { box: bubble, fit: true });
    return { root: root, stand: stand, bubble: bubble, answers: answers, say: onVoice(typer), open: false, shown: false };
  }
  function perchOpen(P) {
    var away = birdOnHeader() || dom.promptLine.textContent.trim() ? birdAway() : Promise.resolve();
    return away
      .then(function () { return Flow.anim(collapseHeader(true)); })
      .then(function () { return mascotJumpIn(P.stand); })
      .then(function () { Beats.bubbleArm(P.bubble); P.open = true; });
  }
  function tint(P, verdict) {
    P.bubble.classList.toggle('is-yes', verdict === 'yes');
    P.bubble.classList.toggle('is-no', verdict === 'no');
  }
  /* A line in the perch's bubble (the perch made, and the bird brought up,
     if they are not yet), shown a sentence at a time. `verdict` ('yes' |
     'no') tints the bubble for an answer's feedback; none puts it back. */
  function perchLine(text, mood, verdict) {
    var P = perch || (perch = perchBuild());
    var line = typeof text === 'string' ? keyed(text) : lineOf(text);
    var mine = ++speaking;
    var parts = sentencesOf(line.text);
    parts = parts ? parts.map(function (s) { return s.trim(); }) : [line.text];
    var fast = Flow.isFast();
    if (fast) { began(line.text); parts.forEach(function (s) { began(s); }); parts = parts.slice(-1); }
    var cues = fast ? null : cuesFor(line.text, line.vo);
    var up = P.open ? Promise.resolve() : perchOpen(P);
    return up.then(function () {
      if (mine !== speaking || perch !== P) return;
      tint(P, verdict);
      mascot.state(mood || 'talking');
      var t0 = performance.now();
      began(line.text);
      var heard = fast ? null : quiet(voiceOf(line));
      var w = 0;
      var typed = parts.reduce(function (chain, s, i) {
        var n = (s.match(/\S+\s*/g) || []).length;
        var at = cues ? cues.slice(w, w + n) : null;
        w += n;
        return chain.then(function () {
          if (mine !== speaking || perch !== P) return;
          var hold = !i ? null : Flow.wait(at ? t0 + at[0] - performance.now() : SENTENCE_HOLD);
          return Promise.resolve(hold).then(function () {
            if (mine !== speaking || perch !== P) return;
            var late = performance.now() - t0;
            began(s);
            var said = P.say(s, at ? { at: at.map(function (c) { return Math.max(0, c - late); }) } : undefined);
            if (!P.shown) { P.shown = true; quiet(Flow.anim(Beats.bubbleIn(P.bubble))); }
            return said;
          });
        });
      }, Promise.resolve());
      return Promise.all([typed, heard]);
    }).then(function () { if (mine === speaking) mascot.settle(); });
  }
  function perchVoice(key) {
    if (Flow.isFast() || !global.I18n) return Promise.resolve();
    var mine = speaking;
    mascot.state('talking');
    return quiet(voiceOver(key).then(function () { if (mine === speaking) mascot.settle(); }));
  }
  function perchUp() {
    var P = perch || (perch = perchBuild());
    return P.open ? Promise.resolve() : perchOpen(P);
  }
  /* The answers stand on one line (style.css): equal widths where they fit,
     their own widths where not, and a set too long even for that shrunk
     until it fits. */
  function perchChoices(labels) {
    var P = perch || (perch = perchBuild());
    P.answers.classList.remove('is-working', 'is-hearing');
    var btns = buildChoices(P.answers, labels);
    var row = P.answers.getBoundingClientRect();
    var cs = getComputedStyle(P.answers);
    var room = row.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
             - (parseFloat(cs.columnGap || cs.gap) || 0) * (btns.length - 1);
    var total = btns.reduce(function (sum, b) { return sum + b.getBoundingClientRect().width; }, 0);
    if (room > 0 && total > room) {
      var f = room / total;
      btns.forEach(function (b) { b.style.fontSize = (parseFloat(getComputedStyle(b).fontSize) * f) + 'px'; });
    }
    var w = 0, hh = 0;
    btns.forEach(function (b) {
      var r = b.getBoundingClientRect();
      w = Math.max(w, r.width); hh = Math.max(hh, r.height);
    });
    var same = w * btns.length <= room;
    btns.forEach(function (b) {
      if (same) b.style.minWidth = Math.ceil(w) + 'px';
      b.style.minHeight = Math.ceil(hh) + 'px';
    });
    return Flow.anim(Beats.optsIn(btns)).then(function () { return btns; });
  }
  function perchClear() {
    var P = perch;
    if (!P) return Promise.resolve();
    var kids = Array.prototype.slice.call(P.answers.children);
    var pills = kids.filter(function (k) { return k.classList.contains('choice'); });
    var rest = kids.filter(function (k) { return pills.indexOf(k) < 0; });
    return Promise.all([Flow.anim(Beats.optsOut(pills)), Flow.anim(Beats.cardOut(rest))]).then(function () {
      if (perch !== P) return;
      P.answers.textContent = '';
      P.answers.classList.remove('is-hearing');
    });
  }
  function perchRow() {
    var P = perch || (perch = perchBuild());
    P.answers.classList.add('is-working');
    return P.answers;
  }
  /* The perch's own box (made, not opened): for a section that lays its own
     controls out round the bird -- the practice's answer line under it and
     its number pad beside it (css/para.css). Anything put in it goes with
     the perch when the perch goes. */
  function perchRoot() {
    var P = perch || (perch = perchBuild());
    return P.root;
  }
  /* The circle game's press, on the perch's pills: a wrong pill is spent and
     answered before any is live again; once only the answer is left it is
     lit for the learner; the right one goes green and the rest step back. */
  var AUTO_AFTER = 500;
  function perchAsk(btns, right, o) {
    o = o || {};
    var P = perch;
    var answer = btns[right];
    var live = true, busy = false, tries = 0, auto = false;
    function hearing(on) { if (P) P.answers.classList.toggle('is-hearing', on); }
    function onPick(ev) {
      if (!live || busy) return;
      var btn = ev.currentTarget;
      if (btn.classList.contains('is-done')) return;
      ripple(ev, btn);
      tries++;
      if (btn === answer) {
        live = false;
        Beats.choiceRight(btn);
        dom.gate.dispatchEvent(new MouseEvent('click'));
        return;
      }
      btn.classList.add('is-done');
      busy = true;
      hearing(true);
      var left = btns.filter(function (b) { return !b.classList.contains('is-done'); });
      var last = left.length === 1 && left[0] === answer;
      quiet(Promise.all([
        Flow.anim(Beats.choiceWrong(btn)),
        o.onWrong ? o.onWrong(btns.indexOf(btn), tries) : null
      ]).then(function () {
        btn.classList.remove('is-wrong');
        if (!live) return;
        return Flow.anim(M.to(btn, { opacity: 0.55, duration: M.dur(0.3), ease: 'power2.inOut' }));
      }).then(function () {
        busy = false;
        hearing(false);
        if (!live || !last) return;
        live = false;
        auto = true;
        dom.gate.dispatchEvent(new MouseEvent('click'));
      }));
    }
    function off() {
      live = false;
      hearing(false);
      btns.forEach(function (b) {
        b.removeEventListener('click', onPick);
        b.classList.add('is-done');
      });
    }
    btns.forEach(function (b) { b.addEventListener('click', onPick); });
    return Flow.once(dom.gate, { auto: true }).then(
      function () {
        off();
        return (auto ? Flow.wait(AUTO_AFTER) : Promise.resolve()).then(function () {
          if (!answer.classList.contains('is-right')) {
            answer.classList.add('is-right');
            if (auto) quiet(Flow.anim(M.correct(answer)));
          }
          quiet(Flow.anim(M.focus(answer, btns, { opacity: 0.4 })));
          return { tries: tries, auto: auto };
        });
      },
      function (err) { off(); throw err; });
  }
  function perchRight(key, res) {
    if (!res || !res.auto) return perchLine(key, 'happy', 'yes');
    var text = keyed(key).text, praiseW = T('fbCorrect');
    if (text.indexOf(praiseW) === 0) text = text.slice(praiseW.length).trim();
    return perchLine('fbAutoRight', 'happy', 'yes').then(function () {
      if (!text) return null;
      var mine = speaking;
      return Flow.wait(SENTENCE_HOLD).then(function () {
        if (mine === speaking) return perchLine({ text: text, vo: null }, 'happy', 'yes');
      });
    });
  }
  function perchDown() {
    var P = perch;
    if (!P) return Promise.resolve();
    speaking++;
    var shut = P.bubble.hasAttribute('hidden') ? Promise.resolve() : Flow.anim(Beats.bubbleOut(P.bubble));
    var bird = mascot.el.parentNode === P.stand ? mascotJumpOut() : Promise.resolve();
    var rest = Flow.anim(Beats.cardOut(Array.prototype.slice.call(P.answers.children)));
    return Promise.all([shut, bird, rest]).then(function () { if (perch === P) perchReset(); });
  }
  function perchReset() {
    var P = perch;
    perch = null;
    if (!P) return;
    if (mascot.el.parentNode === P.stand) {
      mascot.el.classList.add('is-away');
      mascot.placeIn(dom.slotHero);
    }
    P.say.clear();
    if (P.root.parentNode) P.root.parentNode.removeChild(P.root);
  }
  function birdOnPerch() {
    return !!(perch && perch.open && mascot.el.parentNode === perch.stand);
  }

  /* ---- praise ------------------------------------------------------------- */
  var PRAISE = ['praiseWellDone', 'praiseExcellent', 'praiseAwesome', 'praiseFantastic', 'praisePerfect'];
  var praised = 0;
  function celebrate(host) {
    Beats.sfx('cheer');
    quiet(Flow.anim(Beats.confettiRain(host || dom.board)));
  }
  function praise(key) {
    celebrate();
    key = key || PRAISE[praised++ % PRAISE.length];
    return Flow.wait(Beats.ringing())
      .then(function () { return say(keyed(key), 'happy'); })
      .then(function () { mascot.settle(); });
  }
  /* A burst beside a right answer, in the figure's units. */
  function burstAt(x, y) {
    quiet(Flow.anim(Beats.confetti(dom.burst, x, y)));
  }

  /* ---- the bubble --------------------------------------------------------- */
  function restoreBubble() {
    sayBubble.clear();
    dom.bubble.setAttribute('hidden', '');
    M.set(dom.bubble, { clearProps: 'opacity,transform' });
  }

  /* ---- the header, taken away and given back ------------------------------ */
  function pictureAt(rect) {
    return { scale: Math.min(rect.width / VB_W, rect.height / VB_H), x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  var rowsMove = null;
  function collapseHeader(on, cls, pop) {
    if (dom.board.classList.contains(cls || 'is-headless') === !!on) {
      return rowsMove && rowsMove.progress() < 1 ? rowsMove : null;
    }
    return moveRows(function () { dom.board.classList.toggle(cls || 'is-headless', !!on); }, pop);
  }
  function openHeader() {
    if (!dom.board.classList.contains('is-headless') && !dom.board.classList.contains('is-bare')) return null;
    return moveRows(function () { dom.board.classList.remove('is-headless', 'is-bare'); });
  }
  function moveRows(change, pop) {
    var was = pictureAt(dom.figure.getBoundingClientRect());
    dom.board.style.transition = 'none';
    change();
    var now = pictureAt(dom.figure.getBoundingClientRect());
    dom.board.style.transition = '';
    if (!was.scale || !now.scale || M.reducedMotion()) return (rowsMove = null);
    var els = [dom.figure, dom.layer];
    M.set(els, { scale: was.scale / now.scale, x: was.x - now.x, y: was.y - now.y, transformOrigin: 'center center' });
    var tl = M.timeline({ willChange: els, willChangeValue: 'transform' });
    tl.to(els, pop
      ? { scale: 1, x: 0, y: 0, duration: M.dur(0.7), ease: 'back.out(1.6)' }
      : { scale: 1, x: 0, y: 0, duration: M.dur(0.66), ease: 'power2.inOut' });
    return (rowsMove = tl);
  }

  /* ---- a scene, over ------------------------------------------------------- */
  function wipeBoard() {
    if (global.W && global.W.handsOff) global.W.handsOff();
    var gone = perch ? perchDown() : mascotJumpOut();
    var shut = Flow.anim(Beats.bubbleOut(dom.bubble));
    var line = Flow.anim(Beats.lineOut(dom.promptLine));
    var figure = Flow.anim(Beats.clearFigure(figureParts().filter(function (g) { return !g.hasAttribute || !g.hasAttribute('hidden'); })));
    var footer = [];
    if (!dom.tray.hasAttribute('hidden')) footer.push(Flow.anim(Beats.trayOut(dom.tray, chips)));
    if (!dom.choices.hasAttribute('hidden')) footer.push(Flow.anim(Beats.trayOut(dom.choices, choiceBtns)));
    var extra = sections.reduce(function (all, s) { return s.wipe ? all.concat(s.wipe()) : all; }, []);
    return Promise.all([gone, shut, line, figure].concat(footer, extra)).then(function () {
      clearPrompt();
      restoreBubble();
      resetFigure();
      resetFooter();
    });
  }

  /* ======================================================================
   * Waiting on an answer
   * ====================================================================== */

  /* One of several buttons pressed: resolves with its index. Under Skip,
     `opts.answer`. */
  function askChoice(buttons, opts) {
    var o = opts || {};
    var picked = -1, live = true;
    function onPick(ev) {
      if (!live) return;
      live = false;
      picked = buttons.indexOf(ev.currentTarget);
      ripple(ev, ev.currentTarget);
      dom.gate.dispatchEvent(new MouseEvent('click'));
    }
    function off() {
      live = false;
      buttons.forEach(function (b) { b.removeEventListener('click', onPick); });
    }
    buttons.forEach(function (b) { b.addEventListener('click', onPick); });
    return Flow.once(dom.gate, { auto: true }).then(
      function () { off(); if (picked < 0) picked = (o.answer == null ? 0 : o.answer); return picked; },
      function (err) { off(); throw err; });
  }

  /* Asked until right: a wrong press is shaken, struck out and answered
     (`o.onWrong(i, tries)`, awaited while every pill waits), and the
     question stays open; the right one goes green and the rest are spent.
     o.shuffle re-orders the pills after each wrong press. Resolves
     { tries, auto }. */
  function askUntilRight(buttons, right, o) {
    o = o || {};
    var tries = 0;
    var host = buttons[0] && buttons[0].parentNode;
    function round() {
      var open = buttons.filter(function (b) { return !b.classList.contains('is-struck'); });
      return askChoice(open, { answer: open.indexOf(buttons[right]) }).then(function (i) {
        var btn = open[i];
        var auto = Flow.isFast() && btn === buttons[right] && tries === 0 && !btn.__pressed;
        tries++;
        if (btn === buttons[right]) {
          buttons.forEach(function (b) { b.classList.add('is-done'); });
          return Flow.anim(Beats.choiceRight(btn)).then(function () { return { tries: tries, auto: auto }; });
        }
        var shook = Flow.anim(Beats.choiceWrong(btn));
        buttons.forEach(function (b) { b.classList.add('is-done'); });
        var said = o.onWrong ? quiet(o.onWrong(buttons.indexOf(btn), tries)) : null;
        return Promise.all([shook, said]).then(function () {
          btn.classList.remove('is-wrong');
          if (!o.keep) btn.classList.add('is-struck');
          buttons.forEach(function (b) { b.classList.remove('is-done'); });
          if (o.shuffle && host) {
            var order = shuffle(buttons.slice());
            order.forEach(function (b) { host.appendChild(b); });
          }
          return Flow.wait(SHORT);
        }).then(round);
      });
    }
    return round();
  }

  /* ---- the figure held at its size while the answers take the footer -------
     Opening the footer row shrinks the stage, and with it the figure. With
     o.lift (figure units) the figure keeps the size it had and only rises a
     little: the row's change is measured, undone with a transform (in
     percent of the figure's box, so a resize keeps it true), and the rise
     eased in. Let go when the footer closes. */
  var held = false;
  function figureEls() { return [dom.figure, dom.layer]; }
  function holdFigure(lift, open) {
    var was = pictureAt(dom.figure.getBoundingClientRect());
    dom.board.style.transition = 'none';
    open();
    var box = dom.figure.getBoundingClientRect();
    var now = pictureAt(box);
    void dom.board.offsetHeight;
    dom.board.style.transition = '';
    if (!was.scale || !now.scale || !box.height) return null;
    held = true;
    var at = { scale: was.scale / now.scale, xPercent: (was.x - now.x) / box.width * 100,
               yPercent: (was.y - now.y) / box.height * 100, transformOrigin: 'center center' };
    var up = (was.y - now.y - lift * was.scale) / box.height * 100;
    M.set(figureEls(), at);
    var tl = M.timeline({ willChange: figureEls(), willChangeValue: 'transform' });
    tl.to(figureEls(), { yPercent: up, duration: M.dur(0.55), ease: 'power2.out' });
    return tl;
  }
  function releaseFigure(close) {
    if (!held) { close(); return null; }
    held = false;
    var was = pictureAt(dom.figure.getBoundingClientRect());
    dom.board.style.transition = 'none';
    close();
    M.set(figureEls(), { clearProps: 'transform' });
    var box = dom.figure.getBoundingClientRect();
    var now = pictureAt(box);
    void dom.board.offsetHeight;
    dom.board.style.transition = '';
    if (!was.scale || !now.scale || !box.height) return null;
    M.set(figureEls(), { scale: was.scale / now.scale, xPercent: (was.x - now.x) / box.width * 100,
                         yPercent: (was.y - now.y) / box.height * 100, transformOrigin: 'center center' });
    var tl = M.timeline({ willChange: figureEls(), willChangeValue: 'transform' });
    tl.to(figureEls(), { scale: 1, xPercent: 0, yPercent: 0, duration: M.dur(0.5), ease: 'power2.inOut' });
    return tl;
  }
  function letGoFigure() {
    if (!held) return;
    held = false;
    M.set(figureEls(), { clearProps: 'transform' });
  }

  /* The choices arrive in the footer and leave it again. o.lift: the figure
     keeps its size and rises this many figure units (see holdFigure). */
  function offerChoices(labels, o) {
    o = o || {};
    choiceBtns = buildChoices(dom.choices, labels);
    var rise = null;
    if (o.lift != null && !held) {
      M.set(choiceBtns, { opacity: 0 });
      rise = holdFigure(o.lift, function () { dom.choices.removeAttribute('hidden'); });
    }
    return Promise.all([Flow.anim(Beats.trayIn(dom.choices, choiceBtns)), Flow.anim(rise)])
      .then(function () { return choiceBtns; });
  }
  function clearChoices() {
    return Flow.anim(Beats.trayOut(dom.choices, choiceBtns)).then(function () {
      choiceBtns = [];
      return Flow.anim(releaseFigure(function () {
        dom.choices.setAttribute('hidden', '');
        dom.choices.textContent = '';
      }));
    });
  }
  /* The answers make way for one line of plain text in their place (the
     footer, and a held figure, stay as they are). The line is what the
     next clearChoices takes away. */
  function choicesToLine(text) {
    return Flow.anim(Beats.trayOut(dom.choices, choiceBtns)).then(function () {
      dom.choices.textContent = '';
      dom.choices.removeAttribute('hidden');
      var line = document.createElement('p');
      line.className = 'choice-line';
      global.MathText.write(line, text);
      dom.choices.appendChild(line);
      choiceBtns = [line];
      return Flow.anim(Beats.ruleIn(line)).then(function () { return line; });
    });
  }

  /* ---- one of several marks on the figure, tapped ----------------------------
     The circle game's press, on SVG targets: a wrong one turns soft amber
     and shakes its head, the reason is said (o.onWrong(i, tries), awaited,
     with every target waiting), and the learner tries again; the right one
     goes green with one outward pulse. The caller makes the group live.
     o.answer: the index (or element) that is right; o.origin(i): the
     figure point the pulse grows about. Resolves { tries, auto }; a skip
     answers it with the right one marked. */
  function tapOn(targets, o) {
    o = o || {};
    var answer = typeof o.answer === 'number' ? targets[o.answer] : o.answer;
    var live = true, busy = false, tries = 0, auto = false, picked = false;
    function onPick(ev) {
      if (!live || busy) return;
      var t = ev.currentTarget, i = targets.indexOf(t);
      if (t.classList.contains('is-done')) return;
      if (ev.clientX != null) ripple(ev, t);
      tries++;
      var shown = o.mark ? (o.mark(i) || t) : t;
      if (t === answer) {
        live = false; picked = true;
        Beats.markRight(shown, o.origin ? o.origin(i) : null);
        if (o.onRight) o.onRight(i);
        dom.gate.dispatchEvent(new MouseEvent('click'));
        return;
      }
      busy = true;
      if (o.spend) t.classList.add('is-done');
      var said = o.onWrong ? quiet(o.onWrong(i, tries)) : null;
      quiet(Promise.all([Flow.anim(Beats.markWrong(shown)), said]).then(
        function () { shown.classList.remove('is-wrong'); busy = false; },
        function () { shown.classList.remove('is-wrong'); busy = false; }));
    }
    function onKey(ev) {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      ev.preventDefault();
      onPick({ currentTarget: ev.currentTarget });
    }
    targets.forEach(function (t) {
      t.addEventListener('click', onPick);
      t.addEventListener('keydown', onKey);
      t.setAttribute('tabindex', '0');
    });
    function off() {
      live = false;
      targets.forEach(function (t) {
        t.removeEventListener('click', onPick);
        t.removeEventListener('keydown', onKey);
        t.setAttribute('tabindex', '-1');
        t.classList.add('is-done');
      });
    }
    return Flow.once(dom.gate, { auto: true }).then(
      function () {
        if (!picked) {
          auto = true;
          var ai = targets.indexOf(answer);
          var el = o.mark ? (o.mark(ai) || answer) : answer;
          el.classList.remove('is-wrong');
          el.classList.add('is-right');
          if (o.onRight) o.onRight(ai);
        }
        off();
        return { tries: tries, auto: auto };
      },
      function (err) { off(); throw err; });
  }

  /* ======================================================================
   * Scene 0 -- welcome
   * ====================================================================== */
  function sceneWelcome() {
    mascot.placeIn(dom.slotHero);
    mascot.state('waving');
    if (global.WelcomeFX) global.WelcomeFX.start();
    return Flow.wait(SHORT)
      .then(function () { return Flow.anim(global.Loader ? global.Loader.ready() : null); })
      .then(function () {
        centreHero([keyed('p01Hey'), keyed('p02Warm')]);
        dom.startBtn.removeAttribute('hidden');
        return Flow.frame();
      })
      .then(function () {
        dom.startBtn.classList.add('in');
        M.button3d(dom.startBtn, { edge: 5 });
        return Flow.once(dom.startBtn, { auto: true });
      })
      .then(function () {
        Beats.sfx('click');
        mascot.settle();
        return Flow.anim(Beats.welcomeOut(dom.welcome, dom.title, dom.startBtn));
      })
      .then(function () {
        if (global.WelcomeFX) global.WelcomeFX.stop();
        return Flow.wait(SHORT);
      })
      .then(function () {
        mascot.state('talking');
        Beats.bubbleArm(dom.bubble);
        var hello = keyed('p01Hey');
        var heard = quiet(voiceOf(hello));
        var said = sayBubble(hello);
        Beats.bubbleIn(dom.bubble);
        return Promise.all([said, heard]);
      })
      .then(function () { return Flow.wait(BEAT); })
      .then(function () {
        var warm = keyed('p02Warm');
        var heard = quiet(voiceOf(warm));
        return Promise.all([sayBubble(warm), heard]);
      })
      .then(function () { mascot.settle(); return Flow.wait(SHORT); })
      .then(function () { return handOver(dom.nextBtn); });
  }

  /* ---- the bird centre stage ----------------------------------------------
     The bird and its bubble read as ONE group, centred on the frame, on the
     widest line it will say. */
  var BIRD_INSET = 0.13;
  function centreHero(lines) {
    var slot = dom.slotHero;
    var fw = dom.frame.getBoundingClientRect().width;
    var sw = slot.offsetWidth;
    if (!fw || !sw) return;
    var probe = dom.bubble.cloneNode(true);
    probe.removeAttribute('id');
    probe.removeAttribute('hidden');
    probe.removeAttribute('style');
    probe.setAttribute('aria-hidden', 'true');
    Array.prototype.forEach.call(probe.querySelectorAll('[id]'), function (n) { n.removeAttribute('id'); });
    var ghost = probe.querySelector('.type-ghost');
    var txt = probe.querySelector('.type .txt');
    if (txt) txt.textContent = '';
    probe.style.visibility = 'hidden';
    slot.appendChild(probe);
    var widest = 0, offL = 0;
    lines.forEach(function (line) {
      if (ghost) ghost.textContent = plain(line.text);
      widest = Math.max(widest, probe.offsetWidth);
      offL = probe.offsetLeft;
    });
    slot.removeChild(probe);
    var mid = (BIRD_INSET * sw + offL + widest) / 2;
    slot.style.left = ((fw / 2 - mid + sw / 2) / fw * 100) + '%';
  }

  /* An interlude between sections, as at the welcome: the bird says its
     lines centre stage, hands over to Continue, and the board opens again. */
  function interlude(keys) {
    return centreStage(keys)
      .then(function () { mascot.settle(); return Flow.wait(SHORT); })
      .then(function () { return handOver(); })
      .then(openBoard);
  }
  function centreStage(keys) {
    var e = mascot.el;
    var lines = keys.map(function (k) { return keyed(k); });
    return wipeBoard()
      .then(function () {
        mascot.placeIn(dom.slotHero);
        centreHero(lines);
        M.set(e, { clearProps: 'transform' });
        e.hidden = false;
        e.classList.remove('is-away');
        mascot.idle();
        if (!dom.board.classList.contains('show')) return null;
        return Flow.anim(Beats.boardOut(dom.board));
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        return lines.reduce(function (chain, line, i) {
          return chain
            .then(function () { return i ? Flow.wait(BEAT) : null; })
            .then(function () {
              mascot.state('talking');
              if (!i) Beats.bubbleArm(dom.bubble);
              var heard = quiet(voiceOf(line));
              var said = sayBubble(line);
              if (!i) Beats.bubbleIn(dom.bubble);
              return Promise.all([said, heard]);
            });
        }, Promise.resolve());
      });
  }
  function openBoard() {
    if (dom.board.classList.contains('show')) return Promise.resolve();
    var e = mascot.el;
    var bird = e.parentNode === dom.slotHero && !e.hidden && !e.classList.contains('is-away')
      ? Flow.anim(Beats.heroOut(e)) : Promise.resolve();
    return Promise.all([Flow.anim(Beats.bubbleOut(dom.bubble)), bird])
      .then(function () { sayBubble.clear(); return Flow.anim(Beats.boardIn(dom.board)); })
      .then(function () { return Flow.wait(SHORT); });
  }

  /* ======================================================================
   * The lesson's scenes and the sections that bring them
   * ====================================================================== */
  var SCENES = [{ name: 'Welcome', play: sceneWelcome }];
  var sections = [];

  function addSection(spec) {
    if (!spec || !spec.scenes) return;
    spec.first = SCENES.length;
    spec.count = spec.scenes.length;
    sections.push(spec);
    spec.scenes.forEach(function (sc) { SCENES.push(sc); });
    if (dom && spec.build) spec.build(kit);
  }
  function sectionOf(index) {
    for (var i = sections.length - 1; i >= 0; i--) if (sections[i].count && index >= sections[i].first) return sections[i];
    return null;
  }
  /* The scene a section's scene lives at, by the section's name. */
  function sceneIndex(name) {
    for (var i = 0; i < SCENES.length; i++) if (SCENES[i].name === name) return i;
    return -1;
  }

  var at = 0, page = 0, seen = [], seek = 0, seekIn = -1, watchers = [];
  function note(scene, p) { if (!(seen[scene] > p + 1)) seen[scene] = p + 1; }
  function turned() { page++; announce(); }
  function announce() {
    var where = { scene: at, scenes: SCENES.length, name: SCENES[at].name, page: page, pages: seen.slice() };
    watchers.forEach(function (fn) { try { fn(where); } catch (e) {} });
  }
  function play(from) {
    var chain = Promise.resolve();
    for (var i = from || 0; i < SCENES.length; i++) chain = chain.then(enter(i));
    return chain;
  }
  function enter(i) {
    return function () {
      at = i; page = 0;
      note(i, 0);
      if (seek && i !== seekIn) { seek = 0; Flow.resume(); }
      announce();
      return SCENES[i].play();
    };
  }

  function rewind() {
    if (global.W && global.W.handsOff) global.W.handsOff();
    if (sayBubble) sayBubble.clear();
    if (sayPrompt) sayPrompt.clear();
    speaking++;
    awaiting = [];
    begun = { text: null, at: 0 };
    if (global.I18n) global.I18n.stop();
    perchReset();
    mascot.el.hidden = false;
    mascot.el.classList.remove('is-away');
    mascot.idle();
    rowsMove = null;
    dom.welcome.removeAttribute('hidden');
    dom.startBtn.setAttribute('hidden', '');
    dom.startBtn.classList.remove('in');
    dom.nextBtn.setAttribute('hidden', '');
    dom.endActions.setAttribute('hidden', '');
    dom.bubble.setAttribute('hidden', '');
    dom.bubble.classList.remove('bubble--wrap');
    dom.board.classList.remove('show', 'is-animating', 'is-headless', 'is-bare', 'is-ending');
    dom.board.setAttribute('aria-hidden', 'true');
    restoreBubble();
    resetFigure();
    resetFooter();
    M.set([dom.welcome, dom.title, dom.startBtn, dom.nextBtn, dom.replayBtn, dom.bubble,
           dom.board, dom.promptLine, dom.slotHeader, dom.figure, dom.layer, mascot.el],
          { clearProps: 'opacity,transform,filter' });
  }

  /* The board as the scene at `index` expects to FIND it, written in. */
  function stageFor(index) {
    if (index <= 0) return;
    if (global.WelcomeFX) global.WelcomeFX.stop();
    dom.welcome.setAttribute('hidden', '');
    mascot.placeIn(dom.slotHero);
    mascot.idle();
    if (index === 1) return;                 /* the first section opens the board itself */
    dom.board.classList.add('show');
    dom.board.setAttribute('aria-hidden', 'false');
    mascot.el.classList.add('is-away');
    var s = sectionOf(index);
    if (s && s.stage) s.stage(index - s.first);
  }

  function init() {
    if (dom) return { dom: dom, mascot: mascot };
    dom = collect();
    mascot = global.Mascot.create({ slot: dom.slotHero });
    sayBubble = onVoice(global.Typer.create($('bubbleType'), { box: dom.bubble }));
    sayPrompt = onVoice(global.Typer.create($('promptType')));
    sections.forEach(function (s) { if (s.build) s.build(kit); });
    return { dom: dom, mascot: mascot };
  }

  var started = false;
  function runFrom(index, wanted) {
    if (!dom) init();
    started = true;
    index = Math.max(0, Math.min(SCENES.length - 1, index | 0));
    seek = Math.max(0, wanted | 0);
    seekIn = index;
    Flow.reset();
    dom.board.style.transition = 'none';
    rewind();
    stageFor(index);
    void dom.board.offsetHeight;
    dom.board.style.transition = '';
    return Flow.run(function () {
      if (seek > 0) Flow.skip();
      return play(index);
    });
  }
  function run() { return runFrom(0, 0); }

  /* ---- what a section needs ------------------------------------------------- */
  var kit = {
    BEAT: BEAT, SHORT: SHORT, LOOK: LOOK, AUTO_TURN: AUTO_TURN, NUDGE_AFTER: NUDGE_AFTER, VB_W: VB_W, VB_H: VB_H,
    dom: function () { return dom; },
    mascot: function () { return mascot; },
    round2: round2,
    buildChips: buildChips, buildChoices: buildChoices, shuffle: shuffle,
    chips: function (list) { if (list) chips = list; return chips; },
    choices: function (list) { if (list) choiceBtns = list; return choiceBtns; },
    offerChoices: offerChoices, clearChoices: clearChoices, choicesToLine: choicesToLine,
    handOver: handOver, autoTurn: autoTurn,
    openBoard: openBoard, wipeBoard: wipeBoard, interlude: interlude, centreStage: centreStage,
    collapseHeader: collapseHeader, openHeader: openHeader,
    say: say, speak: speakLine, speakBySentence: speakBySentence,
    keyed: keyed, hear: hear, voiceOver: voiceOver, birdVoice: birdVoice, typedFor: typedFor,
    onWord: onWord, onPhrase: onPhrase,
    birdAway: birdAway, lineAway: lineAway, clearPrompt: clearPrompt, birdOnHeader: birdOnHeader, birdOnPerch: birdOnPerch,
    mascotJumpIn: mascotJumpIn, mascotJumpOut: mascotJumpOut,
    celebrate: celebrate, praise: praise, burstAt: burstAt,
    askChoice: askChoice, askUntilRight: askUntilRight, tapOn: tapOn,
    perchSay: perchLine, perchVoice: perchVoice, perchChoices: perchChoices,
    perchClear: perchClear, perchDown: perchDown, perchUp: perchUp, perchRow: perchRow, perchRoot: perchRoot,
    perchAsk: perchAsk, perchRight: perchRight,
    sceneIndex: sceneIndex, runFrom: function (i, p) { return runFrom(i, p); },
    dragGuide: function (to) { return W.dragGuide(dom.tray, to); },
    ripple: ripple, quiet: quiet, clearInline: clearInline
  };

  global.Pages = {
    init: init,
    addSection: addSection,
    kit: kit,
    run: run,
    runFrom: runFrom,
    rewind: rewind,
    started: function () { return started; },
    levels: function () { return SCENES.map(function (s) { return s.name; }); },
    skills: function () { return [{ first: 0, name: 'Area of a parallelogram', n: 1 }]; },
    level: function () { return at; },
    page: function () { return page; },
    pages: function () { return seen.slice(); },
    onLevel: function (fn) {
      if (typeof fn !== 'function') return;
      watchers.push(fn);
      fn({ scene: at, scenes: SCENES.length, name: SCENES[at].name, page: page, pages: seen.slice() });
    },
    mascot: function () { return mascot; },
    dom: function () { return dom; }
  };
})(window);
