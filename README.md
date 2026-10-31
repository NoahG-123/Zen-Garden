# Zen Garden

A calm, text-first daily read on the world, for desktop (1024–1920 px, designed at 1440). It is a static site: plain HTML, CSS and JavaScript, no backend, no build step, no dependencies. Every word that changes comes from JSON in `/data`. The daily update rewrites those files and never touches the code.

The site is **light only** (one wallpaper, no dark mode) and renders everything as text.

## Files

| Path | What it is |
|---|---|
| `index.html` | The page shell: top bar with tabs, an empty `<main>`, a footer. |
| `styles.css` | All styling. The colour tokens sit at the top of the file. |
| `app.js` | Fetching, routing, rendering, citations, disclosures, scroll helpers. No content lives here. |
| `assets/wallpapers/light.jpg` | The full-bleed wallpaper. Replace the file to change the look; no code edit is needed. |
| `data/index.json` | The update time and the list of files that exist. |
| `data/world.json`, `events.json`, `canada.json`, `china.json`, `generation.json` | Sample content, each marked `"sample": true`. |
| `data/stress/*.json` | Shortest and longest World and Events fixtures, for design checks only. |

Fonts (Hanken Grotesk and Geist Mono) load from Google Fonts. If they are blocked, the page falls back to system fonts.

## Run it

Opening `index.html` directly (`file://`) blocks the data fetch, so serve the folder with any static server, then open the address it prints.

- Python: `python3 -m http.server 8000`, then http://localhost:8000
- Node (works on Windows): `npx http-server -p 8000`, then http://localhost:8000

To check the stress fixtures in the real app: `index.html?stress=short#world` or `index.html?stress=long#events`.

## Settings

All at the top of `app.js`:

| Constant | Default | Meaning |
|---|---|---|
| `DATA_BASE_URL` | `./data/` | Where the JSON lives. Point it at any folder or URL that serves the files, keeping the trailing slash. |
| `TZ` | `America/Toronto` | Time zone used for "today" and every time shown. |
| `STALE_HOURS` | `26` | A run older than this (or not from today) makes the run chip say **No update today**. |

## How loading works

1. `index.json` is fetched with `?t=<now>` and `cache: no-store`, so it is never cached.
2. Each tab file is fetched with `?v=<index.updated>`. When the daily update writes a new `updated` value, every browser gets the new files; until then they stay cached.
3. A tab shows a quiet skeleton while loading. If its file is not listed in `index.files`, returns an error, or is not valid JSON, the tab shows **Not updated yet**.
4. The run-status chip in the top bar is built from `index.json` alone (see below), so it is always current.
5. If the current tab's file has `"sample": true`, the top bar shows **Sample data**. Set it to `false` (or remove it) in real files.
6. After the first tab renders, the other tabs are fetched quietly so switching is instant.

`index.json`:

```json
{ "updated": "2026-10-12T06:30:00-04:00", "files": ["world.json", "events.json", "canada.json", "china.json", "generation.json"] }
```

### The run record in `index.json`

The morning task also writes a `run` object, shown as the **Today's run** card at the top of the World sidebar:

```json
"run": {
  "finished": "2026-10-16T05:52:00-04:00",
  "issues": [
    "Dropped “Port strike spreads to Rotterdam”: no source article could be verified.",
    "China: kept yesterday’s brief because today’s file was broken."
  ]
}
```

| State | What the card shows |
|---|---|
| `finished` is today and `issues` is empty | **Run successful · 5:52 am** |
| `finished` is today and `issues` has items | **Run finished · 5:52 am** and the list of issues |
| `finished` is an earlier day | **No update has run today. Last run: …** |
| no `run` object | **No run has been recorded yet.** |

`issues` lists only problems that changed what you see (a dropped topic, a file kept from yesterday, a tab left out). Style notes and warnings are not listed. Because `index.json` is never cached, the card is always current, even when a tab's own file is from an earlier day.

## Run-status chip

One component, in the top bar on every screen size. It reads only the `run` record in `index.json` (which is never cached). On desktop it replaces the old "Updated …" text; the **Today's run** card in the World sidebar stays on desktop and is hidden on phone and tablet.

