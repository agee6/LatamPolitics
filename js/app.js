/* Wiring: resolve leaders by date, paint the map, run playback, render the
 * roster, legend, balance chart and hover tooltip. */
(function () {
  'use strict';

  var DATA = window.LEADERS;
  var GEO = window.SA_GEO;

  var IDE = {};                                   // id -> ideology record
  DATA.ideologies.forEach(function (i) { IDE[i.id] = i; });

  var COUNTRIES = {};                             // code -> country record
  DATA.countries.forEach(function (c) {
    c.isTerritory = c.leaders.every(function (l) { return l.ideology === 'none'; });
    COUNTRIES[c.code] = c;
  });

  var SOVEREIGN = DATA.countries.filter(function (c) { return !c.isTerritory; });
  var ROSTER = SOVEREIGN.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });

  var MAX = Months.maxIndex();
  var N = MAX + 1;

  /* ------------------------------------------------------------- resolving */

  function leaderOn(country, iso) {
    var ls = country.leaders;
    for (var i = 0; i < ls.length; i++) {
      if (ls[i].start <= iso && (ls[i].end === null || ls[i].end > iso)) return ls[i];
    }
    return null;
  }

  // Precompute per-month lookups once; 682 months x 14 countries is trivial
  // and makes scrubbing and playback allocation-free.
  var FRAMES = [];
  var SERIES = [];
  for (var m = 0; m < N; m++) {
    var iso = Months.iso(m);
    var frame = {}, counts = {};
    DATA.countries.forEach(function (c) {
      var l = leaderOn(c, iso);
      frame[c.code] = l;
      if (l && !c.isTerritory) counts[l.ideology] = (counts[l.ideology] || 0) + 1;
    });
    FRAMES.push(frame);
    SERIES.push(counts);
  }

  /* --------------------------------------------------------------- helpers */

  function termText(l) {
    var from = l.start.slice(0, 4);
    var to = l.end === null ? 'present' : l.end.slice(0, 4);
    return from === to ? 'In power: ' + from : 'In power: ' + from + ' – ' + to;
  }

  function monthYear(isoDate) {
    var parts = isoDate.split('-');
    return Months.label((parseInt(parts[0], 10) - 1970) * 12 + parseInt(parts[1], 10) - 1);
  }

  /* --------------------------------------------------------------- tooltip */

  var tip = document.getElementById('tooltip');
  var tipParts = {
    stripe: tip.querySelector('.tt-stripe'),
    flag: tip.querySelector('.tt-flag'),
    country: tip.querySelector('.tt-country-name'),
    leader: tip.querySelector('.tt-leader'),
    chip: tip.querySelector('.tt-chip'),
    party: tip.querySelector('.tt-party-name'),
    partyEn: tip.querySelector('.tt-party-en'),
    term: tip.querySelector('.tt-term'),
    tags: tip.querySelector('.tt-tags'),
    note: tip.querySelector('.tt-note')
  };

  function showTip(code) {
    var c = COUNTRIES[code];
    var l = FRAMES[state.index][code];
    if (!c) return;

    var ide = l ? IDE[l.ideology] : null;
    tipParts.stripe.style.background = ide ? ide.color : '#30363d';
    tipParts.flag.textContent = c.flag;
    tipParts.country.textContent = c.name;

    if (!l) {
      tipParts.leader.textContent = 'No recorded government';
      tipParts.chip.style.display = 'none';
      tipParts.party.textContent = '';
      tipParts.partyEn.textContent = '';
      tipParts.term.textContent = monthYear(Months.iso(state.index));
      tipParts.tags.innerHTML = '';
      tipParts.note.textContent = '';
    } else {
      tipParts.leader.textContent = l.name;
      tipParts.chip.style.display = '';
      tipParts.chip.textContent = l.partyShort;
      tipParts.chip.style.background = ide.color;
      tipParts.party.textContent = l.party;
      tipParts.partyEn.textContent = l.partyEn && l.partyEn !== l.party ? l.partyEn : '';
      tipParts.term.textContent = l.ideology === 'none'
        ? 'Status since ' + l.start.slice(0, 4)
        : termText(l);

      tipParts.tags.innerHTML = '';
      if (l.ideology !== 'none') {
        var t = document.createElement('span');
        t.className = 'tt-tag';
        t.textContent = ide.label;
        t.style.borderColor = LatamMap.shade(ide.color, 0.35);
        t.style.color = ide.color;
        tipParts.tags.appendChild(t);
      }
      if (l.unelected) {
        var u = document.createElement('span');
        u.className = 'tt-tag unelected';
        u.textContent = 'Unelected';
        tipParts.tags.appendChild(u);
      }
      tipParts.note.textContent = l.note || '';
    }

    tip.classList.add('visible');
  }

  function moveTip(ev) {
    var pad = 14;
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var x = ev.clientX + pad, y = ev.clientY + pad;
    if (x + w > window.innerWidth - 8) x = ev.clientX - w - pad;
    if (y + h > window.innerHeight - 8) y = Math.max(8, ev.clientY - h - pad);
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }

  function hideTip() { tip.classList.remove('visible'); }

  /* ------------------------------------------------------------------- map */

  var state = { index: MAX, playing: false, hovered: null };

  var map = new LatamMap(document.getElementById('map'), GEO, DATA.ideologies, {
    width: 900,
    onHover: function (code, ev) {
      state.hovered = code;
      map.highlight(code);
      syncRosterHover(code);
      showTip(code);
      moveTip(ev);
    },
    onMove: function (code, ev) { moveTip(ev); },
    onLeave: function () { clearHover(); }
  });

  /* The single place hover state is torn down, so every exit route agrees. */
  function clearHover() {
    state.hovered = null;
    map.clearHover();
    map.highlight(null);
    syncRosterHover(null);
    hideTip();
  }

  /* ---------------------------------------------------------------- legend */

  var legendBox = document.getElementById('legend');
  var legendCounts = {};
  DATA.ideologies.forEach(function (ide) {
    if (ide.id === 'none') return;
    var row = document.createElement('div');
    row.className = 'legend-row';
    row.title = ide.desc;

    var sw = document.createElement('span');
    sw.className = 'legend-sw';
    sw.style.background = ide.color;

    var label = document.createElement('span');
    label.textContent = ide.label;

    var count = document.createElement('span');
    count.className = 'legend-count';

    row.appendChild(sw); row.appendChild(label); row.appendChild(count);
    legendBox.appendChild(row);
    legendCounts[ide.id] = count;
  });

  /* ---------------------------------------------------------------- roster */

  var rosterBox = document.getElementById('roster');
  var rosterRows = {};
  ROSTER.forEach(function (c) {
    var item = document.createElement('div');
    item.className = 'roster-item';

    var dot = document.createElement('span');
    dot.className = 'roster-dot';

    var text = document.createElement('span');
    text.className = 'roster-text';
    var cn = document.createElement('div');
    cn.className = 'roster-country';
    cn.textContent = c.flag + '  ' + c.name;
    var ln = document.createElement('div');
    ln.className = 'roster-leader';
    text.appendChild(cn); text.appendChild(ln);

    item.appendChild(dot); item.appendChild(text);

    item.addEventListener('mouseenter', function (e) {
      state.hovered = c.code;
      map.highlight(c.code);
      syncRosterHover(c.code);
      showTip(c.code);
      moveTip(e);
    });
    item.addEventListener('mousemove', moveTip);
    item.addEventListener('mouseleave', clearHover);

    rosterBox.appendChild(item);
    rosterRows[c.code] = { dot: dot, leader: ln, item: item };
  });

  function syncRosterHover(code) {
    for (var k in rosterRows) rosterRows[k].item.classList.toggle('is-hovered', k === code);
  }

  /* ----------------------------------------------------------- balance bar */

  var chart = new BalanceChart(document.getElementById('balance'),
    DATA.ideologies, SERIES, SOVEREIGN.length);

  var decadeBox = document.getElementById('decades');
  for (var y = 1970; y <= Months.year(MAX); y += 10) {
    var s = document.createElement('span');
    s.textContent = y;
    s.style.position = 'absolute';
    s.style.left = (Months.fromYear(y) / N * 100) + '%';
    s.style.transform = y === 1970 ? 'none' : 'translateX(-50%)';
    s.style.font = '9.5px ui-monospace, monospace';
    s.style.color = '#6b7682';
    s.style.letterSpacing = '0.06em';
    decadeBox.appendChild(s);
  }

  /* --------------------------------------------------------------- render */

  var scrub = document.getElementById('scrub');
  var readout = document.getElementById('readout');
  var stampMonth = document.getElementById('stamp-month');
  var stampYear = document.getElementById('stamp-year');

  scrub.min = 0;
  scrub.max = MAX;
  scrub.step = 1;

  var paintState = {};

  function render() {
    var i = state.index;
    var frame = FRAMES[i];

    for (var code in frame) {
      var l = frame[code];
      var c = COUNTRIES[code];
      if (!l) { paintState[code] = null; continue; }
      paintState[code] = {
        color: IDE[l.ideology].color,
        ideology: l.ideology,
        unelected: !!l.unelected,
        title: c.name + ' — ' + l.name + ' (' + IDE[l.ideology].label + ')'
      };
    }
    map.paint(paintState);

    var counts = SERIES[i];
    for (var id in legendCounts) legendCounts[id].textContent = counts[id] || '·';

    ROSTER.forEach(function (c) {
      var l = frame[c.code];
      var row = rosterRows[c.code];
      row.dot.style.background = l ? IDE[l.ideology].color : '#30363d';
      row.dot.classList.toggle('unelected', !!(l && l.unelected));
      row.leader.textContent = l ? l.name : '—';
      row.item.title = l ? l.name + ' — ' + l.party : '';
    });

    chart.setIndex(i);
    if (scrub.value !== String(i)) scrub.value = i;

    readout.textContent = Months.shortLabel(i);
    stampMonth.textContent = Months.label(i).split(' ')[0];
    stampYear.textContent = Months.year(i);

    if (state.hovered) showTip(state.hovered);
  }

  function setIndex(i, stopPlayback) {
    state.index = Math.max(0, Math.min(MAX, i | 0));
    if (stopPlayback) pause();
    render();
  }

  /* -------------------------------------------------------------- playback */

  var playBtn = document.getElementById('play');
  var speedSel = document.getElementById('speed');
  var loopBox = document.getElementById('loop');
  var raf = null, lastT = 0, acc = 0;

  function tick(t) {
    if (!state.playing) return;
    if (!lastT) lastT = t;
    var dt = (t - lastT) / 1000;
    lastT = t;
    acc += dt * parseFloat(speedSel.value);

    if (acc >= 1) {
      var steps = Math.floor(acc);
      acc -= steps;
      var next = state.index + steps;
      if (next > MAX) {
        if (loopBox.checked) next = 0;
        else { setIndex(MAX); pause(); return; }
      }
      state.index = next;
      render();
    }
    raf = requestAnimationFrame(tick);
  }

  function play() {
    if (state.playing) return;
    if (state.index >= MAX) state.index = 0;
    state.playing = true;
    lastT = 0; acc = 0;
    playBtn.innerHTML = '<span class="glyph">&#9208;</span> Pause';
    playBtn.setAttribute('aria-pressed', 'true');
    raf = requestAnimationFrame(tick);
  }

  function pause() {
    if (!state.playing) return;
    state.playing = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    playBtn.innerHTML = '<span class="glyph">&#9654;</span> Play';
    playBtn.setAttribute('aria-pressed', 'false');
  }

  function toggle() { state.playing ? pause() : play(); }

  playBtn.addEventListener('click', toggle);
  document.getElementById('step-back').addEventListener('click', function () { setIndex(state.index - 1, true); });
  document.getElementById('step-fwd').addEventListener('click', function () { setIndex(state.index + 1, true); });
  document.getElementById('reset').addEventListener('click', function () { setIndex(0, true); });
  document.getElementById('today').addEventListener('click', function () { setIndex(MAX, true); });

  scrub.addEventListener('input', function () { setIndex(parseInt(scrub.value, 10), true); });

  /* Drag-scrub on the balance chart. */
  var chartSvg = document.getElementById('balance');
  var dragging = false;
  chartSvg.addEventListener('pointerdown', function (e) {
    dragging = true;
    chartSvg.setPointerCapture(e.pointerId);
    setIndex(chart.indexAt(e.clientX), true);
  });
  chartSvg.addEventListener('pointermove', function (e) {
    if (dragging) setIndex(chart.indexAt(e.clientX), true);
  });
  chartSvg.addEventListener('pointerup', function () { dragging = false; });
  chartSvg.addEventListener('pointercancel', function () { dragging = false; });

  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') {
      if (e.key !== ' ') return;
    }
    if (e.key === ' ') { e.preventDefault(); toggle(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); setIndex(state.index - (e.shiftKey ? 12 : 1), true); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); setIndex(state.index + (e.shiftKey ? 12 : 1), true); }
    else if (e.key === 'Home') { e.preventDefault(); setIndex(0, true); }
    else if (e.key === 'End') { e.preventDefault(); setIndex(MAX, true); }
  });

  /* On touch, a tap elsewhere dismisses the tooltip (there is no mouseleave). */
  document.addEventListener('touchstart', function (e) {
    if (!e.target.closest || (!e.target.closest('.country') && !e.target.closest('.roster-item'))) {
      clearHover();
    }
  }, { passive: true });

  /* Safety nets. The tooltip is position:fixed, so it would otherwise float
   * over the page after a scroll, a tab switch, or a pointer that left the
   * window without the map ever seeing a mouseleave. */
  document.addEventListener('mouseleave', clearHover);
  window.addEventListener('blur', clearHover);
  window.addEventListener('scroll', clearHover, { passive: true });
  document.addEventListener('mousemove', function (e) {
    // Anything that is neither the map nor a roster row means "not hovering".
    if (!state.hovered || !e.target.closest) return;
    if (!e.target.closest('#map') && !e.target.closest('.roster-item')) clearHover();
  });

  /* Start at the present day, paused. */
  render();

  // Expose a little for console poking.
  window.LP = { state: state, setIndex: setIndex, FRAMES: FRAMES, DATA: DATA };
})();
