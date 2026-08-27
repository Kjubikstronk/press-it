/* ═══════════════════════════════════════════════════════════════════════
   PRESS IT — taemin.online

   One fetch of data/site.json, then everything on the page is derived from
   it. No dependencies, no build step, no second request, no API key.

   Two things here are load-bearing and easy to "tidy" into bugs:

   1. Data-driven <img> elements ship with NO src attribute and get one
      assigned here. The browser starts fetching from parsed markup before
      any script runs, so a placeholder src fires a 404 on every load —
      wrapping the tag in a conditional does not help, because the parse
      happens first.
   2. The scroll-reveal hidden state (opacity:0) is applied from JS, never
      from CSS. If this file fails to load, the page must still be readable
      rather than a column of invisible sections.
   ═══════════════════════════════════════════════════════════════════════ */

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const esc = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/* ─── derived-value helpers ──────────────────────────────────────────── */

/** Apple Music appends the format to titles; nobody says "PERMISSION - Single". */
const tidy = (t = '') =>
  t
    .replace(/\s*[-–—]\s*(Single|EP)$/i, '')
    .replace(/\s*[-–—]\s*The\s+\d+(st|nd|rd|th)\s+(Mini\s+)?Album\b.*$/i, '')
    .trim() || t;

const fmtDate = (iso, opts = { year: 'numeric', month: 'short', day: 'numeric' }) =>
  iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-US', opts) : '';

const dotted = (iso) => (iso ? iso.replace(/-/g, '.') : '');

const relative = (iso) => {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso + 'T00:00:00')) / 864e5);
  if (days < 1) return 'today';
  if (days < 2) return 'yesterday';
  if (days < 30) return days + ' days ago';
  if (days < 365) return Math.round(days / 30) + ' months ago';
  return (days / 365.25).toFixed(1).replace(/\.0$/, '') + ' years ago';
};

const stripArtist = (t = '') => t.replace(/^TAEMIN\s*\(태민\)\s*-\s*/, '');

/** Assign a src only once we actually have a URL. See note 1 at the top. */
const setImg = (el, url) => {
  if (el && url) el.setAttribute('src', url);
};

/* ─── state ──────────────────────────────────────────────────────────── */

let DATA = null;
const S = {
  kind: 'All',
  discoOpen: false,
  videosOpen: false,
  newsOpen: false,
  timelineOpen: false,
  fact: 0,
};

const CAPS = { disco: 12, videos: 4, news: 6, timeline: 6 };

/* ─── boot ───────────────────────────────────────────────────────────── */

async function boot() {
  try {
    const res = await fetch('data/site.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    DATA = await res.json();
  } catch (err) {
    console.error('Could not load data/site.json —', err);
    return fail();
  }

  renderStamps();
  renderHero();
  renderWire();
  renderWorldTour();
  renderTour();
  renderDiscography();
  renderPressIt();
  renderVideos();
  renderNews();
  renderTimeline();
  renderFacts();
  renderFooter();

  initReveal();
  initActiveNav();
}

/**
 * Ask the CDN for the size actually being displayed.
 *
 * Apple and Deezer both serve any square size off the same path, and
 * build.js stores one large URL per release — so a 600px cover was being
 * downloaded for a card that renders around 200px. At these dimensions the
 * bytes scale roughly with area: the same sleeve is 136 kB at 600px and
 * 39 kB at 300px.
 *
 * A URL from an unrecognised host is returned untouched, so a source
 * changing its path shape costs the optimisation, never the image.
 */
const sized = (url = '', px) =>
  url
    .replace(/\/\d+x\d+bb\.(jpg|png)/, `/${px}x${px}bb.$1`)
    .replace(/\/\d+x\d+(-000000-[\d-]+\.jpg)/, `/${px}x${px}$1`);

/** srcset for a fluid slot, so a retina screen still gets a sharp cover. */
const srcset = (url, ...widths) =>
  widths.map((w) => `${sized(url, w)} ${w}w`).join(', ');

function fail() {
  const host = $('[data-wire-grid]');
  if (host) {
    host.innerHTML =
      '<p class="wire__cell" style="color:var(--ash)">Couldn\'t load the data file. ' +
      'The page is static, so a refresh usually fixes it.</p>';
  }
}

/* ─── header + footer stamps ─────────────────────────────────────────── */

function renderStamps() {
  const gen = new Date(DATA.generated);
  const short = $('[data-generated-short]');
  if (short) short.textContent = 'updated ' + relative(gen.toISOString().slice(0, 10));

  const full = $('[data-generated-full]');
  if (full) {
    full.textContent =
      'Last rebuild — ' + gen.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  }

  const stamp = $('[data-wire-stamp]');
  if (stamp) {
    stamp.textContent =
      'last checked ' +
      gen.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) +
      ' · every 6 hours';
  }
}

