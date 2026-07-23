/* ═══════════════════════════════════════════════════════════════════════
   PRESS IT — runtime
   Renders everything from data/site.json, which the daily build rewrites.
   No framework: the page is the same age as the data it draws.
   ═══════════════════════════════════════════════════════════════════════ */

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

/** "Press It - The 1st Album" → "Press It". The suffixes are catalogue noise. */
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
  // floor, not round. These are elapsed *calendar* days, and rounding pushed
  // anything past midday into the next bucket — something from 15:40 today
  // came out as 0.76 days, rounded to 1, and displayed as "yesterday".
  const days = Math.floor((Date.now() - new Date(iso + 'T00:00:00')) / 864e5);
  if (days < 1) return 'today';
  if (days < 2) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  const y = (days / 365.25).toFixed(1).replace(/\.0$/, '');
  return `${y} years ago`;
};

/**
 * Cap a long list and add a "Show all" toggle.
 *
 * The full page ran to 30 screens on a phone — discography alone was 15 of
 * them. Rather than cut content, everything past `keep` starts collapsed and
 * expands in place. Collapsed items are `hidden`, so they stay out of the
 * accessibility tree and out of tab order until revealed.
 */
function collapse(container, keep, label) {
  const items = [...container.children];
  if (items.length <= keep) return;

  const hide = (on) =>
    items.forEach((el, i) => { if (i >= keep) el.hidden = on; });

  hide(true);

  const bar = document.createElement('div');
  bar.className = 'more';
  bar.innerHTML = `
    <button type="button" aria-expanded="false">
      <span>Show all ${items.length} ${esc(label)}</span>
      <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2"/></svg>
    </button>
    <span class="more__line"></span>`;

  const btn = bar.querySelector('button');
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') === 'true';
    hide(open);
    btn.setAttribute('aria-expanded', String(!open));
    btn.querySelector('span').textContent = open
      ? `Show all ${items.length} ${label}`
      : 'Show less';
    // Collapsing from far down the list would otherwise strand the viewport
    // below the section entirely.
    if (open) bar.previousElementSibling?.scrollIntoView({ block: 'nearest' });
  });

  container.after(bar);
}

/* ─── boot ───────────────────────────────────────────────────────────── */

let DATA = null;

