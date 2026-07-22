# PRESS IT

An auto-updating TAEMIN archive. Monochrome, built around the duality concept
of the 2016 album.

The site refreshes itself: discography, videos and news are pulled from live
sources on a schedule, so it stays current without anyone touching it.

---

## Run it locally

```bash
npm run dev
```

That fetches fresh data and serves the site at <http://localhost:4173>.

Or the two steps separately:

```bash
node build.js
```

```bash
node serve.js
```

> Open it through the server, not by double-clicking `index.html` — the page
> loads `data/site.json` over `fetch`, which browsers block on `file://`.

There are **no dependencies**. `build.js` is plain Node using native `fetch`,
so there's nothing to install and nothing to rot.

---

## How the auto-updating works

`build.js` hits six sources and writes everything into `data/site.json`.
The page reads that one file at runtime.

| Source | Provides | Key needed |
|---|---|---|
| iTunes Search API | Discography, hi-res artwork | none |
| Deezer API | Discography cross-check | none |
| YouTube channel RSS | Latest videos | none |
| Google News RSS | Press coverage | none |
| Wikipedia REST | Biography | none |
| MusicBrainz | Release metadata | none |

**Nothing here needs an API key**, which is the whole point — there are no
credentials to expire, rotate, or leak, so the site can run unattended
indefinitely. (Spotify was the obvious candidate but removed keyless metadata
access in February 2026.)

### Resilience

The job runs unattended, so it's built to degrade rather than break:

- Every source is wrapped independently — one failing doesn't stop the build.
- A failed source falls back to the data already on disk, so a section never
  blanks out because a feed had a bad morning.
- Fetches retry twice with backoff and time out at 20s.
- If **nothing substantive changed**, no files are written at all. That keeps
  the scheduled job from committing four no-op changes a day.

### Deduplication

Apple and Deezer spell the same release differently — `Navillera, Pt. 1
(Original Television Soundtrack)` vs `Navillera OST Part 1`. `build.js`
normalises titles into a fingerprint, then falls back to a same-day fuzzy
match. Apple wins collisions (better artwork); Deezer fills the gaps.

---

## Going live on GitHub Pages

The repo is already initialised and committed. Two commands:

```bash
gh auth login
```

Pick **GitHub.com → HTTPS → Yes (authenticate git) → Login with a web
browser**. This is the only step that needs you personally — it's your
account.

```bash
powershell -ExecutionPolicy Bypass -File deploy.ps1
```

That creates the repo, pushes, enables Pages, grants the updater permission
to commit back, writes the live URL into `content/curated.json`, regenerates
the sitemap and canonical tags, and pushes again. It's safe to re-run — every
step checks whether it's already done.

The site lands at `https://YOUR-NAME.github.io/press-it/`. Pass
`-RepoName something-else` if you want a different name.

### If a step fails

The script tells you which one and what to click. The two that occasionally
need doing by hand:

- **Pages** — Settings → Pages → Deploy from a branch → `main` / `root`
- **Write permission** — Settings → Actions → General → Workflow permissions
  → Read and write

### Afterwards

```bash
gh workflow run "Update site data"
```

Runs the updater immediately instead of waiting for the next 6-hour tick.
Watch it under the repo's **Actions** tab.

That's it. `.github/workflows/update.yml` then runs every 6 hours, rebuilds the
data, and commits only when something actually changed — which republishes the
site automatically.

You can also trigger it by hand any time from the **Actions** tab
(*Update site data → Run workflow*).

---

## Editing content

Everything hand-written lives in [`content/curated.json`](content/curated.json)
— the timeline, the fun facts, the Press It statement and tracklist, the
footer links. It's plain JSON with no code in it, and the auto-updater never
overwrites it. Edit freely.

To add moodboard images, drop them in `assets/moodboard/` as `01.jpg`,
`02.jpg`, and so on — see the README in that folder. They appear on their own;
if the folder stays empty the section stays hidden.

---

## Layout

```
build.js                    the updater — all six sources
serve.js                    local preview server
content/curated.json        hand-written content (safe to edit)
data/site.json              generated — don't edit by hand
index.html                  page structure
assets/css/style.css        the whole design system
assets/js/app.js            renders the page from site.json
assets/moodboard/           drop your own images here
.github/workflows/update.yml  the every-6-hours job
```

---

## Long lists

Discography, videos, news and timeline all collapse to a preview with a
"Show all" toggle. Without it the page ran to 30 screens on a phone —
discography alone was 15 of them, because a 210px grid minimum collapses to a
single column at 375px. It's now 12 screens with a 2-column mobile grid.

Collapsed items get the `hidden` attribute, keeping them out of tab order and
the accessibility tree until revealed. The discography's filter and its collapse
both derive visibility from one function, since letting them each toggle
`hidden` independently made them undo each other.

---

## Design notes

Palette and type are fixed in the `:root` block of `style.css`:

- **Ink** `#0A0A0A`, **Bone** `#F4F1EA`, **Signal** `#C8102E`
- Anton (display) · Inter (body) · Space Mono (labels) · Noto Sans KR

The red is used once per section at most. The duality concept shows up three
times: the mirrored hero wordmark, the cursor spotlight that reveals a red
mirrored second image, and the split Press It cover that pulls apart on hover.

Album art renders greyscale and returns to colour on hover — which is why the
monochrome identity survives contact with real, very colourful cover art.

---

## Credits and rights

An unofficial fan project, not affiliated with TAEMIN, Galaxy Corporation or
SM Entertainment.

Artwork and metadata come from the Apple Music and Deezer catalogues and are
hotlinked from their CDNs rather than rehosted. Video and news items link back
to their sources. Nothing is scraped from behind a login and no personal data
is collected — there are no cookies and no analytics.