/* ─── hero ───────────────────────────────────────────────────────────── */

function renderHero() {
  const latest = DATA.latest || {};
  const vids = DATA.videos || [];

  setImg($('[data-hero-art]'), latest.art);

  const daysOld = latest.date ? (Date.now() - new Date(latest.date + 'T00:00:00')) / 864e5 : Infinity;
  const badge = $('[data-drop-badge]');
  if (badge) badge.textContent = daysOld < 120 ? 'Out now' : 'Latest release';

  const meta = $('[data-latest-meta]');
  if (meta) {
    meta.textContent = [latest.kind || 'Release', fmtDate(latest.date), relative(latest.date)]
      .filter(Boolean)
      .join(' · ');
  }

  const title = $('[data-latest-title]');
  if (title) title.textContent = tidy(latest.title);

  const cities = (DATA.worldTour?.legs || []).flatMap((l) => l.cities || []);
  const cta = $('[data-hero-cta]');
  if (cta) {
    cta.innerHTML = [
      latest.url
        ? `<a class="btn btn--fill" href="${esc(latest.url)}" target="_blank" rel="noopener">Listen ↗</a>`
        : '',
      vids[0]?.url
        ? `<a class="btn btn--ghost" href="${esc(vids[0].url)}" target="_blank" rel="noopener">Watch</a>`
        : '',
      cities.length
        ? `<a class="btn btn--signal" href="#tour">Tour · ${cities.length} cities</a>`
        : '',
    ].join('');
  }

  const st = DATA.stats || {};
  const stats = [
    { value: st.yearsSinceDebut, sup: '+', label: 'Years active' },
    { value: st.yearsSinceSoloDebut, sup: '+', label: 'Solo' },
    { value: st.releaseCount, sup: '', label: 'Releases' },
    { value: relative(latest.date).replace(/ ago$/, ''), sup: '', label: 'Since last drop' },
  ];
  const statHost = $('[data-hero-stats]');
  if (statHost) {
    statHost.innerHTML = stats
      .filter((s) => s.value !== undefined && s.value !== null && s.value !== '')
      .map(
        (s) => `
      <div class="stat">
        <span class="stat__value">${esc(s.value)}${s.sup ? `<sup>${esc(s.sup)}</sup>` : ''}</span>
        <span class="stat__label">${esc(s.label)}</span>
      </div>`
      )
      .join('');
  }
}

/* ─── the wire ───────────────────────────────────────────────────────── */