async function boot() {
  try {
    const res = await fetch('data/site.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    DATA = await res.json();
  } catch (err) {
    console.error('Could not load data/site.json —', err);
    return fail();
  }

  renderHero();
  renderLatest();
  renderTour();
  renderDiscography();
  renderPressIt();
  renderVideos();
  renderNews();
  renderTimeline();
  renderFacts();
  renderFooter();

  initReveal();
  initNav();
  initSpotlight();
  loadMoodboard();
}

function fail() {
  $$('[data-latest], [data-disco], [data-videos], [data-news], [data-timeline]')
    .forEach((el) => {
      el.innerHTML =
        '<p class="empty">Data unavailable — run <code>node build.js</code>, then reload.</p>';
    });
}

/* ─── hero ───────────────────────────────────────────────────────────── */

function renderHero() {
  const { latest, stats, generated } = DATA;

  if (latest?.art) {
    for (const sel of ['[data-hero-art]', '[data-hero-art-2]']) {
      const img = $(sel);
      img.src = latest.art;
      img.addEventListener('load', () => img.classList.add('is-in'), { once: true });
      if (img.complete) img.classList.add('is-in');
    }
  }

  const cells = [
    ['Years active', stats.yearsSinceDebut, '+'],
    ['Solo', stats.yearsSinceSoloDebut, '+'],
    ['Releases', stats.releaseCount, ''],
    ['Since last drop', relative(latest?.date).replace(/ ago$/, ''), ''],
  ];

  $('[data-stats]').innerHTML = cells
    .map(
      ([label, value, sup]) =>
        `<div><dd>${esc(value)}${sup ? `<span>${sup}</span>` : ''}</dd><dt>${esc(label)}</dt></div>`
    )
    .join('');

  const stamp = generated ? new Date(generated) : null;
  if (stamp) {
    $('[data-generated]').textContent = `updated ${relative(
      stamp.toISOString().slice(0, 10)
    )}`;
    $('[data-generated-full]').textContent = `Last rebuild — ${stamp.toLocaleString(
      'en-US',
      { dateStyle: 'medium', timeStyle: 'short' }
    )}`;
  }
}

/* ─── latest ─────────────────────────────────────────────────────────── */

function renderLatest() {
  const r = DATA.latest;
  const host = $('[data-latest]');
  if (!r) return void (host.innerHTML = '<p class="empty">No release found.</p>');

  const fresh = (Date.now() - new Date(r.date + 'T00:00:00')) / 864e5 < 120;

  host.innerHTML = `
    <article class="latest__card">
      <div class="latest__art">
        ${fresh ? '<span class="badge">New</span>' : ''}
        <img src="${esc(r.art)}" alt="${esc(tidy(r.title))} cover art"
             width="1400" height="1400" fetchpriority="high" decoding="async">
      </div>
      <div>
        <p class="mono">${esc(fmtDate(r.date))} · ${esc(relative(r.date))}</p>
        <h3 class="latest__title">${esc(tidy(r.title))}</h3>
        <div class="latest__facts">
          <span class="chip">${esc(r.kind || 'Release')}</span>
          ${r.trackCount ? `<span class="chip">${r.trackCount} track${r.trackCount > 1 ? 's' : ''}</span>` : ''}
          ${r.genre ? `<span class="chip">${esc(r.genre)}</span>` : ''}
        </div>
        ${r.url ? `<a class="btn" href="${esc(r.url)}" target="_blank" rel="noopener">Listen<span aria-hidden="true">↗</span></a>` : ''}
      </div>
    </article>`;
}

/* ─── live ───────────────────────────────────────────────────────────── */

/**
 * Tour dates are hand-kept in curated.json — every tour API (Bandsintown,
 * Songkick, Ticketmaster) now requires a key, and a key is the one thing this
 * project deliberately doesn't have.
 *
 * With nothing scheduled the section still earns its place by pointing at the
 * alert pages, which is the real answer to "where can I see him" when the
 * answer is "nowhere yet".
 */
function renderTour() {
  const tour = DATA.tour || {};
  const host = $('[data-tour]');
  if (!host) return;

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

  // Announcements pulled from the news wire. These are the automated half —
  // the confirmed list above is hand-checked, this catches everything new.
  const wire = (DATA.tourNews || []).slice(0, 5);
  const wireBlock = wire.length
    ? `<div class="tour__wire">
         <h3 class="tour__wire-head"><span class="mono">Just announced</span></h3>
         <ul class="tour__wire-list">
           ${wire
             .map(
               (n) => `
             <li>
               <a href="${esc(n.url)}" target="_blank" rel="noopener">
                 <span class="date">${esc(fmtDate(n.date, { month: 'short', day: '2-digit' }))}</span>
                 <span class="head">${esc(n.title)}</span>
                 <span class="outlet">${esc(n.outlet || '')}</span>
               </a>
             </li>`
             )
             .join('')}
         </ul>
       </div>`
    : '';

  if (!upcoming.length) {
    host.innerHTML = `
      <div class="tour__none">
        <p class="tour__none-lead">No dates announced right now.</p>
        <p class="tour__none-sub">
          He tours in bursts and shows tend to sell out fast, so the useful move
          is to set an alert rather than keep checking. These three will email
          you the day something goes on sale.
        </p>
        <div class="tour__alerts">${alerts}</div>
      </div>
      ${wireBlock}`;
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
          ${d.url ? `<a class="btn btn--sm" href="${esc(d.url)}" target="_blank" rel="noopener">Tickets</a>` : '<span class="mono">TBA</span>'}
        </li>`
        )
        .join('')}
    </ol>
    ${wireBlock}
    <div class="tour__alerts tour__alerts--after">
      <span class="mono">Get told about new dates</span>${alerts}
    </div>`;
}

/* ─── discography ────────────────────────────────────────────────────── */

function renderDiscography() {
  const releases = DATA.releases || [];
  $('[data-disco-count]').textContent = releases.length;

  $('[data-disco]').innerHTML = releases
    .map(
      (r) => `
      <a class="rel" href="${esc(r.url || '#')}" target="_blank" rel="noopener"
         data-kind="${esc(r.kind)}">
        <div class="rel__art">
          <img src="${esc(r.artSmall || r.art)}" alt="${esc(tidy(r.title))} cover art"
               width="600" height="600" loading="lazy" decoding="async">
          <span class="rel__kind">${esc(r.kind)}</span>
        </div>
        <h3 class="rel__title">${esc(tidy(r.title))}</h3>
        <p class="rel__year">${esc(dotted(r.date))}</p>
      </a>`
    )
    .join('');

  // Filters, derived from whatever kinds actually exist in the data.
  const kinds = ['All', ...new Set(releases.map((r) => r.kind))];
  const bar = $('[data-filters]');
  bar.innerHTML = kinds
    .map(
      (k, i) =>
        `<button type="button" data-kind="${esc(k)}" aria-pressed="${i === 0}">${esc(k)}</button>`
    )
    .join('');

  // Filtering and collapsing both want to control visibility, so one function
  // owns it and derives every card's state from (activeKind, expanded).
  // Letting them each toggle `hidden` independently would have them undo
  // each other — filter to "Album" and the collapsed tail reappears.
  const CAP = 10;
  const host = $('[data-disco]');
  let activeKind = 'All';
  let expanded = false;

  const more = document.createElement('div');
  more.className = 'more';
  more.innerHTML = `
    <button type="button" aria-expanded="false">
      <span></span>
      <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2"/></svg>
    </button>
    <span class="more__line"></span>`;
  host.after(more);

  const btn = more.querySelector('button');
  const btnLabel = btn.querySelector('span');

  const apply = () => {
    const cards = [...host.children];
    const matching = cards.filter(
      (c) => activeKind === 'All' || c.dataset.kind === activeKind
    );

    cards.forEach((c) => { c.hidden = true; });
    (expanded ? matching : matching.slice(0, CAP)).forEach((c) => {
      c.hidden = false;
    });

    more.hidden = matching.length <= CAP;
    btn.setAttribute('aria-expanded', String(expanded));
    btnLabel.textContent = expanded
      ? 'Show less'
      : `Show all ${matching.length} releases`;
  };

  btn.addEventListener('click', () => {
    expanded = !expanded;
    apply();
    if (!expanded) host.scrollIntoView({ block: 'nearest' });
  });

  bar.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    activeKind = b.dataset.kind;
    expanded = false;
    $$('button', bar).forEach((x) =>
      x.setAttribute('aria-pressed', String(x === b))
    );
    apply();
  });

  apply();
}

