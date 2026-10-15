# Zen Garden

A calm, text-first daily read on the world, for desktop (1024–1920 px, designed at 1440). It is a static site with no backend and no build step. Every word that changes comes from JSON in `/data`. The morning task rewrites those files and never touches the code.

## Files

| Path | What it is |
|---|---|
| `index.html` | The page shell: top bar, tabs, an empty `<main>`. |
| `styles.css` | All styling. The colour tokens sit at the top. The site is light-only. |
| `app.js` | Fetching, rendering, routing, citations and disclosures. No content lives here. |
| `assets/wallpapers/light.jpg` | The full-bleed wallpaper. Replace the file to change the look; no code edit is needed. |
| `data/index.json` | The update time and the list of files that exist. |
| `data/world.json`, `events.json`, `canada.json`, `china.json`, `generation.json` | Sample content (`"sample": true`). |
| `data/stress/*.json` | Shortest and longest World and Events fixtures, used for design checks only. |

## Settings

`DATA_BASE_URL` is the first constant in `app.js` (default `./data/`). Point it at any folder or URL that serves the JSON, keeping the trailing slash.

Other settings next to it: `TZ` (America/Toronto) and `STALE_HOURS` (36).

## How loading works

1. `index.json` is fetched with `?t=<now>` and `cache: no-store`, so it is never cached.
2. Each tab file is fetched with `?v=<index.updated>`. When the morning task writes a new `updated` value, every browser gets the new files, and the files stay cached until then.
3. A tab shows a quiet skeleton while loading. If its file isn't listed in `index.files`, returns an error, or isn't valid JSON, the tab shows **Not updated yet**.
4. If `updated` is more than 36 hours old, the top bar adds **· may be out of date**.
5. If the current tab's file has `"sample": true`, the top bar shows **Sample data**. Set it to `false` (or remove it) in real files.

To check the stress fixtures in the real app, open `index.html?stress=short#world` or `index.html?stress=long#events`.

Run it locally with any static server, for example `python3 -m http.server`, then open http://localhost:8000. Opening the file directly with `file://` blocks the data fetch.

## Rendering rules

- All JSON is inserted with `textContent`. Raw HTML in the data is shown as plain text, never parsed.
- Links are only made for `http(s)` URLs.
- `[^3]` anywhere in text becomes a superscript **3**. Clicking it glides the page (a gentle, slightly bouncy scroll) to entry 3 in the Sources list and highlights it for a couple of seconds; the hash in the address bar never changes. The article link itself opens from the Sources entry. In Events, markers jump to that event's own Sources row. On hover or keyboard focus, a tooltip shows the outlet and title. Reduced motion jumps without animation. Space before a marker is removed.
- Empty or `null` optional fields (`differences`, `weeklyRead`, `reads`, `connects`, …) hide their section entirely.
- No element has a fixed height. Disclosures animate `grid-template-rows` from `0fr` to `1fr`, so they open to whatever height the content needs. Reduced motion turns every transition off.

## Which element shows each field

### world.json  →  World tab
Each topic is ONE specific event from roughly the last 48 hours, not a theme.

| Field | Shown as |
|---|---|
| `date` | Mono label at the top of the header panel ("Mon, Oct 12, 2026") |
| `summary` | Large sentence in the header panel |
| `topics[].heading` | Event headline, plus its entry in the sticky left index |
| `topics[].date` | Event date, under the headline |
| `topics[].status` | Status tag next to the headline (confirmed / developing / disputed) |
| `topics[].summary` | Always-visible text under the headline (2–3 sentences) |
| `topics[].lead` | **Source article** row directly under the summary: outlet, headline link (new tab), date. Hidden if missing |
| `topics[].alsoReported[]` | Up to two quieter **Also reported by** links (outlet and headline). Hidden if empty |
| `topics[].eventId` | A **Part of: [event title]** chip that opens and scrolls to that card in the Events tab. Shown only when the id exists in `events.json`; use `null` otherwise |
| `topics[].article[]` | Paragraphs revealed by **Read more** (collapsed by default) |
| `topics[].differences` | **Where reporting differs** box at the end of the article (hidden if null) |
| `topics[].id` | Anchor `#t-<id>`, used by the index |
| `question.type` / `.text` | **Think about this** card (type as small tag) |
| `read` | **Today's read** card: kind tag, minutes, title link, outlet, summary |
| `weeklyRead` | **This week's read** card (hidden if null) |
| `sources[]` | Numbered **Sources** list in the right-hand side panel (a compact, scrollable box). `singleSource: true` adds a "single source" tag |

### events.json  →  Events tab
| Field | Shown as |
|---|---|
| `reviewed` | "Reviewed Oct 11, 2026" label in the header |
| `changes[0]` | **Recent change** line |
| `changes[1…]` | Behind **Earlier changes (n)** |
| `events[].title`, `.status`, `.added` | The collapsed row: number, title, status tag, "Added …" |
| `.whyHere` | Why it's here |
| `.standing` | Where it stands |
| `.heading.likely / .possible / .unlikely` | Where it's heading (three lines) |
| `.watch[]` | What to watch: date and text |
| `.connects[]` | **Connects to**: chips, each `{ "id": "<event id>", "why": "<one sentence>" }`. Clicking a chip opens a small note with the `why` and a "Jump to …" line that opens and scrolls to that event. A plain id string still works (the note then shows only the jump line) |
| `.removeWhen` | What would remove it |
| `.history[]` | Full history reader: chapter list (heading and period) on the left, chapter text on the right, Previous/Next, "Chapter 3 of 7" |
| `.goDeeper[]` | Go deeper cards: kind tag, title link, outlet, summary |
| `.sources[]` | Ids into the top-level `sources` list, shown under the event |
| `sources[]` | Shared source list; `[^n]` in any event text links here |

**Changes often:** `standing`, `heading`, `watch` (and `status`, plus a new `changes` entry when an event moves).
**Grows over time:** `history`. Append new chapters at the end and update the last chapter's `period` (for example "2025-now"). Never rewrite older chapters. The reader handles 4–10 chapters.

### canada.json / china.json  →  Canada and China tabs
| Field | Shown as |
|---|---|
| `date`, `summary` | Header panel |
| `body[]` | The brief's paragraphs (1–4, no subheadings) |
| `differences` | Where reporting differs box (hidden if null) |
| `reads[]` (max 2) | **Further reading**: kind tag, title link, outlet, summary |
| `sources[]` | Sources list |

### generation.json  →  Generation tab
| Field | Shown as |
|---|---|
| `updated` | "This month · October 2026" label |
| `topic`, `intro` | Header panel |
| `data[]` | **What the data says**: `stat` in bold with a superscript link to `source`, `detail` below |
| `why[]` | **Why it spreads**: `claim`, `evidence` tag (measured / plausible / contested), `detail` |
| `test[]` | **How to test a claim**: numbered list |
| `sources[]` | Sources list |

## Notes on the sample data

The sample files are placeholders for layout only. Their Events history is real background, but the "today" text is illustrative, and most source links point to outlet section pages rather than specific articles. The stress fixtures use invented stories so they can be sized to the content limits exactly.

## Accessibility

Semantic headings throughout. Every disclosure is a real `<button>` with `aria-expanded` and `aria-controls`, and collapsed regions are `inert`. Focus is always visible, and every action works from the keyboard. Tabs are links (`#world`, `#events`, `#canada`, `#china`, `#generation`) and can be deep-linked. Panel opacity was chosen so body text meets WCAG AA over the wallpaper.