function renderWire() {
  const host = $('[data-wire-grid]');
  if (!host) return;

  const latest = DATA.latest || {};
  const vids = DATA.videos || [];
  const news = DATA.news || [];
  const top = vids[0];

  const chips = [
    latest.kind,
    latest.trackCount ? latest.trackCount + (latest.trackCount > 1 ? ' tracks' : ' track') : null,
    latest.genre,
  ]
    .filter(Boolean)
    .join(' · ');

  host.innerHTML = `
    <a class="wire__cell" href="${esc(latest.url || '#')}" target="_blank" rel="noopener">
      <div class="wire__head">
        <span class="wire__kind">Release</span>
        <span class="wire__time">${esc(dotted(latest.date))}</span>
      </div>
      <img class="wire__cover" alt="" data-wire-art>
      <p class="wire__title">${esc(tidy(latest.title))}</p>
      <p class="wire__sub">${esc(chips)}</p>
    </a>

    ${
      top
        ? `<a class="wire__cell" href="${esc(top.url)}" target="_blank" rel="noopener">
      <div class="wire__head">
        <span class="wire__kind">Video</span>
        <span class="wire__time">${esc(relative(top.date))}</span>
      </div>
      <div class="wire__thumb-wrap">
        <img alt="" data-wire-thumb>
        <span class="wire__play" aria-hidden="true"><span>▶</span></span>
      </div>
      <p class="wire__title">${esc(stripArtist(top.title))}</p>
      <p class="wire__sub">Straight off his channel.</p>
    </a>`
        : ''
    }

    <div class="wire__cell">
      <div class="wire__head">
        <span class="wire__kind">Press</span>
        <span class="wire__time">${esc(news[0] ? relative(news[0].date) : '')}</span>
      </div>
      ${news
        .slice(0, 4)
        .map(
          (n) => `
        <a class="wire__press" href="${esc(n.url)}" target="_blank" rel="noopener">
          <span class="wire__press-title">${esc(n.title)}</span>
          <span class="wire__press-meta">${esc(
            [n.outlet, fmtDate(n.date, { month: 'short', day: '2-digit' })].filter(Boolean).join(' · ')
          )}</span>
        </a>`
        )
        .join('')}
    </div>`;

  setImg($('[data-wire-art]', host), latest.artSmall || latest.art);
  setImg($('[data-wire-thumb]', host), top?.thumb);
}

/* ─── LiMiNaL world tour ─────────────────────────────────────────────── */

function renderWorldTour() {
  const host = $('[data-world-tour]');
  if (!host) return;

  const wt = DATA.worldTour;
  const legs = (wt?.legs || []).filter((l) => (l.cities || []).length);
  if (!wt || !legs.length) return; // stays hidden; ending the run is a one-key delete

  const cities = legs.flatMap((l) => l.cities);
  const countries = new Set(cities.map((c) => c.country).filter(Boolean));
  const dated = cities.filter((c) => c.date).length;

  const label = $('[data-wt-label]', host);
  if (label) label.textContent = [wt.label, wt.run].filter(Boolean).join(' · ');

  const status = $('[data-wt-status]', host);
  if (status) {
    status.textContent = [wt.status, 'The moment one lands, this page will have it.']
      .filter(Boolean)
      .join(' ');
  }

  // Duplicated so translateX(-50%) lands exactly one copy along and the loop
  // has no visible restart.
  const names = cities.map((c) => (c.city || '').toUpperCase());
  const ticker = $('[data-wt-ticker]', host);
  if (ticker) {
    ticker.innerHTML = [...names, ...names].map((n) => `<span>${esc(n)}</span>`).join('');
  }

  const statHost = $('[data-wt-stats]', host);
  if (statHost) {
    statHost.innerHTML = `
      <div class="liminal__stat">
        <div class="liminal__stat-value">${cities.length}</div>
        <div class="liminal__stat-label">cities</div>
      </div>
      <div class="liminal__stat">
        <div class="liminal__stat-value">${countries.size}</div>
        <div class="liminal__stat-label">countries</div>
      </div>
      <div class="liminal__stat${dated ? '' : ' liminal__stat--open'}">
        <div class="liminal__stat-value">${dated || '—'}</div>
        <div class="liminal__stat-label">dates announced</div>
      </div>`;
  }

  // One running counter across legs, so the list reads 01–12 rather than
  // restarting per continent.
  let n = 0;
  const legHost = $('[data-wt-legs]', host);
  if (legHost) {
    legHost.innerHTML = legs
      .map(
        (leg) => `
      <div class="liminal__leg">
        <h3 class="liminal__leg-name">
          <span>${esc(leg.name)}</span>
          <span class="liminal__leg-count">${leg.cities.length}</span>
          <span class="liminal__leg-rule" aria-hidden="true"></span>
        </h3>
        <ul class="liminal__cities">
          ${leg.cities
            .map((c) => {
              n += 1;

              /* A run of nights inside one month collapses to "18–20 Sep
                 2026" — how the tour site writes it and how anyone reads it
                 out loud. Spanning a month boundary it falls back to two
                 full dates rather than inventing a shorthand for a case
                 that has not come up yet. */
              const a = c.date ? new Date(c.date + 'T00:00:00') : null;
              const b = c.end ? new Date(c.end + 'T00:00:00') : null;
              const sameMonth =
                a && b && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
              const when = sameMonth
                ? `${a.getDate()}–${b.getDate()} ${fmtDate(c.end, { month: 'short', year: 'numeric' })}`
                : b
                  ? `${fmtDate(c.date)} – ${fmtDate(c.end)}`
                  : fmtDate(c.date);
              const meta = [when, c.venue].filter(Boolean).join(' · ');

              /* On-sale rows carry the real ticket link; everything else is
                 plain text, so the status never looks clickable when there
                 is nothing behind it. */
              const label = esc(c.status || 'Coming soon');
              const stat = c.url
                ? `<a class="liminal__city-status liminal__city-status--live"
                      href="${esc(c.url)}" target="_blank" rel="noopener">${label} ↗</a>`
                : `<span class="liminal__city-status">${label}</span>`;

              return `
            <li class="liminal__city">
              <span class="liminal__idx">${String(n).padStart(2, '0')}</span>
              <span class="liminal__city-name">${esc(c.city || '')}</span>
              <span class="liminal__country">${esc(c.country || '')}</span>
              ${meta ? `<span class="liminal__meta">${esc(meta)}</span>` : ''}
              ${stat}
            </li>`;
            })
            .join('')}
        </ul>
      </div>`
      )
      .join('');
  }

  host.hidden = false;
}