/* ─── PRESS IT ───────────────────────────────────────────────────────── */

function renderPressIt() {
  const p = DATA.pressIt;
  if (!p) return;

  if (p.release?.art) {
    $('[data-pressit-art]').src = p.release.art;
    $('[data-pressit-art-2]').src = p.release.art;
  }

  $('[data-pressit-date]').textContent = dotted(p.release?.date || p.released);
  $('[data-pressit-concept]').textContent = p.concept || '';
  $('[data-pressit-statement]').textContent = p.statement || '';

  // Marquee needs the list twice so the -50% loop is seamless.
  const words = p.words || [];
  $('[data-marquee]').innerHTML = [...words, ...words]
    .map((w) => `<span>${esc(w)}</span>`)
    .join('');

  $('[data-tracks]').innerHTML = (p.tracks || [])
    .map(
      (t) => `
      <li class="${t.lead ? 'lead' : ''}">
        <span class="n">${String(t.n).padStart(2, '0')}</span>
        <span class="t">${esc(t.title)}${t.kr ? `<small>${esc(t.kr)}</small>` : ''}</span>
        <span>${t.lead ? '<span class="tag">Title</span>' : t.note ? `<span class="mono">${esc(t.note)}</span>` : ''}</span>
      </li>`
    )
    .join('');

  $('[data-palette]').innerHTML = (p.palette || [])
    .map(
      (c) =>
        `<div><i style="background:${esc(c.hex)}"></i>${esc(c.name)}<br>${esc(c.hex)}</div>`
    )
    .join('');
}

/**
 * Moodboard: probe assets/moodboard/01.jpg … 20.jpg and render only the ones
 * that actually resolve. Drop files in the folder and they show up — no
 * manifest to maintain, nothing to rebuild.
 */
