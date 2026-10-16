/* Zen Garden — renders everything from JSON. No content lives in this file. */
"use strict";

/* The only setting you should need to change: where the JSON files live (trailing slash). */
const DATA_BASE_URL = "./data/";

const TZ = "America/Toronto";
const STALE_HOURS = 26;
const TABS = ["world", "events", "canada", "china", "generation"];
const FILE_FOR = { world: "world.json", events: "events.json", canada: "canada.json", china: "china.json", generation: "generation.json" };
/* Design check: ?stress=short or ?stress=long swaps World and Events for the stress fixtures in data/stress/. */
const STRESS = new URLSearchParams(location.search).get("stress");
if (STRESS === "short" || STRESS === "long") {
  FILE_FOR.world = `stress/world-${STRESS}.json`;
  FILE_FOR.events = `stress/events-${STRESS}.json`;
}
const reduceMotion =window.matchMedia("(prefers-reduced-motion: reduce)");

/* ---------------- tiny DOM helper (text only, never HTML) ---------------- */
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, "");
      else el.setAttribute(k, String(v));
    }
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
const svgNS = "http://www.w3.org/2000/svg";
function chevron() {
  const s = document.createElementNS(svgNS, "svg");
  s.setAttribute("viewBox", "0 0 10 10"); s.setAttribute("class", "chev"); s.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(svgNS, "path");
  p.setAttribute("d", "M1.5 3.5 5 7l3.5-3.5"); p.setAttribute("fill", "none");
  p.setAttribute("stroke", "currentColor"); p.setAttribute("stroke-width", "1");
  s.append(p);
  return s;
}
const arr = (x) => (Array.isArray(x) ? x : []);
const str = (x) => (typeof x === "string" ? x : x == null ? "" : String(x));
const safeUrl = (u) => (/^https?:\/\//i.test(str(u)) ? str(u) : null);
let uid = 0;
const nextId = (p) => `${p}-${++uid}`;

/* ---------------- dates ---------------- */
function isoDateToUTC(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str(iso));
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)) : null;
}
const fmt = (d, opts) => new Intl.DateTimeFormat("en-US", opts).format(d);
function longDate(iso) { const d = isoDateToUTC(iso); return d ? fmt(d, { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : str(iso); }
function shortDate(iso) { const d = isoDateToUTC(iso); return d ? fmt(d, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : str(iso); }
function monthYear(iso) { const d = isoDateToUTC(iso); return d ? fmt(d, { month: "long", year: "numeric", timeZone: "UTC" }) : str(iso); }
function clock(d) { return fmt(d, { hour: "numeric", minute: "2-digit", timeZone: TZ }).replace(/\s?([AP])M$/i, (_, p) => ` ${p.toLowerCase()}m`); }
function dayKey(d) { return fmt(d, { year: "numeric", month: "2-digit", day: "2-digit", timeZone: TZ }); }

/* ---------------- citations: "[^3]" -> superscript link + tooltip ---------------- */
function rich(text, sources, prefix) {
  const out = [];
  const s = str(text);
  const re = /\[\^(\d+)\]/g;
  let last = 0, m;
  while ((m = re.exec(s))) {
    // "calm [^1]." renders as "calm¹." — the marker hugs the word it supports
    if (m.index > last) out.push(s.slice(last, m.index).replace(/\s+$/, ""));
    out.push(citeNode(+m[1], sources, prefix));
    last = re.lastIndex;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}
/* Clicking a citation glides to its entry in the Sources list and highlights it. */
let glideFrame = 0, hlTimer = 0;
function glide(targetY) {
  cancelAnimationFrame(glideFrame);
  const startY = window.scrollY;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const to = Math.max(0, Math.min(max, targetY));
  const delta = to - startY;
  if (reduceMotion.matches || Math.abs(delta) < 2) { window.scrollTo(0, to); return; }
  const dur = Math.min(900, 420 + Math.abs(delta) * 0.25);
  const amp = Math.min(12, Math.abs(delta) * 0.03) * Math.sign(delta); // a small, gentle settle
  const t0 = performance.now();
  const stop = () => { cancelAnimationFrame(glideFrame); off(); };
  const off = () => ["wheel", "touchstart", "keydown"].forEach((ev) => window.removeEventListener(ev, stop));
  ["wheel", "touchstart", "keydown"].forEach((ev) => window.addEventListener(ev, stop, { passive: true }));
  const step = (now) => {
    const t = Math.min(1, (now - t0) / dur);
    const ease = 1 - Math.pow(1 - t, 3);
    const wobble = Math.sin(t * Math.PI * 4) * t * (1 - t) * 4 * amp;
    window.scrollTo(0, startY + delta * ease + wobble);
    if (t < 1) glideFrame = requestAnimationFrame(step);
    else { off(); window.scrollTo(0, to); }
  };
  glideFrame = requestAnimationFrame(step);
}
function jumpToSource(id, fallbackUrl) {
  const el = document.getElementById(id);
  if (!el) { if (fallbackUrl) window.open(fallbackUrl, "_blank", "noopener"); return; }
  const list = el.closest(".src-list");
  if (list) list.scrollTo({ top: el.offsetTop - (list.clientHeight - el.offsetHeight) / 2, behavior: reduceMotion.matches ? "auto" : "smooth" });
  const r = (list || el).getBoundingClientRect();
  glide(window.scrollY + r.top - (window.innerHeight - r.height) / 2);
  document.querySelectorAll(".hl").forEach((n) => n.classList.remove("hl"));
  el.classList.add("hl");
  clearTimeout(hlTimer);
  hlTimer = setTimeout(() => el.classList.remove("hl"), 2600);
  el.setAttribute("tabindex", "-1");
  el.focus({ preventScroll: true });
}
function citeNode(n, sources, prefix = "src-") {
  const src = sources && sources.get(n);
  if (!src) return h("sup", { class: "cite" }, h("span", { class: "mono" }, n));
  const id = `${prefix}${n}`;
  const url = safeUrl(src.url);
  return h("sup", { class: "cite" },
    h("a", { href: `#${id}`, "aria-label": `Source ${n}: ${str(src.outlet)}, ${str(src.title)}. Jump to source`,
      onclick: (e) => { e.preventDefault(); jumpToSource(id, url); } }, n),
    h("span", { class: "tip", "aria-hidden": "true" }, h("b", null, str(src.outlet)), str(src.title)));
}
const sourceMap = (list) => new Map(arr(list).map((s) => [Number(s.id), s]));

/* ---------------- shared pieces ---------------- */
const statusLabel = (s) => str(s).replace(/-/g, " ");
const tag = (s, plain) => h("span", { class: plain ? "tag plain" : "tag", "data-s": str(s) }, statusLabel(s));

function disclosure(button, region, onChange) {
  region.id = region.id || nextId("disc");
  button.setAttribute("aria-controls", region.id);
  let open = false;
  const set = (v) => {
    open = !!v;
    button.setAttribute("aria-expanded", String(open));
    region.classList.toggle("open", open);
    region.inert = !open;
    if (onChange) onChange(open);
  };
  button.addEventListener("click", () => set(!open));
  set(false);
  return { set, get open() { return open; } };
}
function discRegion(...content) { return h("div", { class: "disc" }, h("div", { class: "disc-inner" }, content)); }

function differs(text, sources) {
  if (!str(text).trim()) return null;
  return h("div", { class: "differs" }, h("p", { class: "label" }, "Where reporting differs"), h("p", null, rich(text, sources)));
}

function readBlock(r, opts = {}) {
  const url = safeUrl(r.url);
  const titleTag = opts.titleTag || "h3";
  return [
    h("div", { class: "read-meta" },
      r.kind ? tag(r.kind, true) : null,
      r.minutes ? h("span", { class: "mono" }, `${r.minutes} min`) : null),
    h(titleTag, { class: "read-title" },
      url ? h("a", { href: url, target: "_blank", rel: "noopener noreferrer" }, str(r.title), h("span", { class: "ext", "aria-hidden": "true" }, "↗"), h("span", { class: "sr-only" }, " (opens in a new tab)")) : str(r.title)),
    r.outlet ? h("p", { class: "mono" }, str(r.outlet)) : null,
    r.summary ? h("p", { class: "read-sum" }, str(r.summary)) : null,
  ];
}

function sourcesPanel(list, prefix = "src-") {
  const items = arr(list);
  if (!items.length) return null;
  return h("section", { class: "panel sources", "aria-labelledby": "src-h" },
    h("h2", { class: "label", id: "src-h" }, "Sources"),
    h("ol", { class: "src-list" }, items.map((s) => {
      const url = safeUrl(s.url);
      return h("li", { id: `${prefix}${s.id}` },
        h("span", { class: "n" }, s.id),
        h("div", { class: "b" },
          h("span", { class: "outlet" }, str(s.outlet)),
          h("span", { class: "ttl" },
            url ? h("a", { href: url, target: "_blank", rel: "noopener noreferrer" }, str(s.title), h("span", { class: "sr-only" }, " (opens in a new tab)")) : str(s.title)),
          h("span", { class: "m" },
            s.date ? h("span", { class: "d" }, shortDate(s.date)) : null,
            s.singleSource ? h("span", { class: "tag plain single" }, "single source") : null)));
    })));
}

function hero(label, title, sources, extra) {
  return h("header", { class: "panel panel-soft hero" },
    h("p", { class: "label" }, label),
    h("h1", null, rich(title, sources)),
    extra || null);
}

/* ---------------- daily run status (from index.json "run") ---------------- */
function runCard() {
  const run = index && index.run;
  const finished = run ? new Date(str(run.finished)) : null;
  const issues = arr(run && run.issues).map(str).filter((x) => x.trim());
  const card = (badge, line, extra) => h("section", { class: "panel card run-card", "aria-labelledby": "run-h", role: "status" },
    h("div", { class: "section-head" }, h("h2", { class: "label", id: "run-h" }, "Today’s run"), badge),
    h("p", { class: "run-line" }, line), extra || null);
  const pill = (state, text) => h("span", { class: "tag plain", "data-s": state }, text);
  if (!finished || isNaN(finished)) return card(pill("stalled", "no record"), "No run has been recorded yet.");
  const today = dayKey(finished) === dayKey(new Date());
  const when = today ? clock(finished) : `${fmt(finished, { weekday: "short", month: "short", day: "numeric", timeZone: TZ })}, ${clock(finished)}`;
  if (!today) return card(pill("disputed", "not run today"), `No update has run today. Last run: ${when}.`);
  if (!issues.length) return card(pill("confirmed", "ok"), `Run successful · ${when}`);
  return card(pill("disputed", issues.length === 1 ? "1 issue" : `${issues.length} issues`), `Run finished · ${when}`,
    h("ul", { class: "run-list" }, issues.map((x) => h("li", null, x))));
}

/* Phone and tablet (single column) layout. Desktop is 1024px and up. */
const compactMQ = window.matchMedia("(max-width: 1023px)");
const isCompact = () => compactMQ.matches;

/* ---------------- run-status chip (top bar, phone and desktop) ---------------- */
function runState() {
  const run = index && index.run;
  const finished = run ? new Date(str(run.finished)) : null;
  if (!run || !finished || isNaN(finished)) return { kind: "none", text: "Not updated yet", finished: null, issues: [] };
  const issues = arr(run.issues).map(str).filter((x) => x.trim());
  const fresh = dayKey(finished) === dayKey(new Date()) && Date.now() - finished.getTime() <= STALE_HOURS * 3600 * 1000;
  if (!fresh) return { kind: "old", text: "No update today", finished, issues };
  const n = issues.length;
  return { kind: n ? "issues" : "ok", text: n ? `Updated ${clock(finished)} · ${n === 1 ? "1 issue" : `${n} issues`}` : `Updated ${clock(finished)}`, finished, issues };
}
let runPanelClose = null;
function renderRunChip() {
  const host = document.getElementById("run");
  if (!host) return;
  if (runPanelClose) runPanelClose();
  const s = runState();
  const fullWhen = s.finished ? `${fmt(s.finished, { weekday: "short", month: "short", day: "numeric", timeZone: TZ })}, ${clock(s.finished)}` : "";
  const panelId = "run-panel";
  const chip = h("button", { type: "button", class: "run-chip", "data-k": s.kind, "aria-expanded": "false", "aria-controls": panelId },
    s.kind !== "none" ? h("span", { class: "dot", "aria-hidden": "true" }) : null,
    h("span", null, s.text));
  const lines = [];
  if (s.kind === "none") lines.push(h("p", { class: "run-line" }, "No run has been recorded yet."));
  else {
    if (s.kind === "old") lines.push(h("p", { class: "run-line" }, "No update has run today."));
    lines.push(h("p", { class: "run-when" }, h("span", { class: "label" }, s.kind === "old" ? "Last run finished" : "Finished"), h("span", null, fullWhen)));
    if (s.issues.length) lines.push(h("ul", { class: "run-list" }, s.issues.map((t) => h("li", null, t))));
    else if (s.kind !== "old") lines.push(h("p", { class: "run-line ok" }, "Run successful"));
  }
  const panel = h("div", { class: "run-panel", id: panelId, role: "region", "aria-label": "Daily run", hidden: true },
    h("p", { class: "label" }, "Today’s run"), lines);
  const close = (focusChip) => {
    if (panel.hidden) return;
    panel.hidden = true; chip.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", outside, true);
    document.removeEventListener("keydown", onKey);
    if (focusChip) chip.focus();
  };
  const outside = (e) => { if (!host.contains(e.target)) close(false); };
  const onKey = (e) => { if (e.key === "Escape") close(true); };
  chip.addEventListener("click", () => {
    if (!panel.hidden) { close(false); return; }
    panel.hidden = false; chip.setAttribute("aria-expanded", "true");
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", onKey);
  });
  runPanelClose = () => close(false);
  host.replaceChildren(chip, panel);
}

const scrollOpts = () => ({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "start" });

/* ---------------- WORLD ---------------- */
let pendingEvent = null;
function leadRow(lead) {
  if (!lead || !str(lead.title).trim()) return null;
  const url = safeUrl(lead.url);
  return h("p", { class: "lead" },
    h("span", { class: "k" }, "Source article"),
    h("span", { class: "outlet" }, str(lead.outlet)),
    url ? h("a", { href: url, target: "_blank", rel: "noopener noreferrer" }, str(lead.title), h("span", { class: "sr-only" }, " (opens in a new tab)")) : h("span", null, str(lead.title)),
    lead.date ? h("span", { class: "d" }, shortDate(lead.date)) : null);
}
function alsoRow(list) {
  const items = arr(list).filter((a) => str(a.title).trim()).slice(0, 2);
  if (!items.length) return null;
  return h("p", { class: "also" }, h("span", { class: "k" }, "Also reported by"),
    items.map((a, i) => {
      const url = safeUrl(a.url);
      return h("span", { class: "a" }, h("span", { class: "outlet" }, str(a.outlet)),
        url ? h("a", { href: url, target: "_blank", rel: "noopener noreferrer" }, str(a.title), h("span", { class: "sr-only" }, " (opens in a new tab)")) : str(a.title));
    }));
}
function renderWorld(d, cleanup, eventsData) {
  const eventTitles = new Map(arr(eventsData && eventsData.events).map((e) => [e.id, str(e.title)]));
  const sources = sourceMap(d.sources);
  const topics = arr(d.topics);
  const view = h("div", { class: "world view" + (topics.length ? "" : " no-topics") });

  // sticky index
  const indexButtons = [];
  const index = h("nav", { class: "index", "aria-label": "Topics on this page" },
    h("p", { class: "label" }, "Today"),
    h("ol", null, topics.map((t) => {
      const b = h("button", { type: "button", onclick: () => {
        const target = document.getElementById(`t-${t.id}`);
        if (!target) return;
        target.scrollIntoView(scrollOpts());
        target.querySelector(".topic-toggle")?.focus({ preventScroll: true });
      } }, str(t.heading));
      indexButtons.push(b);
      return h("li", null, b);
    })));

  const compact = isCompact();
  const rowControls = [];
  const topicEls = topics.map((t) => compact ? compactTopic(t) : desktopTopic(t));

  /* Phone/tablet: collapsed row = headline, status pill, chevron. One row open at a time. */
  function compactTopic(t) {
    const row = h("button", { type: "button", class: "m-row" },
      h("span", { class: "m-t" }, str(t.heading)),
      t.status ? tag(t.status) : null,
      chevron());
    const article = h("div", { class: "article reading" },
      arr(t.article).map((p) => h("p", null, rich(p, sources))),
      differs(t.differences, sources));
    let more = null;
    if (arr(t.article).length || str(t.differences).trim()) {
      const moreLabel = h("span", { class: "mono" }, "Read more");
      const moreBtn = h("button", { type: "button", class: "m-more" }, moreLabel, chevron());
      const artRegion = discRegion(article);
      disclosure(moreBtn, artRegion, (open) => { moreLabel.textContent = open ? "Close" : "Read more"; });
      more = [moreBtn, artRegion];
    }
    const body = h("div", { class: "m-body" },
      t.date || partOfChip(t) ? h("div", { class: "topic-meta" }, t.date ? h("span", { class: "mono" }, shortDate(t.date)) : null, partOfChip(t)) : null,
      t.summary ? h("p", { class: "summary" }, rich(t.summary, sources)) : null,
      leadRow(t.lead), alsoRow(t.alsoReported), more);
    const region = discRegion(body);
    const el = h("article", { class: "topic m", id: `t-${t.id}` }, h("h2", null, row), region);
    const ctl = disclosure(row, region, (open) => {
      if (!open) return;
      let closedAbove = false;
      rowControls.forEach((c) => {
        if (c.ctl !== ctl && c.ctl.open) {
          if (c.el.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) closedAbove = true;
          c.ctl.set(false);
        }
      });
      // wait for a row above to finish collapsing, then bring this row's top into view
      const delay = reduceMotion.matches ? 0 : (closedAbove ? 340 : 30);
      setTimeout(() => {
        const top = el.getBoundingClientRect().top;
        const bar = document.querySelector(".topbar")?.getBoundingClientRect().bottom || 0;
        if (top < bar + 4 || top > window.innerHeight * 0.45) glide(window.scrollY + top - bar - 12);
      }, delay);
    });
    rowControls.push({ ctl, el });
    return el;
  }
  function partOfChip(t) {
    return t.eventId && eventTitles.has(t.eventId) ? h("button", { type: "button", class: "chip part-of",
      onclick: () => { pendingEvent = t.eventId; if (location.hash === "#events") show("events"); else location.hash = "#events"; } },
      h("span", { class: "mono" }, "Part of:"), eventTitles.get(t.eventId)) : null;
  }

  function desktopTopic(t) {
    const moreLabel = h("span", { class: "mono" }, "Read more");
    const btn = h("button", { type: "button", class: "topic-toggle" },
      h("span", { class: "t" }, h("span", null, str(t.heading)), t.status ? tag(t.status) : null),
      h("span", { class: "more" }, moreLabel, chevron()));
    const article = h("div", { class: "article reading" },
      arr(t.article).map((p) => h("p", null, rich(p, sources))),
      differs(t.differences, sources));
    const region = discRegion(article);
    disclosure(btn, region, (open) => { moreLabel.textContent = open ? "Close" : "Read more"; });
    const partOf = partOfChip(t);
    return h("article", { class: "topic", id: `t-${t.id}` },
      h("h2", null, btn),
      t.date || partOf ? h("div", { class: "topic-meta" }, t.date ? h("span", { class: "mono" }, shortDate(t.date)) : null, partOf) : null,
      t.summary ? h("p", { class: "summary" }, rich(t.summary, sources)) : null,
      leadRow(t.lead), alsoRow(t.alsoReported),
      region);
  }

  const rail = h("aside", { class: "rail", "aria-label": "Run status, reading and sources" },
    compact ? null : runCard(),
    d.question && str(d.question.text).trim() ? h("section", { class: "panel card", "aria-labelledby": "q-h" },
      h("div", { class: "section-head" }, h("h2", { class: "label", id: "q-h" }, "Think about this"), d.question.type ? tag(d.question.type, true) : null),
      h("p", { class: "q" }, rich(d.question.text, sources))) : null,
    d.read ? h("section", { class: "panel card", "aria-labelledby": "r-h" },
      h("h2", { class: "label", id: "r-h" }, "Today’s read"), readBlock(d.read)) : null,
    d.weeklyRead ? h("section", { class: "panel card", "aria-labelledby": "w-h" },
      h("h2", { class: "label", id: "w-h" }, "This week’s read"), readBlock(d.weeklyRead)) : null,
    sourcesPanel(d.sources));

  view.append(...[
    compact ? null : index,
    hero(longDate(d.date), d.summary, sources),
    h("section", { class: "panel topics", "aria-label": "Topics" }, topicEls),
    rail].filter(Boolean));

  // scroll-spy: the last topic whose top has passed the bar
  let raf = 0;
  const spy = () => {
    raf = 0;
    let active = 0;
    topicEls.forEach((el, i) => { if (el.getBoundingClientRect().top <= 160) active = i; });
    indexButtons.forEach((b, i) => b.setAttribute("aria-current", String(i === active)));
  };
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(spy); };
  window.addEventListener("scroll", onScroll, { passive: true });
  cleanup.push(() => window.removeEventListener("scroll", onScroll));
  requestAnimationFrame(spy);
  return view;
}

/* ---------------- EVENTS ---------------- */
/* "Connects to" chips: each opens a small note explaining why, with a line that jumps to that event. */
function connectionsBlock(connects, events, titleOf, openEvent) {
  const note = h("div", { class: "conn-note", hidden: true });
  const chips = [];
  let active = null;
  const close = () => { active = null; note.hidden = true; chips.forEach((c) => c.setAttribute("aria-expanded", "false")); };
  connects.forEach((c) => {
    const n = String(events.findIndex((x) => x.id === c.id) + 1).padStart(2, "0");
    const btn = h("button", { type: "button", class: "chip", "aria-expanded": "false",
      onclick: () => {
        if (active === c.id) { close(); return; }
        active = c.id;
        chips.forEach((b) => b.setAttribute("aria-expanded", String(b === btn)));
        note.replaceChildren(
          h("p", { class: "label" }, "Why they connect"),
          str(c.why).trim() ? h("p", { class: "why" }, str(c.why)) : null,
          h("button", { type: "button", class: "jump", onclick: () => { close(); openEvent(c.id); } },
            h("span", { class: "mono" }, n), `Jump to ${titleOf.get(c.id)}`, h("span", { "aria-hidden": "true" }, " →")));
        note.hidden = false;
        note.classList.remove("in"); void note.offsetWidth; note.classList.add("in");
      } }, h("span", { class: "mono" }, n), titleOf.get(c.id));
    chips.push(btn);
  });
  note.addEventListener("keydown", (ev) => { if (ev.key === "Escape") { const b = chips.find((x) => x.getAttribute("aria-expanded") === "true"); close(); b && b.focus(); } });
  return h("div", { class: "conn" }, h("div", { class: "chips" }, chips), note);
}
function renderEvents(d) {
  const sources = sourceMap(d.sources);
  const events = arr(d.events);
  const controls = new Map();
  const titleOf = new Map(events.map((e) => [e.id, str(e.title)]));

  const openEvent = (id) => {
    const c = controls.get(id);
    const li = document.getElementById(`ev-${id}`);
    if (!c || !li) return;
    c.set(true);
    li.scrollIntoView(scrollOpts());
    li.querySelector(".event-row")?.focus({ preventScroll: true });
  };

  const changes = arr(d.changes);
  let changesEl = null;
  if (changes.length) {
    const row = (c) => h("div", { class: "change" }, h("span", { class: "d" }, shortDate(c.date)), h("p", null, rich(c.text, sources)));
    const older = changes.slice(1);
    let toggle = null, region = null;
    if (older.length) {
      toggle = h("button", { type: "button", class: "change-toggle" }, h("span", { class: "mono" }, `Earlier changes (${older.length})`), chevron());
      region = discRegion(h("div", { class: "change-older" }, older.map(row)));
      disclosure(toggle, region);
    }
    changesEl = h("div", { class: "changes" }, h("p", { class: "label" }, "Recent change"), row(changes[0]), toggle, region);
  }

  const head = h("header", { class: "panel panel-soft events-head" },
    h("p", { class: "label" }, d.reviewed ? `Reviewed ${shortDate(d.reviewed)}` : "Events"),
    h("h1", null, "Five stories shaping the world, and where each is heading"),
    changesEl);

  const fact = (label, ...body) => h("div", { class: "fact" }, h("h3", { class: "label" }, label), h("div", null, body));

  const list = h("ol", { class: "panel", "aria-label": "Events" }, events.map((e, i) => {
    const row = h("button", { type: "button", class: "event-row" },
      h("span", { class: "n" }, String(i + 1).padStart(2, "0")),
      h("span", { class: "event-title" }, str(e.title)),
      e.status ? tag(e.status) : h("span"),
      h("span", { class: "mono" }, e.added ? `Added ${shortDate(e.added)}` : ""),
      chevron());

    const pfx = `ev-${e.id}-src-`;
    const R = (t) => rich(t, sources, pfx);
    const hd = e.heading || {};
    const headingLines = [["Likely", hd.likely], ["Possible", hd.possible], ["Unlikely", hd.unlikely]].filter(([, v]) => str(v).trim());
    const watch = arr(e.watch);
    const connects = arr(e.connects)
      .map((c) => (typeof c === "string" ? { id: c } : c || {}))
      .filter((c) => titleOf.has(c.id) && c.id !== e.id);
    const deeper = arr(e.goDeeper);
    const evSources = arr(e.sources).map((n) => sources.get(Number(n))).filter(Boolean);

    const body = h("div", { class: "event-body" }, h("div", { class: "facts" },
      e.whyHere ? fact("Why it’s here", h("p", null, R(e.whyHere))) : null,
      e.standing ? fact("Where it stands", h("p", null, R(e.standing))) : null,
      headingLines.length ? fact("Where it’s heading", h("ul", { class: "heading-lines" }, headingLines.map(([k, v]) => h("li", null, h("span", { class: "k" }, k), h("span", null, R(v)))))) : null,
      watch.length ? fact("What to watch", h("ul", { class: "watch" }, watch.map((w) => h("li", null, h("span", { class: "d" }, shortDate(w.date)), h("span", null, R(w.what)))))) : null,
      connects.length ? fact("Connects to", connectionsBlock(connects, events, titleOf, openEvent)) : null,
      e.removeWhen ? fact("What would remove it", h("p", null, rich(e.removeWhen, sources))) : null,
      historyReader(e, sources, pfx),
      deeper.length ? fact("Go deeper", h("ul", { class: "deeper" }, deeper.map((r) => h("li", null, readBlock(r, { titleTag: "h4" }))))) : null,
      evSources.length ? fact("Sources", h("ol", { class: "ev-sources" }, evSources.map((s) => {
        const url = safeUrl(s.url);
        return h("li", { id: `${pfx}${s.id}` }, h("span", { class: "n" }, s.id), h("span", null, h("span", { class: "outlet" }, str(s.outlet)), " — ",
          url ? h("a", { href: url, target: "_blank", rel: "noopener noreferrer" }, str(s.title)) : str(s.title),
          s.singleSource ? [" ", h("span", { class: "tag plain single" }, "single source")] : null));
      }))) : null));

    const region = discRegion(body);
    controls.set(e.id, disclosure(row, region));
    return h("li", { class: "event", id: `ev-${e.id}` }, h("h2", null, row), region);
  }));

  const view = h("div", { class: "events view" }, head, list);
  if (pendingEvent) {
    const id = pendingEvent; pendingEvent = null;
    requestAnimationFrame(() => requestAnimationFrame(() => openEvent(id)));
  }
  return view;
}

function historyReader(e, sources, pfx) {
  const chapters = arr(e.history);
  if (!chapters.length) return null;
  let idx = 0;
  const buttons = chapters.map((c, i) => h("button", { type: "button", onclick: () => go(i, false) },
    h("span", { class: "cn" }, String(i + 1).padStart(2, "0")),
    h("span", { class: "ch" }, str(c.heading)),
    c.period ? h("span", { class: "cp" }, str(c.period)) : null));
  const pane = h("div", { class: "chapter", "aria-live": "polite" });
  const pickId = nextId("pick");
  const picker = h("select", { id: pickId, onchange: () => go(+picker.value, false) },
    chapters.map((c, i) => h("option", { value: String(i) }, `${String(i + 1).padStart(2, "0")} · ${str(c.heading)}${c.period ? ` (${str(c.period)})` : ""}`)));
  const pick = h("div", { class: "chapter-pick" }, h("label", { class: "label", for: pickId }, "Chapter"), picker);
  const reader = h("div", { class: "reader" }, pick, h("nav", { "aria-label": "Chapters" }, h("ol", { class: "chapters" }, buttons.map((b) => h("li", null, b)))), pane);

  function go(i, focusHeading) {
    idx = Math.max(0, Math.min(chapters.length - 1, i));
    const c = chapters[idx];
    buttons.forEach((b, j) => b.setAttribute("aria-current", String(j === idx)));
    picker.value = String(idx);
    const heading = h("h4", { tabindex: "-1" }, str(c.heading));
    const prev = chapters[idx - 1], next = chapters[idx + 1];
    pane.replaceChildren(
      h("div", { class: "chapter-meta" }, h("span", { class: "label" }, `Chapter ${idx + 1} of ${chapters.length}`), c.period ? h("span", { class: "mono" }, str(c.period)) : null),
      heading,
      h("div", { class: "prose" }, arr(c.paragraphs).map((p) => h("p", null, rich(p, sources, pfx)))),
      h("div", { class: "chapter-nav" },
        h("button", { type: "button", disabled: !prev, onclick: () => go(idx - 1, true) }, h("span", { class: "mono" }, "← Previous"), h("span", { class: "ttl" }, prev ? str(prev.heading) : "")),
        h("button", { type: "button", disabled: !next, onclick: () => go(idx + 1, true) }, h("span", { class: "mono" }, "Next →"), h("span", { class: "ttl" }, next ? str(next.heading) : ""))));
    if (focusHeading) {
      heading.focus({ preventScroll: true });
      if (reader.getBoundingClientRect().top < 64) reader.scrollIntoView(scrollOpts());
    }
  }
  go(0, false);
  const first = chapters[0].period, last = chapters[chapters.length - 1].period;
  return h("div", { class: "history" },
    h("div", { class: "section-head" }, h("h3", { class: "label" }, "Full history"),
      h("span", { class: "mono" }, `${chapters.length} chapters${first && last ? ` · ${str(first).split(/[-–]/)[0]} to ${str(last).split(/[-–]/).pop()}` : ""}`)),
    reader);
}

/* ---------------- CANADA / CHINA ---------------- */
function renderBrief(d, place) {
  const sources = sourceMap(d.sources);
  const reads = arr(d.reads).slice(0, 2);
  const col = h("div", { class: "col" },
    hero(longDate(d.date), d.summary, sources),
    h("section", { class: "panel brief-body", "aria-label": `${place} brief` },
      h("div", { class: "prose reading" }, arr(d.body).map((p) => h("p", null, rich(p, sources)))),
      differs(d.differences, sources)),
    reads.length ? h("section", { class: "panel brief-reads", "aria-labelledby": "fr-h" },
      h("h2", { class: "label", id: "fr-h" }, "Further reading"),
      h("ul", null, reads.map((r) => h("li", null, readBlock(r))))) : null);
  return h("div", { class: "brief view" }, col, h("div", { class: "rail" }, sourcesPanel(d.sources)));
}

/* ---------------- GENERATION ---------------- */
function renderGeneration(d) {
  const sources = sourceMap(d.sources);
  const data = arr(d.data), why = arr(d.why), test = arr(d.test);
  const col = h("div", { class: "col" },
    hero(d.updated ? `This month · ${monthYear(d.updated)}` : "This month", d.topic, sources,
      d.intro ? h("p", { class: "read-sum", style: "font-size:16.5px;max-width:65ch" }, rich(d.intro, sources)) : null),
    data.length ? h("section", { class: "panel gen-block", "aria-labelledby": "g1" },
      h("h2", { class: "label", id: "g1" }, "What the data says"),
      data.map((x) => h("div", { class: "stat" },
        h("p", { class: "s" }, rich(x.stat, sources), x.source != null ? citeNode(Number(x.source), sources) : null),
        x.detail ? h("p", { class: "dt" }, rich(x.detail, sources)) : null))) : null,
    why.length ? h("section", { class: "panel gen-block", "aria-labelledby": "g2" },
      h("h2", { class: "label", id: "g2" }, "Why it spreads"),
      why.map((x) => h("div", { class: "claim" },
        h("div", { class: "c" }, h("p", null, rich(x.claim, sources)), x.evidence ? tag(x.evidence) : null),
        x.detail ? h("p", { class: "dt" }, rich(x.detail, sources)) : null))) : null,
    test.length ? h("section", { class: "panel gen-block", "aria-labelledby": "g3" },
      h("h2", { class: "label", id: "g3" }, "How to test a claim"),
      h("ol", { class: "tests" }, test.map((q) => h("li", null, h("span", null, rich(q, sources)))))) : null);
  return h("div", { class: "gen view" }, col, h("div", { class: "rail" }, sourcesPanel(d.sources)));
}

/* ---------------- states ---------------- */
function skeleton(tab) {
  const lines = (n, cls = "") => h("div", { class: "skel-stack" }, Array.from({ length: n }, (_, i) => h("span", { class: `skel ${cls}`, style: `width:${[92, 100, 78, 96, 64][i % 5]}%` })));
  const block = (n, pad = "24px 28px") => h("div", { class: "panel", style: `padding:${pad}` }, lines(n));
  const heroSk = h("div", { class: "panel panel-soft hero" }, h("span", { class: "skel", style: "width:120px" }), h("span", { class: "skel h", style: "width:86%" }), h("span", { class: "skel h", style: "width:54%" }));
  const wrap = { "aria-busy": "true", "aria-label": "Loading" };
  if (tab === "world") {
    return h("div", { class: "world", ...wrap },
      h("div", { class: "index" }, lines(5)),
      heroSk,
      h("div", { class: "panel topics" }, [0, 1, 2, 3].map(() => h("div", { class: "topic" }, h("span", { class: "skel", style: "width:38%" }), lines(2)))),
      h("div", { class: "rail" }, block(3, "20px 22px"), block(4, "20px 22px"), block(5, "18px 20px")));
  }
  if (tab === "events") return h("div", { class: "events", ...wrap }, heroSk, block(5), block(3));
  return h("div", { class: tab === "generation" ? "gen" : "brief", ...wrap },
    h("div", { class: "col" }, heroSk, block(5), block(3)),
    h("div", { class: "rail" }, block(5, "18px 20px")));
}
function missing() {
  return h("div", { class: "panel missing view", role: "status" },
    h("p", { class: "label" }, "Not updated yet"),
    h("p", null, "This section hasn’t been updated yet. It will appear after the next morning update."));
}

/* ---------------- data loading ---------------- */
let index = null;
const cache = new Map();

async function loadIndex() {
  try {
    const r = await fetch(`${DATA_BASE_URL}index.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    index = { updated: str(j.updated), files: arr(j.files), run: j.run && typeof j.run === "object" ? j.run : null };
  } catch { index = null; }
  renderUpdated();
}
function loadFile(tab) {
  if (cache.has(tab)) return cache.get(tab);
  const file = FILE_FOR[tab];
  const p = (async () => {
    if (index && index.files.length && !file.includes("/") && !index.files.includes(file)) return null;
    const v = encodeURIComponent(index?.updated || String(Date.now()));
    try {
      const r = await fetch(`${DATA_BASE_URL}${file}?v=${v}`);
      if (!r.ok) return null;
      const j = await r.json();
      return j && typeof j === "object" ? j : null;
    } catch { return null; }
  })();
  cache.set(tab, p);
  return p;
}

function renderUpdated() {
  renderRunChip();
  const foot = document.getElementById("footer-updated");
  const d = index && index.updated ? new Date(index.updated) : null;
  if (!d || isNaN(d)) { foot.textContent = "Not updated yet"; return; }
  const today = dayKey(d) === dayKey(new Date());
  const when = today ? clock(d) : `${fmt(d, { month: "short", day: "numeric", timeZone: TZ })}, ${clock(d)}`;
  foot.textContent = `Updated ${when}`;
}

/* ---------------- router ---------------- */
const main = document.getElementById("main");
let renderToken = 0;
let cleanup = [];

function currentTab() {
  const t = location.hash.replace(/^#/, "").split("/")[0].toLowerCase();
  return TABS.includes(t) ? t : "world";
}

async function show(tab, { scroll = true } = {}) {
  const token = ++renderToken;
  cleanup.forEach((fn) => fn()); cleanup = [];
  document.querySelectorAll("#tabs a, .tabbar a").forEach((a) => {
    if (a.dataset.tab === tab) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  document.title = `${document.querySelector(`#tabs a[data-tab="${tab}"]`).textContent} · Zen Garden`;
  main.replaceChildren(skeleton(tab));
  if (scroll) window.scrollTo(0, 0);

  const data = await loadFile(tab);
  if (token !== renderToken) return;
  document.getElementById("sample-flag").hidden = !(data && data.sample === true);
  if (!data) { main.replaceChildren(tab === "world" ? h("div", { class: "missing-wrap view" }, missing(), runCard()) : missing()); return; }
  let view;
  const eventsData = tab === "world" ? await loadFile("events") : null;
  if (token !== renderToken) return;
  try {
    view = tab === "world" ? renderWorld(data, cleanup, eventsData)
      : tab === "events" ? renderEvents(data)
      : tab === "canada" ? renderBrief(data, "Canada")
      : tab === "china" ? renderBrief(data, "China")
      : renderGeneration(data);
  } catch (err) {
    console.error(err);
    view = missing();
  }
  main.replaceChildren(view);
}

/* ---------------- boot ---------------- */
window.addEventListener("hashchange", () => show(currentTab()));
compactMQ.addEventListener("change", () => show(currentTab(), { scroll: false }));
(async () => {
  main.replaceChildren(skeleton(currentTab()));
  await loadIndex();
  show(currentTab(), { scroll: false });
  // warm the other tabs quietly so switching is instant
  TABS.forEach((t) => loadFile(t));
})();

/* offline copy: keeps the last brief readable with no signal */
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