/* ─── live ───────────────────────────────────────────────────────────── */

function renderTour() {
  const host = $('[data-tour]');
  if (!host) return;

  const tour = DATA.tour || {};
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (tour.dates || [])
    .filter((d) => d.date && d.date >= today)
    .sort((a, b) => (a.date > b.date ? 1 : -1));

  const alerts = (tour.alerts || [])
    .map(
      (a) =>
        `<a class="chip chip--link" href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.label)} ↗</a>`
    )
    .join('');

  /* Where tickets actually come from, and — just as usefully — what does not
     exist yet. "No VIP packages announced" is a real answer to a question
     people are actively searching, and it beats silence, which reads as
     though the page simply failed to mention them. */
  const tk = DATA.ticketing;
  const official = (tk?.links || [])
    .map(
      (l) =>
        `<a class="chip chip--link" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`
    )
    .join('');

  const ticketRow = tk?.status
    ? `<p class="tour__tickets">${esc(tk.status)}${official ? ` ${official}` : ''}</p>`
    : '';

  /* The rest of the run, as one line rather than a second copy of the list.
     This section used to repeat every dated LiMiNaL stop, which said the
     same thing twice on one page; the stops live upstairs, and each one
     arrives here on its own the day it goes on sale. */
  const ann = tour.announced;
  const monthOf = (d) => fmtDate(d, { month: 'long' });
  const span =
    ann && monthOf(ann.from) !== monthOf(ann.to)
      ? ` from ${monthOf(ann.from)} to ${monthOf(ann.to)}`
      : ann
        ? ` in ${monthOf(ann.from)}`
        : '';
  const runRow = ann
    ? `<p class="tour__run">
         <strong>${ann.count}</strong> more LiMiNaL ${ann.count === 1 ? 'date' : 'dates'}
         ${ann.count === 1 ? 'is' : 'are'} announced${span}, with tickets not on sale yet —
         <a href="#tour">see the full run</a>.
       </p>`
    : '';

  const alertRow = `
    ${runRow}
    ${ticketRow}
    <div class="tour__alerts">
      <span class="tour__alerts-label">Get told about new dates</span>${alerts}
    </div>`;

  if (!upcoming.length) {
    host.innerHTML = `
      <div class="tour__none">
        <p class="tour__none-lead">No dates announced right now.</p>
        <p class="tour__none-sub">
          He tours in bursts and shows tend to sell out fast, so the useful move
          is to set an alert rather than keep checking.
        </p>
      </div>
      ${alertRow}`;
    return;
  }

  host.innerHTML = `
    <ol class="tour">
      ${upcoming
        .map(
          (d) => `
        <li>
          <span class="tour__date">
            <span class="tour__day">${esc(fmtDate(d.date, { day: '2-digit' }))}</span>
            <span class="tour__mon">${esc(fmtDate(d.date, { month: 'short' }))}</span>
            <span class="tour__yr">${esc((d.date || '').slice(0, 4))}</span>
          </span>
          <span class="tour__where">
            <span class="tour__city">${esc(d.city || '')}${d.country ? `, ${esc(d.country)}` : ''}</span>
            <span class="tour__venue">${esc(d.venue || '')}${d.note ? ` · ${esc(d.note)}` : ''}</span>
          </span>
          ${
            d.url
              ? `<a class="tour__btn" href="${esc(d.url)}" target="_blank" rel="noopener">Tickets</a>`
              : '<span class="tour__btn" style="border-color:var(--hair);color:var(--grey)">TBA</span>'
          }
        </li>`
        )
        .join('')}
    </ol>
    ${alertRow}`;
}

