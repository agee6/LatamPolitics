/* Month arithmetic and the stacked "regional balance" chart that doubles as
 * the timeline scrubber. */
(function (global) {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var EPOCH = 1970;
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

  function svgEl(name, attrs) {
    var n = document.createElementNS(SVG_NS, name);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  var Months = {
    /* Index 0 is January 1970. */
    maxIndex: function () {
      var d = new Date();
      return (d.getFullYear() - EPOCH) * 12 + d.getMonth();
    },
    year: function (i) { return EPOCH + Math.floor(i / 12); },
    month: function (i) { return i % 12; },           // 0-11
    /* Mid-month sample date: "who held this country during this month". */
    iso: function (i) {
      return Months.year(i) + '-' + pad2(Months.month(i) + 1) + '-15';
    },
    label: function (i) { return MONTHS[Months.month(i)] + ' ' + Months.year(i); },
    shortLabel: function (i) {
      return MONTHS[Months.month(i)].slice(0, 3).toUpperCase() + ' ' + Months.year(i);
    },
    fromYear: function (y) { return (y - EPOCH) * 12; }
  };

  /* Stacked step-area chart: one band per ideology, 1 user unit per month,
   * y in whole countries so band thickness reads as a count directly. */
  function BalanceChart(svg, ideologies, series, total) {
    this.svg = svg;
    this.n = series.length;
    this.total = total;
    svg.setAttribute('viewBox', '0 0 ' + this.n + ' ' + total);
    svg.setAttribute('preserveAspectRatio', 'none');

    var bands = ideologies.filter(function (i) { return i.id !== 'none'; });
    var g = svgEl('g');

    // Cumulative boundary for each band, per month.
    var cum = [];
    for (var i = 0; i < this.n; i++) cum.push(0);

    bands.forEach(function (ide) {
      var lower = cum.slice();
      for (var i = 0; i < this.n; i++) cum[i] += (series[i][ide.id] || 0);

      var d = [];
      for (var x = 0; x < this.n; x++) {
        var y = total - cum[x];
        d.push((x ? 'L' : 'M') + x + ' ' + y, 'L' + (x + 1) + ' ' + y);
      }
      for (var x2 = this.n - 1; x2 >= 0; x2--) {
        var yb = total - lower[x2];
        d.push('L' + (x2 + 1) + ' ' + yb, 'L' + x2 + ' ' + yb);
      }
      d.push('Z');
      g.appendChild(svgEl('path', { d: d.join(''), fill: ide.color, 'data-band': ide.id }));
    }, this);

    svg.appendChild(g);

    // Decade gridlines, drawn over the bands.
    var grid = svgEl('g');
    for (var y = 1980; y <= Months.year(this.n - 1); y += 10) {
      var x = Months.fromYear(y);
      grid.appendChild(svgEl('line', { class: 'decade', x1: x, y1: 0, x2: x, y2: total,
        'vector-effect': 'non-scaling-stroke' }));
    }
    svg.appendChild(grid);

    this.head = svgEl('line', { class: 'playhead', x1: 0, y1: 0, x2: 0, y2: total,
      'vector-effect': 'non-scaling-stroke' });
    svg.appendChild(this.head);
  }

  BalanceChart.prototype.setIndex = function (i) {
    var x = i + 0.5;
    this.head.setAttribute('x1', x);
    this.head.setAttribute('x2', x);
  };

  /* Map a pointer event to a month index. */
  BalanceChart.prototype.indexAt = function (clientX) {
    var r = this.svg.getBoundingClientRect();
    var f = (clientX - r.left) / r.width;
    return Math.max(0, Math.min(this.n - 1, Math.floor(f * this.n)));
  };

  global.Months = Months;
  global.BalanceChart = BalanceChart;
})(window);