function loadMoodboard() {
  const exts = ['jpg', 'jpeg', 'png', 'webp', 'avif'];
  const grid = $('[data-moodboard]');
  const wrap = $('[data-moodboard-wrap]');

  const probe = (n) =>
    new Promise((resolve) => {
      let i = 0;
      const tryNext = () => {
        if (i >= exts.length) return resolve(null);
        const src = `assets/moodboard/${String(n).padStart(2, '0')}.${exts[i++]}`;
        const img = new Image();
        img.onload = () => resolve(src);
        img.onerror = tryNext;
        img.src = src;
      };
      tryNext();
    });

  // Walk the numbers in order and stop at the first gap. Probing all 20 slots
  // up front cost 100 requests on every load of an empty folder; this costs 5.
  (async () => {
    const hits = [];
    for (let n = 1; n <= 20; n++) {
      const src = await probe(n);
      if (!src) break;
      hits.push(src);
    }
    if (!hits.length) return; // stays hidden — the CSS-native section stands alone
    grid.innerHTML = hits
      .map(
        (src) =>
          `<figure><img src="${esc(src)}" alt="Press It era moodboard image" loading="lazy" decoding="async"></figure>`
      )
      .join('');
    wrap.hidden = false;
  })();
}

/* ─── videos ─────────────────────────────────────────────────────────── */

function renderVideos() {
  const vids = DATA.videos || [];
  const host = $('[data-videos]');
  if (!vids.length) return void (host.innerHTML = '<p class="empty">No videos found.</p>');

  host.innerHTML = vids
    .slice(0, 9)
    .map(
      (v) => `
      <a class="vid" href="${esc(v.url)}" target="_blank" rel="noopener">
        <div class="vid__thumb">
          <img src="${esc(v.thumb)}" alt="" width="480" height="270"
               loading="lazy" decoding="async" data-fallback="${esc(v.id)}">
          <span class="vid__play" aria-hidden="true">
            <span><svg viewBox="0 0 24 24" width="18" height="18" fill="#F4F1EA"><path d="M8 5v14l11-7z"/></svg></span>
          </span>
        </div>
        <h3 class="vid__title">${esc(v.title)}</h3>
        <p class="rel__year">${esc(dotted(v.date))}</p>
      </a>`
    )
    .join('');

  // Thumbnail fallback is wired here rather than as an inline `onerror`.
  // An inline handler nests JS inside an HTML attribute, so the browser
  // entity-decodes before the JS parses: an id containing a quote would come
  // back out of `&#39;` as a real quote and break out of the string. Escaping
  // cannot fix a double context — the fix is not to create one.
  host.addEventListener('error', (e) => {
    const img = e.target;
    if (img.tagName !== 'IMG' || !img.dataset.fallback) return;
    const id = img.dataset.fallback;
    delete img.dataset.fallback; // one retry only, never a loop
    if (/^[\w-]{6,20}$/.test(id)) {
      img.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    }
  }, true); // capture: `error` on <img> does not bubble

  collapse(host, 4, 'videos');
}

/* ─── news ───────────────────────────────────────────────────────────── */

function renderNews() {
  const news = DATA.news || [];
  const host = $('[data-news]');
  if (!news.length) return void (host.innerHTML = '<li class="empty">No headlines right now.</li>');

  host.innerHTML = news
    .slice(0, 12)
    .map(
      (n) => `
      <li>
        <a href="${esc(n.url)}" target="_blank" rel="noopener">
          <span class="date">${esc(fmtDate(n.date, { month: 'short', day: '2-digit', year: '2-digit' }))}</span>
          <span class="head">${esc(n.title)}</span>
          <span class="outlet">${esc(n.outlet || '')}</span>
        </a>
      </li>`
    )
    .join('');

  collapse(host, 6, 'headlines');
}

/* ─── timeline ───────────────────────────────────────────────────────── */

function renderTimeline() {
  const items = [...(DATA.timeline || [])].reverse(); // newest first
  const host = $('[data-timeline]');
  host.innerHTML = items
    .map(
      (t) => `
      <li class="${t.highlight ? 'hl' : ''}">
        <span class="yr">${esc(t.year)}</span>
        <div class="body">
          <h3>${esc(t.title)}</h3>
          <p>${esc(t.body)}</p>
          ${t.tag ? `<span class="tag">${esc(t.tag)}</span>` : ''}
        </div>
      </li>`
    )
    .join('');

  collapse(host, 6, 'milestones');
}

/* ─── facts ──────────────────────────────────────────────────────────── */