/* ─── discography ────────────────────────────────────────────────────── */

/** One Deezer cover in the live data 404s, so covers degrade rather than break. */
function armArtFallback(root) {
  $$('img[data-fallback]', root).forEach((img) => {
    img.addEventListener(
      'error',
      () => {
        const alt = img.getAttribute('data-fallback');
        if (alt && img.getAttribute('src') !== alt) {
          img.setAttribute('src', alt);
          return;
        }
        img.style.visibility = 'hidden';
      },
      { once: false }
    );
  });
}

function renderDiscography() {
  const releases = DATA.releases || [];
  const count = $('[data-disco-count]');
  if (count) count.textContent = releases.length;

  const kinds = ['All', ...new Set(releases.map((r) => r.kind).filter(Boolean))];
  const chipHost = $('[data-disco-filters]');
  if (chipHost) {
    chipHost.innerHTML = kinds
      .map(
        (k) =>
          `<button type="button" class="chip${k === S.kind ? ' is-on' : ''}" data-kind="${esc(k)}">${esc(k)}</button>`
      )
      .join('');
    $$('button', chipHost).forEach((btn) => {
      btn.addEventListener('click', () => {
        S.kind = btn.dataset.kind;
        S.discoOpen = false; // a new filter starts collapsed
        renderDiscography();
      });
    });
  }

  const matching = releases.filter((r) => S.kind === 'All' || r.kind === S.kind);
  const visible = S.discoOpen ? matching : matching.slice(0, CAPS.disco);

  const host = $('[data-disco]');
  if (host) {
    host.innerHTML = visible
      .map((r) => {
        const small = r.artSmall || r.art;
        const alt = small === r.art ? '' : r.art;
        return `
        <a class="card" href="${esc(r.url)}" target="_blank" rel="noopener">
          <div class="card__frame">
            <img src="${esc(sized(small, 300))}"
                 srcset="${esc(srcset(small, 220, 300, 440))}"
                 sizes="(max-width: 640px) 46vw, 200px"
                 alt="" loading="lazy"${alt ? ` data-fallback="${esc(alt)}"` : ''}>
            <span class="card__kind">${esc(r.kind || '')}</span>
          </div>
          <h3 class="card__title">${esc(tidy(r.title))}</h3>
          <p class="card__date">${esc(dotted(r.date))}</p>
        </a>`;
      })
      .join('');
    armArtFallback(host);
  }

  renderMore('[data-disco-more]', matching.length > CAPS.disco, S.discoOpen,
    `Show all ${matching.length} releases`, () => {
      S.discoOpen = !S.discoOpen;
      renderDiscography();
    });
}

