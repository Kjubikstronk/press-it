/**
 * PRESS IT — data builder.
 *
 * Hits every source, merges the results, writes data/site.json.
 * No API keys. No dependencies. Node 18+.
 *
 * Design rule: this runs unattended on a schedule, so a source being down
 * must never blank out a section. Every fetch is wrapped, and anything that
 * fails falls back to whatever we already had on disk.
 *
 *   node build.js
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'data', 'site.json');

const SOURCES = {
  itunesArtist: '971826499',
  deezerArtist: '7988496',
  youtubeChannel: 'UCa2YkG6KvkGXJd5UmvZbXGw',
  musicbrainzArtist: '48652da5-f54c-4f65-9c11-0fc05df18075',
  wikipediaPage: 'Taemin',
  tourSite: 'https://taemintour.com/',
};

/* Which leg a stop belongs to. The tour site groups stops under filter
   buttons, but the buttons are client-side and the rows carry no leg of
   their own, so the grouping has to be rebuilt from the country. Anything
   unrecognised lands in "More" and is named in the build log rather than
   being dropped — a new continent should be visible, not silently missing. */
const LEG_BY_COUNTRY = {
  'Korea': 'Asia', 'South Korea': 'Asia', 'Japan': 'Asia', 'Taiwan': 'Asia',
  'Hong Kong': 'Asia', 'Singapore': 'Asia', 'Thailand': 'Asia',
  'Philippines': 'Asia', 'Indonesia': 'Asia', 'Malaysia': 'Asia', 'Macau': 'Asia',
  'U.S.A': 'North America', 'U.S.A.': 'North America', 'USA': 'North America',
  'US': 'North America', 'Canada': 'North America',
  'Mexico': 'Latin America', 'Chile': 'Latin America', 'Peru': 'Latin America',
  'Brazil': 'Latin America', 'Argentina': 'Latin America',
  'Colombia': 'Latin America',
  'France': 'Europe', 'Germany': 'Europe', 'UK': 'Europe',
  'United Kingdom': 'Europe', 'Netherlands': 'Europe', 'Spain': 'Europe',
  'Italy': 'Europe', 'Poland': 'Europe', 'Sweden': 'Europe',
  'Belgium': 'Europe', 'Portugal': 'Europe', 'Switzerland': 'Europe',
  'Australia': 'Oceania', 'New Zealand': 'Oceania',
};

const LEG_ORDER = ['Asia', 'North America', 'Latin America', 'Europe', 'Oceania', 'More'];

const UA = 'PressIt-Fanpage/1.0 (+https://github.com/) static-site-builder';

/* ── plumbing ─────────────────────────────────────────────────────────── */

