# Getting people to actually see it

Notes on putting PRESS IT in front of people. The short version: the site has
one genuinely unusual hook — **it updates itself** — and that's what to lead
with. "I made a Taemin fansite" is a thing people scroll past. "I built a
Taemin archive that pulls new releases automatically the day they drop" is a
thing people click.

---

## Before you post anywhere

Do these first, or you'll burn your one good launch moment on a dead link.

- [ ] Site is live and loads on **mobile** — most social traffic is phone traffic.
- [ ] `siteUrl` filled into `content/curated.json`, then rebuild. That generates
      `sitemap.xml` / `robots.txt` and the canonical tags.
- [ ] Paste the URL into the
      [Twitter Card Validator](https://cards-dev.twitter.com/validator) and
      [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
      so the preview image is cached and correct before anyone shares it.
- [ ] Submit to [Google Search Console](https://search.google.com/search-console)
      — add the property, submit `sitemap.xml`. Indexing takes days to weeks,
      so do it early.
- [ ] Confirm the GitHub Action has run at least once on its own schedule.

The social preview pulls the **latest album art** automatically, so a link
posted the week of a comeback shows that comeback's cover. That's worth timing
around.

---

## Search: what actually works now

Short version: **the 2005 tag-spam playbook is dead, and doing it now actively
hurts you.**

- `<meta name="keywords">` has been ignored by Google since 2009. It does
  nothing. This site deliberately doesn't have one.
- Repeating "taemin taemin kpop taemin" in the page or in hidden text is
  *keyword stuffing*, which is an explicit spam policy violation and gets sites
  demoted or deindexed.

What replaced it is **structured data** — and that's already built in. Every
build writes a `schema.org` JSON-LD block into the page describing, in a form
a search engine can trust: that this is about the artist TAEMIN, also known as
태민 and Lee Tae-min, genre K-Pop, with 14 albums each carrying a name, release
date and cover, plus verified links to his Wikipedia, YouTube, Apple Music and
Spotify pages.

That last bit — `sameAs` — is what tells Google your page is about *the same
entity* as the official ones. It's the closest modern equivalent to what you
remember as "tags", except it's factual rather than aspirational.

Check it with the [Rich Results Test](https://search.google.com/test/rich-results)
once you're live.

### Be realistic about which searches you can win

You will **not** outrank Wikipedia, Spotify and his official channels for the
query `taemin`. Nobody new does; those are established entities with two
decades of authority.

What you can genuinely win is **long-tail** — specific questions where your
page is the best answer in existence:

- "taemin discography in order"
- "taemin latest release" / "taemin new song 2026"
- "when did taemin release press it"
- "taemin album list with covers"
- "taemin comeback history"

These have far less competition, and your auto-updating discography answers
them better than a static fan page ever could. Traffic from twenty long-tail
queries beats zero traffic from one impossible one.

### The three things that actually move the needle

1. **Freshness.** Google favours pages that genuinely change. Yours rebuilds
   every 6 hours on its own — that's a real, sustained advantage over the
   static fansites you're competing with, and it costs you nothing.
2. **Links from real places.** One mention from a K-pop community or blog is
   worth more than any on-page tweak. This is the actual reason the Reddit and
   Twitter work below matters — it isn't just direct traffic, it's authority.
3. **Being genuinely useful.** The single best SEO move available to you is
   answering a question nobody else answers as well.

### Domain choice

Available right now (checked against the registry, not a reseller):

| Domain | Read |
|---|---|
| `taemin.fyi` | Short, memorable, modern. My pick. |
| `taemin.wiki` | Signals "reference/archive" — matches what the site *is*, and reads as unofficial. |
| `taemin.today` | Leans into the auto-updating angle nicely. |
| `taemindaily.com` | A `.com`, and most searchable. Least distinctive. |
| `taemin.moe` | Fandom-native, playful. Less credible to a general audience. |

`taemin.com`, `.net` and `.link` are taken.

An exact-match domain is a **small** ranking factor now, not the lever it was
in 2005 — pick for memorability, because what you'll really be optimising is
whether someone can retype it after seeing it once in a tweet.

**One caution:** a domain with an artist's name is normal for a clearly-marked
fan site, but avoid anything implying officialness (`taeminofficial.*`,
`taemin-sm.*`). Keep the footer disclaimer. That distinction is what keeps a
fan project on the right side of a trademark complaint.

---

## Reddit

Reddit will give you the most traffic and is the easiest place to get banned.

**Read each subreddit's rules before posting. This is not boilerplate advice —
r/kpop in particular has an explicit self-promotion policy and removes most
fan-project posts.** Many K-pop subs require you to have participated for a
while before posting your own work, and some funnel all self-promo into a
weekly thread.

Where to go, in order of how well it'll land:

| Sub | Notes |
|---|---|
| r/shinee | Your core audience. Small, warm, most likely to actually care. |
| r/taemin | Even more targeted if it's active. |
| r/kpop | Big reach, strictest rules. Check the self-promo policy first. |
| r/kpophelp | Sometimes fine if you frame it as a resource answering a real need. |
| r/webdev, r/SideProject | Different angle entirely — post it as a *build*. The keyless-API and self-updating architecture is the interesting part here, not Taemin. |

How to post:

- **Be a person, not a billboard.** Comment in the sub for a couple of weeks
  first. A first-ever post that's a link to your own site reads as spam and
  gets treated as spam.
- **Say you made it.** Undisclosed self-promotion is the fastest way to get
  banned, and people are fine with it when you're upfront.
- **Screenshot posts beat link posts** in most subs. Lead with the Press It
  section — it's the most visually striking thing you have.
- **Never** use a second account to upvote or comment on your own post. Reddit
  detects it and it's an instant sitewide ban.
- Post when your audience is awake. For a Western K-pop audience that's roughly
  6–10pm ET on a weekday.

---

## Twitter / X

This is where K-pop fandom actually lives, and where the auto-updating angle
pays off repeatedly rather than once.

- Post the link **the day a comeback drops**. The preview card will already be
  showing the new cover art, which makes the "it updates itself" claim
  self-demonstrating.
- Tag the relevant hashtags — `#TAEMIN` `#태민` `#SHINee` plus whatever the
  comeback-specific tag is that week. The Korean tag matters; a lot of the
  fandom searches it.
- Reply to (don't hijack) big fan-account threads when someone asks "when did
  X come out" or "what's his discography order" — you have a link that answers
  that instantly. Genuinely useful replies travel further than announcements.
- A short screen-recording of the Press It hover effect will outperform a
  static screenshot.
- Pin your launch tweet.

---

## Instagram / TikTok

Visual-first platforms, so the site's design *is* the content.

- The Press It moodboard and the greyscale-to-colour discography grid are the
  two shareable visuals. Screen-record scrolling through them.
- Instagram doesn't do clickable links in captions — put the URL in your bio
  and say "link in bio", or use a Story link sticker.
- TikTok rewards short loops. A 6-second clip of the duality cover splitting
  apart on hover, with the album's title track over it, is the whole pitch.
- Add the URL as a text overlay in the video itself, since captions get lost.

---

## Longer game

- **Fan communities off the big platforms** — Discord servers, fansite
  networks, Tumblr. Smaller, but the people there are the ones who'll come
  back weekly.
- **Answer the questions the site answers.** Search "Taemin discography order",
  "Taemin comeback date" on Reddit and Quora and reply where it's genuinely
  useful. This trickles in traffic for years.
- **Let it update.** The whole advantage over a static fansite is that it stays
  correct with zero effort. A site that's still accurate in 2028 will
  out-rank ten that went stale in 2026.

---

## A few honest cautions

- **Don't imply it's official.** Keep the footer disclaimer. Fan sites that
  look official get taken down, and SM/Galaxy do issue takedowns.
- **Images you add yourself carry the most risk.** The album art on the page is
  hotlinked from Apple's catalogue, which is normal practice. Photos you add to
  `assets/moodboard/` are your call — fansite photographers usually attach an
  explicit "no edits, no reuploads" rule, and they do enforce it.
- **Don't buy followers, upvotes, or traffic.** It doesn't convert, and on
  Reddit and Instagram it gets the account actioned.
- **Expect a slow start.** The first post might get eleven upvotes. That's
  normal. The comeback-timed post is the one that moves.