/** The four expand/collapse controls are identical apart from their label. */
function renderMore(sel, needed, open, openLabel, onClick) {
  const host = $(sel);
  if (!host) return;
  if (!needed) {
    host.innerHTML = '';
    return;
  }
  host.innerHTML = `
    <button type="button" class="more__btn">${esc(open ? 'Show less' : openLabel)} ⌄</button>
    <span class="more__rule" aria-hidden="true"></span>`;
  $('button', host).addEventListener('click', onClick);
}

/* ─── press it ───────────────────────────────────────────────────────── */

function renderPressIt() {
  const p = DATA.pressIt || {};

  const art = p.release?.art;
  $$('[data-pressit-art]').forEach((img) => setImg(img, art));

  const words = p.words || [];
  const marquee = $('[data-pressit-words]');
  if (marquee) {
    marquee.innerHTML = [...words, ...words].map((w) => `<span>${esc(w)}</span>`).join('');
  }

  const statement = $('[data-pressit-statement]');
  if (statement) statement.textContent = p.statement || '';

  const palette = $('[data-pressit-palette]');
  if (palette) {
    palette.innerHTML = (p.palette || [])
      .map(
        (c) => `
      <div class="swatch">
        <i style="background:${esc(c.hex)}"></i>${esc(c.name)}<br>${esc(c.hex)}
      </div>`
      )
      .join('');
  }

  const tracks = $('[data-pressit-tracks]');
  if (tracks) {
    tracks.innerHTML = (p.tracks || [])
      .map(
        (t) => `
      <li>
        <span class="tracks__n">${esc(String(t.n).padStart(2, '0'))}</span>
        <span class="tracks__title">${esc(t.title)}${
          t.kr ? `<small class="tracks__kr">${esc(t.kr)}</small>` : ''
        }</span>
        <span class="tracks__note">${esc(t.lead ? 'Title' : t.note || '')}</span>
      </li>`
      )
      .join('');
  }
}

/* ─── watch ──────────────────────────────────────────────────────────── */

function renderVideos() {
  const vids = DATA.videos || [];
  const visible = S.videosOpen ? vids : vids.slice(0, CAPS.videos);

  const host = $('[data-videos]');
  if (host) {
    host.innerHTML = visible
      .map(
        (v) => `
      <a class="card" href="${esc(v.url)}" target="_blank" rel="noopener">
        <div class="vid__frame">
          <img src="${esc(v.thumb)}" alt="" loading="lazy">
          <span class="vid__play" aria-hidden="true">▶</span>
        </div>
        <h3 class="vid__title">${esc(stripArtist(v.title))}</h3>
        <p class="card__date">${esc(dotted(v.date))}</p>
      </a>`
      )
      .join('');
  }

  renderMore('[data-videos-more]', vids.length > CAPS.videos, S.videosOpen,
    `Show all ${vids.length} videos`, () => {
      S.videosOpen = !S.videosOpen;
      renderVideos();
    });
}

/* ─── news ───────────────────────────────────────────────────────────── */

function renderNews() {
  const news = DATA.news || [];
  const visible = S.newsOpen ? news.slice(0, 12) : news.slice(0, CAPS.news);

  const host = $('[data-news]');
  if (host) {
    host.innerHTML = visible
      .map(
        (n) => `
      <li>
        <a href="${esc(n.url)}" target="_blank" rel="noopener">
          <span class="news__date">${esc(fmtDate(n.date, { month: 'short', day: '2-digit', year: '2-digit' }))}</span>
          <span class="news__head">${esc(n.title)}</span>
          <span class="news__outlet">${esc(n.outlet || '')}</span>
        </a>
      </li>`
      )
      .join('');
  }

  renderMore('[data-news-more]', news.length > CAPS.news, S.newsOpen,
    'Show all 12 headlines', () => {
      S.newsOpen = !S.newsOpen;
      renderNews();
    });
}

