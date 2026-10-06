/* Map rendering: equirectangular-Mercator projection, SVG path building,
 * hatch patterns for unelected governments, and fill painting.
 *
 * No dependencies — the projection and path serialisation are a few dozen
 * lines, which is cheaper than shipping a copy of d3 just for geoMercator.
 */
(function (global) {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function el(name, attrs) {
    var n = document.createElementNS(SVG_NS, name);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  /* Spherical Mercator y, returned in degree-equivalent units so it shares a
   * scale with longitude. Clamped so the poles don't blow up to infinity. */
  var DEG = 180 / Math.PI;
  function mercY(lat) {
    var phi = Math.max(-85, Math.min(85, lat)) * Math.PI / 180;
    return Math.log(Math.tan(Math.PI / 4 + phi / 2)) * DEG;
  }

  function eachRing(geom, fn) {
    var polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
    for (var i = 0; i < polys.length; i++) {
      for (var j = 0; j < polys[i].length; j++) fn(polys[i][j]);
    }
  }

  /* Darken a #rrggbb colour toward black by `amt` (0..1). */
  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    function f(v) { return Math.round(v * (1 - amt)); }
    return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
  }

  function LatamMap(svg, geo, ideologies, opts) {
    opts = opts || {};
    this.svg = svg;
    this.geo = geo;
    this.paths = {};          // country code -> <path>
    this.onHover = opts.onHover || function () {};
    this.onLeave = opts.onLeave || function () {};
    this.onMove = opts.onMove || function () {};

    this._project(opts.width || 900, opts.pad || 14);
    this._defs(ideologies);
    this._draw();
  }

  /* Fit the whole feature collection into a viewBox of the given width. */
  LatamMap.prototype._project = function (width, pad) {
    var minLon = Infinity, maxLon = -Infinity, minY = Infinity, maxY = -Infinity;
    this.geo.features.forEach(function (f) {
      eachRing(f.geometry, function (ring) {
        for (var i = 0; i < ring.length; i++) {
          var lon = ring[i][0], y = mercY(ring[i][1]);
          if (lon < minLon) minLon = lon;
          if (lon > maxLon) maxLon = lon;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      });
    });

    var lonSpan = maxLon - minLon, ySpan = maxY - minY;
    var inner = width - pad * 2;
    var k = inner / lonSpan;                       // user units per degree lon
    var height = ySpan * k + pad * 2;

    this.width = width;
    this.height = height;
    this._k = k;
    this._minLon = minLon;
    this._maxY = maxY;
    this._pad = pad;

    this.svg.setAttribute('viewBox', '0 0 ' + width + ' ' + Math.round(height));
    this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  };

  LatamMap.prototype._pt = function (lon, lat) {
    return [
      this._pad + (lon - this._minLon) * this._k,
      this._pad + (this._maxY - mercY(lat)) * this._k
    ];
  };

  /* One hatch pattern per ideology, used for unelected governments. */
  LatamMap.prototype._defs = function (ideologies) {
    var defs = el('defs');
    this.hatchFor = {};
    var step = Math.max(5, Math.round(this.width / 150));

    ideologies.forEach(function (ide) {
      var id = 'hatch-' + ide.id;
      var p = el('pattern', {
        id: id, width: step, height: step,
        patternUnits: 'userSpaceOnUse',
        patternTransform: 'rotate(45)'
      });
      p.appendChild(el('rect', { width: step, height: step, fill: ide.color }));
      p.appendChild(el('rect', {
        width: Math.max(1.6, step * 0.34), height: step,
        fill: shade(ide.color, 0.46)
      }));
      defs.appendChild(p);
      this.hatchFor[ide.id] = 'url(#' + id + ')';
    }, this);

    this.svg.appendChild(defs);
  };

  LatamMap.prototype._drawGraticule = function (g) {
    var lon, lat;
    for (lon = -80; lon <= -30; lon += 10) {
      var a = this._pt(lon, 15), b = this._pt(lon, -58);
      g.appendChild(el('line', { class: 'graticule', x1: a[0], y1: a[1], x2: b[0], y2: b[1] }));
    }
    for (lat = -50; lat <= 10; lat += 10) {
      var c = this._pt(-84, lat), d = this._pt(-32, lat);
      g.appendChild(el('line', { class: 'graticule', x1: c[0], y1: c[1], x2: d[0], y2: d[1] }));
    }
  };

  LatamMap.prototype._draw = function () {
    var self = this;
    var gGrat = el('g', { 'aria-hidden': 'true' });
    this._drawGraticule(gGrat);
    this.svg.appendChild(gGrat);

    var gCountries = el('g');

    this.geo.features.forEach(function (f) {
      var d = [];
      eachRing(f.geometry, function (ring) {
        for (var i = 0; i < ring.length; i++) {
          var p = self._pt(ring[i][0], ring[i][1]);
          d.push((i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1));
        }
        d.push('Z');
      });

      var path = el('path', { class: 'country', d: d.join(''), 'data-code': f.id });
      path.appendChild(el('title'));   // native fallback if JS tooltip is blocked
      self.paths[f.id] = path;
      gCountries.appendChild(path);
    });

    this.svg.appendChild(gCountries);

    // Outline overlay for the hovered country. Drawn once, on top of every
    // country, so highlighting never has to reorder the live DOM.
    this._hi = el('path', { class: 'country-highlight', d: '', 'pointer-events': 'none' });
    this._hi.style.display = 'none';
    this.svg.appendChild(this._hi);

    this._labels();
    this._bindHover();
  };

  /* One delegated listener for the whole map. `mouseleave` on the <svg> is the
   * single authoritative "pointer is no longer over any country" signal. */
  LatamMap.prototype._bindHover = function () {
    var self = this;

    function codeAt(target) {
      var hit = target && target.closest ? target.closest('.country') : null;
      return hit ? hit.getAttribute('data-code') : null;
    }

    this.svg.addEventListener('mousemove', function (e) {
      var code = codeAt(e.target);
      if (code !== self._over) {
        self._over = code;
        if (code) self.onHover(code, e); else self.onLeave();
      }
      if (code) self.onMove(code, e);
    });

    this.svg.addEventListener('mouseleave', function () {
      self._over = null;
      self.onLeave();
    });

    // Touch: a tap behaves like a hover.
    this.svg.addEventListener('touchstart', function (e) {
      var code = codeAt(e.target);
      self._over = code;
      if (code) { self.onHover(code, e.touches[0]); self.onMove(code, e.touches[0]); }
      else self.onLeave();
    }, { passive: true });
  };

  /* Signed area of a ring, in squared user units. */
  function ringArea(ring) {
    var a = 0;
    for (var i = 0, n = ring.length - 1; i < n; i++) {
      a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    }
    return Math.abs(a / 2);
  }

  /* Label the countries whose largest polygon can actually hold the text.
   * Small states (Uruguay, Guyana, Suriname, Ecuador) are left to the roster. */
  LatamMap.prototype._labels = function () {
    var self = this;
    var g = el('g', { 'aria-hidden': 'true', 'pointer-events': 'none' });
    var minArea = Math.pow(this.width, 2) * 0.0055;

    this.geo.features.forEach(function (f) {
      var best = null, bestArea = 0;
      eachRing(f.geometry, function (ring) {
        var proj = ring.map(function (p) { return self._pt(p[0], p[1]); });
        var a = ringArea(proj);
        if (a > bestArea) { bestArea = a; best = proj; }
      });
      if (!best || bestArea < minArea) return;

      var cx = 0, cy = 0;
      for (var i = 0; i < best.length; i++) { cx += best[i][0]; cy += best[i][1]; }
      cx /= best.length; cy /= best.length;

      var t = el('text', {
        x: cx.toFixed(1), y: cy.toFixed(1),
        'text-anchor': 'middle', 'dominant-baseline': 'middle',
        class: 'country-label'
      });
      t.textContent = f.id;
      g.appendChild(t);
    });

    this.svg.appendChild(g);
  };

  /* state: { CODE: { color, unelected, ideology, title } } */
  LatamMap.prototype.paint = function (state) {
    for (var code in this.paths) {
      var s = state[code];
      var path = this.paths[code];
      if (!s) { path.setAttribute('fill', '#30363d'); continue; }
      path.setAttribute('fill', s.unelected ? this.hatchFor[s.ideology] : s.color);
      path.classList.toggle('is-inert', s.ideology === 'none');
      path.firstChild.textContent = s.title || '';
    }
  };

  LatamMap.prototype.highlight = function (code) {
    for (var c in this.paths) this.paths[c].classList.toggle('is-hovered', c === code);
    if (code && this.paths[code]) {
      this._hi.setAttribute('d', this.paths[code].getAttribute('d'));
      this._hi.style.display = '';
    } else {
      this._hi.style.display = 'none';
    }
  };

  /* Forget any hover state the map is holding (used by the page's safety nets). */
  LatamMap.prototype.clearHover = function () { this._over = null; };

  global.LatamMap = LatamMap;
  global.LatamMap.shade = shade;
})(window);