| `run` record | Chip text |
|---|---|
| `finished` is today (America/Toronto), `issues` empty | ● **Updated 5:39 am** |
| `finished` is today, `issues` not empty | ● **Updated 5:39 am · 2 issues** |
| `finished` not today, or more than 26 hours old | ● **No update today** |
| no `run` record | **Not updated yet** |

The dot is green, amber or red, but the text always carries the meaning. Tapping the chip opens a small panel with the finish time and the list of issues (or **Run successful**). It closes on a tap outside or Esc.

## Phone and tablet layout

The same `index.html`, `app.js`, `styles.css` and JSON serve every device. Layout lives in CSS media queries; the few behaviour differences use `window.matchMedia("(max-width: 1023px)")` in `app.js`, and the page re-renders if the window crosses that line.

| Width | Layout |
|---|---|
| 1024 px and up | Desktop, unchanged. |
| 701–1023 px | The phone layout in one centred column (up to 720 px of content), with wider margins. Covers tablets and e-readers. |
| 360–700 px | Phone. Designed at 412 × 915 (Pixel 7). 20 px side margins. |

On phone and tablet:

- **Frame.** `viewport-fit=cover` with safe-area padding. A slim top bar holds the wordmark and the run chip. The desktop tabs are replaced by a fixed **bottom tab bar** (World, Events, Canada, China, Gen): 12 px labels, 56 px tall targets, current tab bold with a short underline. The page is padded so nothing sits under the bar. No full-screen wallpaper; the background is a plain soft grey-blue.
- **World.** The header (date and summary) sits over a soft strip of `light.jpg`, cropped to the mountains and fading into the page; the text sits above the strip, not on it. Event rows show **only** the headline in bold, the status pill and a chevron. Headlines wrap to as many lines as they need, rows are at least 56 px tall, and faint hairlines separate them. Tapping a row expands it in place (chevron rotates) to show the date, summary, Source article, Also reported by, the Part of chip and a **Read more** button for the full article. Only one row is open at a time, and the opened row's top is scrolled into view. Below the rows: Think about this, Today's read, This week's read (when present), then Sources. The sticky topic index is not shown.
- **Events.** Rows work as on desktop, with the status and "Added" date under the title. Inside an event, each fact's label sits above its text. Connects-to chips and notes work unchanged. The history reader becomes a chapter stepper: a chapter picker at the top, one chapter's text, Previous and Next, and "Chapter 3 of 7".
- **Canada, China, Generation.** One column; Further reading and Sources at the bottom.
- **Sources** sit at the bottom of every tab in the same compact scrollable box. There are no hover tooltips on touch screens; tapping a citation scrolls to its source and highlights it.
- **Type.** Body 16.5–17 px with line height about 1.6.

No data fields were added, renamed or removed for the phone layout.

## Navigation

Five tabs: **World**, **Events**, **Canada**, **China**, **Generation**. Tabs are links (`#world`, `#events`, `#canada`, `#china`, `#generation`) and can be deep-linked. Citation clicks and in-page jumps never change the address-bar hash.

## Layout

- **World:** a sticky topic index on the left, the header and event cards in the centre, and a right-hand side panel with *Think about this*, *Today's read*, *This week's read* and *Sources*.
- **Canada, China, Generation:** the brief in a main column with a narrow right-hand side panel for *Sources*.
- **Events:** a single centred column of expandable event cards.
- Below 1280 px the World layout collapses to fewer columns and the side panel moves under the content.
- No box has a fixed height. Boxes size to their content; the only exception is the Sources list, a compact scrollable box (about 340 px tall) so a long source list never becomes a long chain.

## Rendering rules