/* ─── timeline ───────────────────────────────────────────────────────── */

function renderTimeline() {
  const items = [...(DATA.timeline || [])].reverse(); // newest first
  const visible = S.timelineOpen ? items : items.slice(0, CAPS.timeline);

  const host = $('[data-timeline]');
  if (host) {
    host.innerHTML = visible
      .map(
        (t) => `
      <li>
        <span class="timeline__year">${esc(t.year || (t.date || '').slice(0, 4))}</span>
        <div class="timeline__body">
          <h3 class="timeline__title">${esc(t.title)}</h3>
          <p class="timeline__text">${esc(t.body)}</p>
          ${t.tag ? `<span class="timeline__tag">${esc(t.tag)}</span>` : ''}
        </div>
      </li>`
      )
      .join('');
  }

  renderMore('[data-timeline-more]', items.length > CAPS.timeline, S.timelineOpen,
    `Show all ${items.length} milestones`, () => {
      S.timelineOpen = !S.timelineOpen;
      renderTimeline();
    });
}

/* ─── facts ──────────────────────────────────────────────────────────── */

function renderFacts() {
  const facts = DATA.facts || [];
  if (!facts.length) return;

  const quote = $('[data-fact]');
  const count = $('[data-fact-count]');

  const paint = () => {
    // Modulo at read time, so the counter can run negative without clamping.
    const i = ((S.fact % facts.length) + facts.length) % facts.length;
    if (quote) quote.textContent = facts[i];
    if (count) {
      count.textContent =
        String(i + 1).padStart(2, '0') + ' / ' + String(facts.length).padStart(2, '0');
    }
  };

  const step = (by) => {
    S.fact += by;
    paint();
  };

  $('[data-fact-prev]')?.addEventListener('click', () => step(-1));
  $('[data-fact-next]')?.addEventListener('click', () => step(1));
  paint();

  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    setInterval(() => step(1), 9000);
  }
}

/* ─── footer ─────────────────────────────────────────────────────────── */

function renderFooter() {
  const host = $('[data-links]');
  if (!host) return;
  host.innerHTML = (DATA.links || [])
    .map(
      (l) =>
        `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`
    )
    .join('');
}

/* ─── scroll reveal ──────────────────────────────────────────────────── */

/**
 * Fades blocks up as they enter the viewport.
 *
 * The opacity:0 is set here rather than in the stylesheet on purpose — if
 * this file 404s or throws, the page should read as plain static HTML, not
 * as a stack of permanently invisible sections.
 */
function initReveal() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const targets = $$('[data-reveal]');
  if (!('IntersectionObserver' in window)) return;

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.style.animation = 'reveal .9s cubic-bezier(.22,1,.36,1) both';
        io.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.08 }
  );

  targets.forEach((t) => {
    t.style.opacity = '0';
    io.observe(t);
  });
}

/* ─── active nav ─────────────────────────────────────────────────────── */

/** Dims every nav link except the section crossing the middle of the screen. */
function initActiveNav() {
  if (!('IntersectionObserver' in window)) return;
  const links = $$('.hdr__nav a');
  if (!links.length) return;

  const paint = (id) => {
    links.forEach((a) => {
      const on = a.getAttribute('href') === '#' + id;
      a.style.opacity = on ? '1' : '.5';
      a.style.textDecoration = on ? 'underline' : 'none';
    });
  };

  const io = new IntersectionObserver(
    (entries) => {
      const vis = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (vis) paint(vis.target.id);
    },
    { rootMargin: '-45% 0px -45% 0px' }
  );

  links.forEach((a) => {
    const el = document.querySelector(a.getAttribute('href'));
    if (el) io.observe(el);
  });
}

boot();