const log = {
  ok: (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`),
  warn: (m) => console.log(`  \x1b[33m!\x1b[0m ${m}`),
  step: (m) => console.log(`\n\x1b[1m${m}\x1b[0m`),
};

async function grab(url, { as = 'json', timeout = 20000, retries = 2 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { 'User-Agent': UA, Accept: '*/*' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = as === 'json' ? await res.json() : await res.text();
      return body;
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Run a source, but never let it take the build down. */
async function source(name, fn, fallback) {
  try {
    const value = await fn();
    const n = Array.isArray(value) ? value.length : value ? 1 : 0;
    if (!n) throw new Error('empty result');
    log.ok(`${name} — ${Array.isArray(value) ? `${n} items` : 'ok'}`);
    return value;
  } catch (err) {
    log.warn(`${name} failed (${err.message}) — keeping previous data`);
    return fallback ?? (Array.isArray(fallback) ? [] : null);
  }
}

/* Minimal XML helpers. These feeds are well-formed and stable; pulling in a
   parser dependency would be more risk than it removes. */
const tags = (xml, tag) => [
  ...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g')),
].map((m) => m[1]);

const tag1 = (xml, tag) => tags(xml, tag)[0] ?? '';

const attr = (xml, tag, name) =>
  xml.match(new RegExp(`<${tag}[^>]*\\b${name}="([^"]*)"`))?.[1] ?? '';

const clean = (s = '') =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

const iso = (d) => {
  const t = new Date(d);
  return Number.isNaN(+t) ? null : t.toISOString().slice(0, 10);
};

/** Apple serves any square size off the same path. */
const art = (url, size) =>
  (url || '').replace(/\/\d+x\d+bb\.(jpg|png)/, `/${size}x${size}bb.$1`);

/** Strip the K-pop release-title boilerplate so two sources can be matched. */
const fingerprint = (title = '') =>
  title
    .toLowerCase()
    .replace(/\s*[-–—]\s*(single|ep)$/i, '')
    .replace(/\s*[-–—]?\s*the\s+\d+(st|nd|rd|th)\s+(mini\s+)?album.*$/i, '')
    .replace(/\s*\((original|deluxe|special|remixes?)[^)]*\)/gi, '')
    // The two catalogues spell the same OST/remix release differently.
    .replace(/\b(original\s+)?(television|webtoon|motion picture)?\s*soundtrack\b/g, '')
    .replace(/\bost\b/g, '')
    .replace(/\bremix(es)?\b/g, '')
    .replace(/\bpart\b/g, 'pt')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .trim();

/* ── sources ──────────────────────────────────────────────────────────── */

async function itunesReleases() {
  const r = await grab(
    `https://itunes.apple.com/lookup?id=${SOURCES.itunesArtist}&entity=album&limit=200&country=US`
  );
  return (r.results || [])
    .filter((x) => x.wrapperType === 'collection' && x.releaseDate)
    .map((x) => ({
      id: `itunes-${x.collectionId}`,
      title: x.collectionName,
      date: iso(x.releaseDate),
      trackCount: x.trackCount,
      art: art(x.artworkUrl100, 1400),
      artSmall: art(x.artworkUrl100, 600),
      url: x.collectionViewUrl,
      copyright: x.copyright || null,
      genre: x.primaryGenreName || null,
      via: 'apple',
    }));
}

async function deezerReleases() {
  const r = await grab(
    `https://api.deezer.com/artist/${SOURCES.deezerArtist}/albums?limit=100`
  );
  return (r.data || [])
    .filter((x) => x.release_date)
    .map((x) => ({
      id: `deezer-${x.id}`,
      title: x.title,
      date: iso(x.release_date),
      trackCount: x.nb_tracks || null,
      art: x.cover_xl || x.cover_big || null,
      artSmall: x.cover_big || x.cover_medium || null,
      url: x.link,
      recordType: x.record_type || null,
      via: 'deezer',
    }));
}

async function topSongs() {
  const r = await grab(
    `https://itunes.apple.com/lookup?id=${SOURCES.itunesArtist}&entity=song&limit=30&country=US`
  );
  return (r.results || [])
    .filter((x) => x.wrapperType === 'track' && x.trackName)
    .map((x) => ({
      title: x.trackName,
      album: x.collectionName,
      date: iso(x.releaseDate),
      art: art(x.artworkUrl100, 600),
      preview: x.previewUrl || null,
      url: x.trackViewUrl,
      ms: x.trackTimeMillis || null,
    }))
    .slice(0, 12);
}

async function videos() {
  const xml = await grab(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${SOURCES.youtubeChannel}`,
    { as: 'text' }
  );
  return tags(xml, 'entry').map((e) => {
    const id = clean(tag1(e, 'yt:videoId'));
    return {
      id,
      title: clean(tag1(e, 'title')),
      date: iso(clean(tag1(e, 'published'))),
      url: `https://www.youtube.com/watch?v=${id}`,
      thumb:
        attr(e, 'media:thumbnail', 'url') ||
        `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
      // Deliberately no view count. The feed carries one, but it ticks up
      // every few minutes, so storing it would make the "did anything
      // change?" check true on every single run and the scheduled job would
      // commit around the clock. Nothing renders it either.
    };
  });
}

async function news() {
  const xml = await grab(
    'https://news.google.com/rss/search?q=Taemin+kpop&hl=en-US&gl=US&ceid=US:en',
    { as: 'text' }
  );
  const seen = new Set();
  return tags(xml, 'item')
    .map((it) => {
      const raw = clean(tag1(it, 'title'));
      // Google appends " - Publisher" to every headline.
      const split = raw.lastIndexOf(' - ');
      return {
        title: split > 20 ? raw.slice(0, split) : raw,
        outlet: split > 20 ? raw.slice(split + 3) : clean(tag1(it, 'source')),
        date: iso(clean(tag1(it, 'pubDate'))),
        url: clean(tag1(it, 'link')),
      };
    })
    .filter((n) => {
      if (!n.title || !n.date) return false;
      const k = n.title.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 24);
}

/**
 * Live-show announcements, scraped out of the news wire.
 *
 * Every actual tour API is now closed: Bandsintown 403s without a registered
 * app_id, Songkick and Ticketmaster want keys, and both sites block scrapers.
 * MusicBrainz only carries historical award shows.
 *
 * But announcements get *reported*, and the news feed is already keyless — the
 * Romania and Poland festival dates both surfaced as articles first. So this
 * runs a second, show-shaped query and keeps the hits. It won't give exact
 * venue rows, but it means a new announcement lands on the site by itself,
 * which the curated list alone can't do.
 */
async function tourNews() {
  const q = encodeURIComponent(
    'Taemin (concert OR tour OR festival OR tickets OR lineup)'
  );
  const xml = await grab(
    `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`,
    { as: 'text' }
  );

  // Only keep headlines that actually sound like a show announcement —
  // the query alone drags in album reviews and chart pieces.
  const relevant =
    /\b(concert|tour|festival|tickets?|lineup|line-up|perform|stage|live in|announce)/i;

  const seen = new Set();
  return tags(xml, 'item')
    .map((it) => {
      const raw = clean(tag1(it, 'title'));
      const cut = raw.lastIndexOf(' - ');
      return {
        title: cut > 20 ? raw.slice(0, cut) : raw,
        outlet: cut > 20 ? raw.slice(cut + 3) : clean(tag1(it, 'source')),
        date: iso(clean(tag1(it, 'pubDate'))),
        url: clean(tag1(it, 'link')),
      };
    })
    .filter((n) => {
      if (!n.title || !n.date || !relevant.test(n.title)) return false;
      const k = n.title.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 6);
}

/**
 * The LiMiNaL run, read off the official tour site.
 *
 * This is the only scraped source here — everything else is a feed or an
 * API. It earns the exception because it is the *only* public place the
 * routing exists: no tour API is open (see tourNews above), the news feed
 * reports announcements days late and never carries venues, and the run was
 * being kept by hand, which is exactly how it went stale. Twelve cities with
 * no dates were listed here while the site itself had grown to seventeen
 * with venues and a Seoul on-sale.
 *
 * Scraping markup is brittle by nature, so this is written to fail safely:
 * it anchors on the row container and pulls each field by its own class, so
 * a field moving or vanishing costs that field rather than the row. If the
 * parse yields implausibly few stops the caller keeps whatever it already
 * had — a layout change must never empty the section.
 */
async function tourStops() {
  const html = await grab(SOURCES.tourSite, { as: 'text' });

  const text = (s = '') =>
    clean(s.replace(/<!--[\s\S]*?-->/g, '')).replace(/\s+/g, ' ').trim();
  const pick = (chunk, re) => {
    const m = chunk.match(re);
    return m ? text(m[1]) : null;
  };

  const rows = html
    .split(/<div class="flex items-center justify-between gap-4 border-b/)
    .slice(1)
    .map((chunk) => {
      const end = chunk.indexOf('</div></div>');
      const c = end > -1 ? chunk.slice(0, end) : chunk;

      const where = pick(c, /<span class="text-xl font-semibold[^"]*">([\s\S]*?)<\/span>/);
      if (!where) return null;

      // "Seoul, Korea" — the site writes city and country in one span.
      const split = where.lastIndexOf(',');
      const city = split > -1 ? where.slice(0, split).trim() : where;
      const country = split > -1 ? where.slice(split + 1).trim() : '';

      const link = c.match(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      const pill = pick(c, /<span class="shrink-0[^"]*">([\s\S]*?)<\/span>/);

      return {
        ...stopDate(pick(c, /<span class="text-sm font-medium[^"]*">([\s\S]*?)<\/span>/)),
        city,
        country,
        venue: pick(c, /<span class="text-sm text-white\/55[^"]*">([\s\S]*?)<\/span>/),
        status: link ? text(link[2]) : pill,
        url: link ? link[1] : null,
      };
    })
    .filter(Boolean);

  // Twelve cities were announced on day one, so anything near that count is
  // a real read and anything far below it is a broken selector.
  if (rows.length < 5) throw new Error(`only ${rows.length} stops parsed`);
  return rows;
}

/** "2026.09.18-20" -> three nights from the 18th. "2026.11.02" -> one date. */
function stopDate(raw) {
  if (!raw) return {};
  const m = raw.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})(?:\s*[-–—]\s*(\d{1,2}))?/);
  if (!m) return {};
  const [, y, mo, d, d2] = m;
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${y}-${pad(mo)}-${pad(d)}`;
  if (!d2 || Number(d2) <= Number(d)) return { date };
  return { date, end: `${y}-${pad(mo)}-${pad(d2)}`, nights: Number(d2) - Number(d) + 1 };
}

/** Group flat stops into legs, and describe the run in one honest sentence. */
function buildWorldTour(curatedWt, stops) {
  const unknown = new Set();
  const byLeg = new Map();

  for (const s of stops) {
    const leg = LEG_BY_COUNTRY[s.country] || 'More';
    if (leg === 'More') unknown.add(s.country || '(no country)');
    if (!byLeg.has(leg)) byLeg.set(leg, []);
    byLeg.get(leg).push(s);
  }
  if (unknown.size) {
    log.warn(`unmapped tour countries: ${[...unknown].join(', ')} — filed under "More"`);
  }

  const legs = LEG_ORDER.filter((n) => byLeg.has(n)).map((name) => ({
    name,
    cities: byLeg.get(name),
  }));

  const dated = stops.filter((s) => s.date).length;
  const onSale = stops.filter((s) => /on sale/i.test(s.status || '')).length;
  const countries = new Set(stops.map((s) => s.country).filter(Boolean)).size;

  const status = dated
    ? `${stops.length} cities across ${countries} countries. ` +
      `${dated} ${dated === 1 ? 'has a date and a venue' : 'have dates and venues'}` +
      (onSale ? `, and ${onSale === 1 ? 'one is' : `${onSale} are`} on sale.` : '.')
    : `${stops.length} cities are confirmed. No dates or venues yet.`;

  return { ...curatedWt, legs, status, stats: { cities: stops.length, countries, dated, onSale } };
}

/**
 * Feed the Live section from the run — but only the part you can act on.
 *
 * The first cut of this merged every dated stop, which listed the same
 * twelve rows in both sections and made the page read as though it were
 * padding. The two now answer genuinely different questions:
 *
 *   LiMiNaL  — the whole run: every city, dates and venues as confirmed.
 *   Live     — what you can buy a ticket for today.
 *
 * So only on-sale stops cross over, alongside the curated one-off bookings.
 * Nothing needs maintaining as legs go on sale: a stop moves into Live by
 * itself the moment taemintour.com stops saying "Coming Soon". The ones
 * still waiting are counted, not listed, so Live can point at the run
 * without repeating it.
 */
function mergeTourDates(curatedTour, stops) {
  const dated = stops.filter((s) => s.date);
  const onSale = dated.filter((s) => /on sale/i.test(s.status || ''));
  const waiting = dated.filter((s) => !/on sale/i.test(s.status || ''));

  const out = [...(curatedTour?.dates ?? [])];
  const seen = new Set(out.map((d) => `${d.date}|${(d.city || '').toLowerCase()}`));

  for (const s of onSale) {
    const key = `${s.date}|${s.city.toLowerCase()}`;
    if (seen.has(key)) continue; // a hand-checked entry wins
    seen.add(key);
    out.push({
      date: s.date,
      city: s.city,
      country: s.country,
      venue: s.venue || null,
      note: ['LiMiNaL world tour', s.nights ? `${s.nights} nights` : null]
        .filter(Boolean)
        .join(' · '),
      url: s.url || null,
    });
  }

  const sorted = waiting.map((s) => s.date).sort();

  return {
    ...curatedTour,
    dates: out.sort((a, b) => (a.date > b.date ? 1 : -1)),
    announced: sorted.length
      ? { count: sorted.length, from: sorted[0], to: sorted[sorted.length - 1] }
      : null,
  };
}

async function bio() {
  const r = await grab(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${SOURCES.wikipediaPage}`
  );
  return {
    extract: r.extract || null,
    url: r.content_urls?.desktop?.page || null,
  };
}

/* ── merge ────────────────────────────────────────────────────────────── */

/**
 * Apple has better artwork and catches releases Deezer misses; Deezer catches
 * a few Apple misses. Prefer Apple on collision, fill gaps from Deezer.
 *
 * `known` is whatever the last run stored. Both catalogues vary by region —
 * "Press Your Number (Japanese Version)" shows up from Europe but not from a
 * US runner — so anything seen once is kept. Without that the release count
 * flips back and forth depending on where the job happened to run, and the
 * scheduler commits every time it does. A release is a historical fact; an
 * archive shouldn't drop one because a shop stopped listing it.
 */
function mergeReleases(apple, deezer, known = []) {
  const byKey = new Map();
  const key = (r) => `${fingerprint(r.title)}|${(r.date || '').slice(0, 4)}`;

  for (const r of apple) byKey.set(key(r), r);

  for (const r of deezer) {
    const k = key(r);
    let hit = byKey.get(k);

    // Fall back to a same-day fuzzy match: the catalogues format the same
    // release differently often enough that exact keys miss (e.g. Apple's
    // "Navillera, Pt. 1 (Original Television Soundtrack)" vs Deezer's
    // "Navillera OST Part 1"). Two distinct releases sharing a date *and* a
    // long title prefix effectively doesn't happen.
    if (!hit) {
      const fp = fingerprint(r.title);
      hit = [...byKey.values()].find((c) => {
        if (c.date !== r.date) return false;
        const cf = fingerprint(c.title);
        if (cf.startsWith(fp) || fp.startsWith(cf)) return true;
        let i = 0;
        while (i < Math.min(cf.length, fp.length) && cf[i] === fp[i]) i++;
        return i >= 8;
      });
    }

    if (hit) {
      hit.recordType ??= r.recordType;
      hit.deezerUrl = r.url;
    } else {
      byKey.set(k, r);
    }
  }

  // Re-add anything a previous run found that today's fetch didn't return.
  let remembered = 0;
  for (const r of known) {
    const k = key(r);
    if (!byKey.has(k)) {
      byKey.set(k, r);
      remembered++;
    }
  }
  if (remembered) log.ok(`${remembered} release(s) carried over from last run`);

  return [...byKey.values()]
    .filter((r) => r.date && r.art)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((r) => ({
      ...r,
      kind: classify(r),
      year: r.date.slice(0, 4),
    }));
}

function classify(r) {
  const t = r.title.toLowerCase();
  if (/soundtrack|ost\b/.test(t)) return 'OST';
  if (/remix/.test(t)) return 'Remix';
  if (/\bsingle\b/.test(t) || r.recordType === 'single' || r.trackCount <= 3)
    return 'Single';
  if (/mini album|\bep\b/.test(t) || r.recordType === 'ep') return 'EP';
  return 'Album';
}

/* ── main ─────────────────────────────────────────────────────────────── */

/**
 * Rewrite the social-preview tags in index.html so a link posted anywhere
 * shows the newest cover art and names the newest release. Idempotent —
 * each run replaces the same attributes.
 */
async function stampHtml(site) {
  const file = path.join(ROOT, 'index.html');
  const r = site.latest;
  if (!r) return;

  const clean = (t) =>
    t.replace(/\s*[-–—]\s*(Single|EP)$/i, '')
     .replace(/\s*[-–—]\s*The\s+\d+(st|nd|rd|th)\s+(Mini\s+)?Album\b.*$/i, '')
     .trim() || t;

  const title = clean(r.title);
  const desc =
    `His latest is ${title}, out ${r.date}. A Taemin fan site that keeps ` +
    `its own discography (${site.stats.releaseCount} releases), videos and ` +
    `news up to date on its own.`;

  const swap = (html, attr, key, value) =>
    html.replace(
      new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=")[^"]*(")`, 'i'),
      (_, a, b) => a + value.replace(/"/g, '&quot;') + b
    );

  try {
    let html = await fs.readFile(file, 'utf8');
    const before = html;

    html = swap(html, 'property', 'og:image', r.art);
    html = swap(html, 'property', 'og:description', desc);
    html = swap(html, 'name', 'description', desc);
    html = swap(html, 'name', 'twitter:image', r.art);

    if (html !== before) {
      await fs.writeFile(file, html, 'utf8');
      log.ok('index.html — social tags stamped with latest release');
    }
  } catch (err) {
    log.warn(`could not stamp index.html (${err.message})`);
  }
}

/**
 * Write schema.org structured data into the page.
 *
 * This is the real modern equivalent of "tags": machine-readable facts a
 * search engine can trust, rather than keywords stuffed at a crawler.
 * `<meta name="keywords">` has been ignored by Google since 2009 and
 * stuffing is now a demotion signal, so it is deliberately absent.
 */
async function stampJsonLd(site, siteUrl) {
  const file = path.join(ROOT, 'index.html');
  const base = (siteUrl || '').replace(/\/+$/, '');

  const albums = site.releases
    .filter((r) => r.kind === 'Album' || r.kind === 'EP')
    .slice(0, 25)
    .map((r) => ({
      '@type': 'MusicAlbum',
      name: r.title
        .replace(/\s*[-–—]\s*(Single|EP)$/i, '')
        .replace(/\s*[-–—]\s*The\s+\d+(st|nd|rd|th)\s+(Mini\s+)?Album\b.*$/i, '')
        .trim(),
      datePublished: r.date,
      image: r.art,
      ...(r.url ? { url: r.url } : {}),
      ...(r.trackCount ? { numTracks: r.trackCount } : {}),
      albumReleaseType:
        r.kind === 'EP'
          ? 'https://schema.org/EPRelease'
          : 'https://schema.org/AlbumRelease',
    }));

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'MusicGroup',
    name: 'TAEMIN',
    alternateName: ['태민', 'Lee Tae-min', 'Taemin'],
    genre: ['K-Pop', 'Pop', 'R&B'],
    ...(base ? { url: base + '/' } : {}),
    ...(site.artist.bio ? { description: site.artist.bio } : {}),
    ...(site.latest?.art ? { image: site.latest.art } : {}),
    sameAs: [
      site.artist.bioUrl,
      ...site.links.map((l) => l.url),
    ].filter(Boolean),
    album: albums,
  };

  try {
    let html = await fs.readFile(file, 'utf8');
    const json = JSON.stringify(schema, null, 2);
    const next = html.replace(
      /(<script type="application\/ld\+json" data-schema>)[\s\S]*?(<\/script>)/,
      (_, a, b) => a + json + b
    );
    if (next !== html) {
      await fs.writeFile(file, next, 'utf8');
      log.ok(`structured data — MusicGroup + ${albums.length} albums`);
    }
  } catch (err) {
    log.warn(`could not write structured data (${err.message})`);
  }
}

/**
 * Generate sitemap.xml + robots.txt, and fill in canonical/og:url — but only
 * once the site actually has an address. Skipped silently while siteUrl is
 * blank so nothing ships with a placeholder domain baked in.
 */
async function stampSeo(site, siteUrl, lastmod) {
  if (!siteUrl) return;
  const base = siteUrl.replace(/\/+$/, '');

  // Only write when the bytes would actually differ, so re-running the build
  // doesn't churn files git would then want to commit.
  const put = async (name, body) => {
    const file = path.join(ROOT, name);
    try {
      if ((await fs.readFile(file, 'utf8')) === body) return false;
    } catch { /* not there yet */ }
    await fs.writeFile(file, body, 'utf8');
    return true;
  };

  // lastmod is when the content actually changed, not when the job happened
  // to run — using today's date would rewrite the sitemap every single day.
  const wrote = [];

  if (await put('sitemap.xml',
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${base}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`)) wrote.push('sitemap.xml');

  if (await put('robots.txt',
    `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`
  )) wrote.push('robots.txt');

  // Add canonical + og:url to the head if they aren't there yet.
  const file = path.join(ROOT, 'index.html');
  let html = await fs.readFile(file, 'utf8');
  const before = html;
  const canonical = `<link rel="canonical" href="${base}/">`;
  const ogUrl = `<meta property="og:url" content="${base}/">`;

  html = /rel="canonical"/.test(html)
    ? html.replace(/<link rel="canonical"[^>]*>/, canonical)
    : html.replace('<link rel="icon"', `${canonical}\n<link rel="icon"`);

  html = /og:url/.test(html)
    ? html.replace(/<meta property="og:url"[^>]*>/, ogUrl)
    : html.replace('<meta name="twitter:card"', `${ogUrl}\n<meta name="twitter:card"`);

  if (html !== before) {
    await fs.writeFile(file, html, 'utf8');
    wrote.push('canonical + og:url');
  }

  if (wrote.length) log.ok(`${wrote.join(', ')} → ${base}`);
}

/**
 * Read JSON tolerantly. Windows editors (Notepad, PowerShell's Set-Content)
 * happily write a UTF-8 BOM, which is invalid at the start of JSON and would
 * otherwise take the whole build down with a cryptic parse error.
 */
async function readJson(file) {
  const raw = await fs.readFile(file, 'utf8');
  return JSON.parse(raw.replace(/^﻿/, ''));
}

async function readPrevious() {
  try {
    return await readJson(OUT);
  } catch {
    return {};
  }
}

async function main() {
  console.log('\n\x1b[1m\x1b[7m  PRESS IT  \x1b[0m  building…');

  const prev = await readPrevious();
  const curated = await readJson(path.join(ROOT, 'content', 'curated.json'));

  log.step('Fetching sources');
  const [apple, deezer, songs, vids, press, shows, wiki, stops] = await Promise.all([
    source('Apple Music  discography', itunesReleases, []),
    source('Deezer       discography', deezerReleases, []),
    source('Apple Music  top songs', topSongs, prev.songs ?? []),
    source('YouTube      uploads', videos, prev.videos ?? []),
    source('Google News  headlines', news, prev.news ?? []),
    source('Google News  show announcements', tourNews, prev.tourNews ?? []),
    source('Wikipedia    bio', bio, prev.bio ?? null),
    /* The previous run's cities *are* the previous stops, so a failed fetch
       falls back to the last good routing rather than to the hand-written
       list, which is older than both. */
    source(
      'Tour site    LiMiNaL routing',
      tourStops,
      prev.worldTour?.legs?.flatMap((l) => l.cities || []) ?? null
    ),
  ]);

  log.step('Merging');
  let releases = mergeReleases(apple, deezer, prev.releases ?? []);
  if (!releases.length && prev.releases?.length) {
    log.warn('both discography sources failed — reusing previous');
    releases = prev.releases;
  }
  log.ok(`${releases.length} unique releases`);

  const latest = releases[0] ?? null;
  const pressItRelease =
    releases.find((r) => fingerprint(r.title) === 'pressit') ?? null;

  const debut = new Date('2008-05-25');
  const soloDebut = new Date('2014-08-18');
  const now = new Date();
  const years = (from) =>
    Math.floor((now - from) / (365.25 * 24 * 3600 * 1000));

  const site = {
    generated: new Date().toISOString(),
    artist: {
      name: 'TAEMIN',
      hangul: '태민',
      full: 'Lee Tae-min',
      bio: wiki?.extract ?? prev.bio?.extract ?? null,
      bioUrl: wiki?.url ?? null,
    },
    stats: {
      yearsSinceDebut: years(debut),
      yearsSinceSoloDebut: years(soloDebut),
      releaseCount: releases.length,
      albumCount: releases.filter((r) => r.kind === 'Album').length,
    },
    latest,
    releases,
    songs,
    videos: vids,
    news: press,
    bio: wiki ?? prev.bio ?? null,
    tour: stops?.length ? mergeTourDates(curated.tour, stops) : (curated.tour ?? null),
    ticketing: curated.ticketing ?? null,
    tourNews: shows,
    worldTour: stops?.length
      ? buildWorldTour(curated.worldTour ?? {}, stops)
      : (prev.worldTour ?? curated.worldTour ?? null),
    timeline: curated.timeline,
    facts: curated.facts,
    pressIt: { ...curated.pressIt, release: pressItRelease },
    links: curated.links,
  };

  // `generated` moves on every run, so compare everything *except* it. Without
  // this the scheduled job would commit four no-op changes a day forever.
  const substance = (o) => JSON.stringify({ ...o, generated: null });
  const changed = substance(site) !== substance(prev);

  log.step('Done');

  if (changed) {
    await fs.mkdir(path.dirname(OUT), { recursive: true });
    await fs.writeFile(OUT, JSON.stringify(site, null, 2), 'utf8');
    log.ok(`data/site.json — ${(JSON.stringify(site).length / 1024).toFixed(1)} kB`);
    if (latest) log.ok(`latest release: ${latest.title} (${latest.date})`);
  } else {
    log.ok('sources unchanged — data/site.json left alone');
  }

  // The stamped files derive from the fetched data *and* from curated.json,
  // so they get reconciled every run rather than only when a feed moved.
  // Editing siteUrl alone used to leave the sitemap and canonical tag
  // unwritten, because this used to sit behind the early return above.
  // Each of these is a no-op when the output already matches.
  const stamp = changed ? site.generated : (prev.generated ?? site.generated);
  await stampHtml(site);
  await stampJsonLd(site, curated.siteUrl);
  await stampSeo(site, curated.siteUrl, stamp.slice(0, 10));

  console.log('');
}

main().catch((err) => {
  console.error('\n\x1b[31mBuild failed:\x1b[0m', err);
  process.exit(1);
});