function renderFacts() {
  const facts = DATA.facts || [];
  if (!facts.length) return;

  const quote = $('[data-fact]');
  const count = $('[data-fact-count]');
  let i = Math.floor(Math.random() * facts.length);
  let timer;

  const paint = () => {
    quote.classList.add('is-out');
    setTimeout(() => {
      quote.textContent = facts[i];
      count.textContent = `${String(i + 1).padStart(2, '0')} / ${String(facts.length).padStart(2, '0')}`;
      quote.classList.remove('is-out');
    }, 400);
  };

  const go = (step) => {
    i = (i + step + facts.length) % facts.length;
    paint();
    clearInterval(timer);
    timer = setInterval(() => go(1), 9000);
  };

  $('[data-fact-next]').addEventListener('click', () => go(1));
  $('[data-fact-prev]').addEventListener('click', () => go(-1));

  quote.textContent = facts[i];
  count.textContent = `${String(i + 1).padStart(2, '0')} / ${String(facts.length).padStart(2, '0')}`;
  timer = setInterval(() => go(1), 9000);
}

/* ─── footer ─────────────────────────────────────────────────────────── */

function renderFooter() {
  $('[data-links]').innerHTML = (DATA.links || [])
    .map(
      (l) =>
        `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`
    )
    .join('');
}

/* ─── behaviour ──────────────────────────────────────────────────────── */

function initReveal() {
  const targets = $$('[data-reveal]');
  if (!('IntersectionObserver' in window)) {
    return targets.forEach((t) => t.classList.add('is-in'));
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.08 }
  );
  targets.forEach((t) => io.observe(t));
}

/** Hide the nav on the way down, bring it back on the way up. */
function initNav() {
  const nav = $('#nav');
  let last = window.scrollY;

  addEventListener(
    'scroll',
    () => {
      const y = window.scrollY;
      nav.classList.toggle('nav--hidden', y > last && y > 400);
      last = y;
    },
    { passive: true }
  );

  // Highlight whichever section is on screen.
  const links = $$('.nav__links a');
  const sections = links
    .map((a) => $(a.getAttribute('href')))
    .filter(Boolean);

  if (!sections.length || !('IntersectionObserver' in window)) return;

  const spy = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        links.forEach((a) =>
          a.classList.toggle('is-active', a.getAttribute('href') === `#${e.target.id}`)
        );
      }
    },
    { rootMargin: '-45% 0px -50% 0px' }
  );
  sections.forEach((s) => spy.observe(s));
}

/**
 * Cursor spotlight over the hero: the greyscale layer is him, the red mirrored
 * layer underneath is the other him. Moving the cursor picks which one you see.
 */
function initSpotlight() {
  const hero = $('.hero');
  if (!hero || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!matchMedia('(hover: hover)').matches) return;

  let raf = null;
  let target = { x: 50, y: 50, r: 0 };
  let current = { x: 50, y: 50, r: 0 };

  const tick = () => {
    current.x += (target.x - current.x) * 0.12;
    current.y += (target.y - current.y) * 0.12;
    current.r += (target.r - current.r) * 0.09;
    hero.style.setProperty('--spot-x', `${current.x}%`);
    hero.style.setProperty('--spot-y', `${current.y}%`);
    hero.style.setProperty('--spot-r', `${current.r}px`);
    raf =
      Math.abs(target.r - current.r) > 0.5 ||
      Math.abs(target.x - current.x) > 0.1 ||
      Math.abs(target.y - current.y) > 0.1
        ? requestAnimationFrame(tick)
        : null;
  };

  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };

  // Cache the box rather than measuring on every pointermove — reading layout
  // inside a high-frequency handler forces a reflow per event.
  let box = hero.getBoundingClientRect();
  const remeasure = () => { box = hero.getBoundingClientRect(); };
  addEventListener('resize', remeasure, { passive: true });
  addEventListener('scroll', remeasure, { passive: true });

  hero.addEventListener('pointermove', (e) => {
    target = {
      x: ((e.clientX - box.left) / box.width) * 100,
      y: ((e.clientY - box.top) / box.height) * 100,
      r: Math.min(box.width, box.height) * 0.34,
    };
    kick();
  }, { passive: true });

  hero.addEventListener('pointerleave', () => { target.r = 0; kick(); });
}

boot();