- All JSON is inserted with `textContent`. Raw HTML in the data is shown as plain text, never parsed.
- Links are only made for `http(s)` URLs; anything else is shown as plain text. External links open in a new tab with `noopener noreferrer`.
- **Citations.** `[^3]` anywhere in text becomes a superscript **3**. Hovering or focusing it shows a tooltip with the outlet and title. Clicking it glides the page (a gentle, slightly bouncy scroll) to entry 3 in the Sources list, scrolls the list to that entry, and highlights it for a couple of seconds. The article itself opens from the Sources entry. In Events, markers jump to that event's own Sources row. If the number has no matching source, it is shown without a link. Space before a marker is removed, so `calm [^1].` renders as "calm¹.".
- Empty or `null` optional fields (`differences`, `weeklyRead`, `reads`, `lead`, `alsoReported`, `connects`, …) hide their section entirely.
- **Disclosures** (Read more, Earlier changes, event rows) are real buttons with `aria-expanded` and `aria-controls`. They animate `grid-template-rows` from `0fr` to `1fr`, so they open to whatever height the content needs. Collapsed regions are `inert`.
- Reduced motion turns every transition, scroll glide and highlight animation off.

## Which element shows each field

### world.json  →  World tab
Each topic is ONE specific event from roughly the last 48 hours, not a general theme.

| Field | Shown as |
|---|---|
| `date` | Mono label at the top of the header panel ("Mon, Oct 12, 2026") |
| `summary` | Large sentence in the header panel |
| `topics[].id` | Anchor `#t-<id>`, used by the sticky index |
| `topics[].heading` | Event headline, plus its entry in the sticky left index |
| `topics[].date` | Event date, under the headline |
| `topics[].status` | Status tag next to the headline: `confirmed`, `developing` or `disputed` |
| `topics[].summary` | Always-visible text under the headline (2–3 sentences) |
| `topics[].lead` | **Source article** row directly under the summary: `title` link (new tab), `outlet`, `date`. Hidden if missing |
| `topics[].alsoReported[]` | Up to two quieter **Also reported by** links (`outlet`, `title`, `url`). Hidden if empty |
| `topics[].eventId` | A **Part of: [event title]** chip that opens and scrolls to that card in the Events tab. Shown only when the id exists in `events.json`; use `null` otherwise |
| `topics[].article[]` | Paragraphs revealed by **Read more** (collapsed by default) |
| `topics[].differences` | **Where reporting differs** box at the end of the article (hidden if null) |
| `question.type` / `.text` | **Think about this** card (type as a small tag) |
| `read` | **Today's read** card: `kind` tag, `minutes`, `title` link, `outlet`, `summary` |
| `weeklyRead` | Optional. A read here is shown in the **This week's read** card (same shape as `read`), but the daily task now keeps weekly reads in `weekly.json` and leaves this `null` |
| `sources[]` | Numbered **Sources** list in the side panel. `singleSource: true` adds a "single source" tag |

### weekly.json  →  **This week's read** card (World tab)

Optional file, not listed in `index.json`. The site fetches it by itself and works without it. Written on Sundays only: the new read goes on top, entries older than 35 days are removed, and about five (a month) are kept.

```json
{ "reads": [
  { "date": "2026-11-01", "title": "…", "outlet": "…", "url": "https://…", "kind": "paper", "minutes": 30, "summary": "…" },
  { "date": "2026-10-25", "title": "…", "outlet": "…", "url": "https://…", "kind": "analysis", "minutes": 40, "summary": "…" }
] }
```

The card shows the newest read. With more than one, the card's window stays exactly as tall as the newest read, and earlier reads scroll below it, like the Sources list. A small counter ("1 / 3 ↓") shows where you are, and each read carries its Sunday date. The same card is used on phone and desktop.

```json
"topics": [ {
  "id": "riyadh-airport-attack", "heading": "…", "date": "2026-10-08", "status": "developing",
  "summary": "…",
  "lead": { "title": "…", "outlet": "…", "url": "…", "date": "2026-10-09" },
  "alsoReported": [ { "title": "…", "outlet": "…", "url": "…" } ],
  "eventId": "iran-war",
  "article": ["paragraph with a citation [^1]", "paragraph"],
  "differences": "…"
} ]
```

