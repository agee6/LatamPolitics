# LatamPolitics

An animated map of South America showing which countries were governed by the
left, the centre or the right, month by month, from January 1970 to the present.

Press play and the map runs through 680-odd months. Pause anywhere and hover a
country to see who was in power, their party, and the years of their term.

## Running it

It is a static site with no build step and no dependencies.

**Easiest:** double-click `index.html`. It works straight off the filesystem —
the data ships as plain `<script>` files rather than JSON fetches precisely so
that `file://` works.

**With a local server** (closer to how it will be hosted):

```bash
python3 -m http.server 8765
```

Then open <http://localhost:8765>.

## Putting it online

The repo is already laid out as a GitHub Pages site — `index.html` sits at the
root, everything else is relative paths.

```bash
git init && git add -A && git commit -m "LatamPolitics: South America political map, 1970-present"
```

Push it to a GitHub repo, then in **Settings → Pages** choose *Deploy from a
branch*, branch `main`, folder `/ (root)`. It will be live at
`https://<user>.github.io/<repo>/` within a minute or two. Netlify, Vercel and
Cloudflare Pages will all take it as-is with no configuration.

## Controls

| Action | How |
| --- | --- |
| Play / pause | `Play` button or <kbd>space</kbd> |
| Step one month | `±1 m` buttons or <kbd>←</kbd> / <kbd>→</kbd> |
| Step one year | <kbd>shift</kbd> + <kbd>←</kbd> / <kbd>→</kbd> |
| Jump to start / today | `1970` / `Today` buttons, or <kbd>Home</kbd> / <kbd>End</kbd> |
| Scrub | Drag the slider, or drag directly on the stacked chart |
| Inspect a country | Hover the map, or hover a row in the sidebar list |

The stacked chart under the controls is the regional balance over time: each
band is a count of countries, so its thickness is readable directly — the Pink
Tide of the 2000s shows up as the red bands swelling from the bottom.

## Files

```
index.html          markup and the tooltip template
css/styles.css      all styling
js/map.js           Mercator projection, SVG path building, hatch patterns
js/timeline.js      month arithmetic, stacked balance chart / scrubber
js/app.js           date resolution, painting, playback, tooltip, sidebar
data/leaders.js     the database — 180+ leaders across 14 territories
data/geo.js         country outlines
tools/build-geo.js  regenerates data/geo.js from Natural Earth
```

### Editing the data

`data/leaders.js` is the only file you need to touch to correct or extend the
history. Each country holds a chronological list:

```js
{ name: 'Luis Lacalle Pou', party: 'Partido Nacional', partyShort: 'PN',
  partyEn: 'National Party', start: '2020-03-01', end: '2025-03-01',
  ideology: 'center-right', note: '...' }
```

`end: null` means "still in power". `unelected: true` adds the hatching. The
list must stay in chronological order and must not overlap; the app resolves a
month by scanning for `start <= date < end`.

### Regenerating the map outlines

Only needed if you want different borders or more detail:

```bash
curl -O https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json
node tools/build-geo.js countries-50m.json data/geo.js
```

## Editorial choices

These are the places where the one-axis colour scheme required a judgement
call. They are worth knowing about before using the map to argue anything.

**The scale has five points, not three.** Deep red is the left, pale red the
centre-left, grey the centre, pale blue the centre-right, deep blue the right.
Collapsing South American politics to three buckets put far too much into
"centrist", so the shades carry the nuance.

**Dictatorships are coloured by their actual ideology and hatched.** Most of the
Cold War juntas were right-wing, but not all: Peru's Velasco (1968–75) and
Bolivia's Juan José Torres (1970–71) ran left-wing military governments, and
Suriname's Bouterse regime was also on the left. Hatching marks *how* a
government took power, colour marks *what* it believed. A country can therefore
be hatched red.

**Self-coups split a leader into two rows.** Fujimori and Bordaberry each appear
twice — once as an elected president, once as the unelected ruler they became
after dissolving their legislature. The hatching appears on the exact month.

**Peronism sits at the centre by default.** It spans a genuine left and right
wing. Perón's own third term is marked centre; Isabel Perón's is marked right
(the López Rega period); Menem's is marked right (the neoliberal programme);
the Kirchners are marked centre-left. Reasonable people disagree.

**Colombia's Liberal Party is treated as centre-left throughout.** Every Liberal
president — Lleras Restrepo, López Michelsen, Turbay, Barco, Gaviria, Samper —
is marked centre-left, against the Conservatives' centre-right. This is a
party-label rule rather than a reading of each administration, and two of them
sit awkwardly with it: Turbay's Security Statute was a hard crackdown on the
left, and Gaviria governed as an economic liberaliser. The consistency is worth
more here than case-by-case second-guessing.

**Elected label vs. governing record.** Where the two diverge, the governing
record wins: Lucio Gutiérrez campaigned on the left and is marked centre; Dina
Boluarte took office on a left ticket and is marked centre-right.

**Venezuela's interim government is marked centre-left and still hatched.**
Maduro was captured by US forces on 3 January 2026; his vice-president Delcy
Rodríguez was designated acting president by the Supreme Tribunal the same day
and sworn in on the 5th. She is the same party (PSUV), so the centre-left
placement reflects the interim government's liberalising, US-friendly turn
rather than a change of banner, and the hatching stays because nobody elected
this government. Maduro continues to claim the office.

**Non-sovereign territories are uncoloured.** French Guiana (France) and the
Falklands/Malvinas (UK) are drawn in neutral grey, are excluded from all counts,
and show their status on hover. Twelve sovereign states are counted.

**Far-offshore territories are omitted from the outlines.** The Galapagos
(Ecuador), Easter Island and Juan Fernandez (Chile) sit up to 28 degrees west of
the mainland and would drag the map's bounding box far out into the Pacific. The
cutoff lives in `tools/build-geo.js` as `WEST_LIMIT`.

**Sampling.** Each month is resolved at the 15th, so a month is coloured by
whoever held power in the middle of it. Several multi-day interregna in the data
are therefore never rendered — Argentina's five presidents in two weeks in
December 2001 collapse to two frames.

**Entries marked `VERIFY` in the data** are recent enough that they should be
checked against current reporting before you rely on them.

## Possible next steps

- Extend to the rest of Latin America — Mexico, Central America, the Caribbean.
  The data format and the map builder already handle arbitrary countries; it is
  a matter of adding entries and widening the Natural Earth filter in
  `tools/build-geo.js`.
- Legislative control as a second layer, since several of these presidents never
  held a majority.
- A per-country timeline strip you can click through.

## Sources and licence

Leader, party and date information was compiled from standard reference
material on each country's heads of state and government. Country outlines are
derived from [Natural Earth](https://www.naturalearthdata.com/) 1:50m admin-0
boundaries (public domain) via `world-atlas`.