### events.json  →  Events tab
| Field | Shown as |
|---|---|
| `reviewed` | "Reviewed Oct 11, 2026" label in the header |
| `changes[0]` | **Recent change** line |
| `changes[1…]` | Behind **Earlier changes (n)** |
| `events[].title`, `.status`, `.added` | The collapsed row: number, title, status tag, "Added …". Status is `escalating`, `shifting`, `winding-down` or `stalled` |
| `.id` | Anchor `#ev-<id>`; also the value World topics use in `eventId` |
| `.whyHere` | Why it's here |
| `.standing` | Where it stands |
| `.heading.likely / .possible / .unlikely` | Where it's heading (three lines) |
| `.watch[]` | What to watch: `date` and `what` |
| `.connects[]` | **Connects to** chips, each `{ "id": "<event id>", "why": "<one sentence>" }`. Clicking a chip opens a small note with the `why` and a "Jump to …" line that opens and scrolls to that event. Clicking again or pressing Esc closes it. A plain id string still works (the note then shows only the jump line) |
| `.removeWhen` | What would remove it |
| `.history[]` | Full history reader: chapter list (`heading`, `period`) on the left, chapter `paragraphs` on the right, Previous/Next, "Chapter 3 of 7" |
| `.goDeeper[]` | Go deeper cards: `kind` tag, `title` link, `outlet`, `summary` |
| `.sources[]` | Ids into the top-level `sources` list, shown as that event's own Sources row |
| `sources[]` | Shared source list; `[^n]` in any event text jumps to the matching row |

**Changes often:** `standing`, `heading`, `watch` (and `status`, plus a new `changes` entry when an event moves).
**Grows over time:** `history`. Append new chapters at the end and update the last chapter's `period` (for example "2025-now"). Never rewrite older chapters. The reader handles 4–10 chapters.

### canada.json / china.json  →  Canada and China tabs
| Field | Shown as |
|---|---|
| `date`, `summary` | Header panel |
| `body[]` | The brief's paragraphs (1–4, no subheadings) |
| `differences` | **Where reporting differs** box (hidden if null) |
| `reads[]` (max 2) | **Further reading**: `kind` tag, `title` link, `outlet`, `summary` |
| `sources[]` | Sources list in the side panel |

### generation.json  →  Generation tab
| Field | Shown as |
|---|---|
| `updated` | "This month · October 2026" label |
| `topic`, `intro` | Header panel |
| `data[]` | **What the data says**: `stat` in bold with a superscript link to `source` (a source id), `detail` below |
| `why[]` | **Why it spreads**: `claim`, `evidence` tag (`measured`, `plausible` or `contested`), `detail` |
| `test[]` | **How to test a claim**: numbered list |
| `sources[]` | Sources list in the side panel |

### Source objects (every file)
`{ "id": 1, "outlet": "Reuters", "title": "…", "url": "https://…", "date": "2026-10-11", "singleSource": false }`. The `id` is the number used in `[^n]` markers and must be unique within its file.

## States

- **Loading:** a skeleton that matches the tab's layout.
- **File missing or invalid:** "Not updated yet" panel.
- **Stale:** the run chip says **No update today** when the last run is not from today or is more than 26 hours old.
- **Sample data:** a "Sample data" flag in the top bar.
- **Empty fields:** the section disappears; nothing shows a blank placeholder.
- **Stress tests:** shortest and longest content for World and Events, in `data/stress/`.

## Notes on the sample data

The sample files are placeholders for layout only. The Events history is real background, but the "today" text is illustrative, and most source links point to outlet section pages rather than specific articles. The stress fixtures use invented stories so they can be sized to the content limits exactly.

## Accessibility

- Semantic headings throughout; one `h1` per view.
- Every disclosure is a real `<button>` with `aria-expanded` and `aria-controls`; collapsed regions are `inert`.
- Focus is always visible and every action works from the keyboard. The connection note closes with Esc.
- Citation markers have descriptive labels ("Source 3: Outlet, Title. Jump to source"); external links announce that they open in a new tab.
- Panel opacity was chosen so body text meets WCAG AA over the wallpaper.
- Reduced-motion preferences are respected.
- A "Skip to content" link is the first focusable element.