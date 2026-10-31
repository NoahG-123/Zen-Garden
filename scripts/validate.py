#!/usr/bin/env python3
"""Zen Garden data checker.

Checks every file listed in data/index.json against the data contract.
It never blocks a whole day's update for a small problem. It reports three
kinds of findings:

  ERROR    A file is broken (not valid JSON, or a core section is missing
           so the tab would be blank). Fix it, or restore only that file.
  TOPIC    A World topic has no usable source article or no article text.
           Fix it with a verified link, or drop only that topic.
  warning  Everything else (too long, odd link, uncited source, ...).
           Publish anyway; mention it in the run summary.

Exit code: 0 when there are no ERROR or TOPIC findings (warnings are fine),
1 otherwise. Standard library only.

Usage:
    python3 scripts/validate.py                 # check ./data
    python3 scripts/validate.py --production    # also treat "sample": true as ERROR
    python3 scripts/validate.py --dir path/to/data
"""
import argparse
import datetime as dt
import json
import os
import re
import sys
from urllib.parse import urlparse

STATUS_TOPIC = {"confirmed", "developing", "disputed"}
STATUS_EVENT = {"escalating", "stalled", "shifting", "winding-down"}
QUESTION_TYPES = {"assumption", "second-order", "other-side", "how-do-we-know", "who-benefits"}
READ_KINDS = {"news", "analysis", "paper"}
DEEPER_KINDS = {"news", "analysis", "paper", "book"}
EVIDENCE = {"measured", "plausible", "contested"}
MARKER = re.compile(r"\[\^(\d+)\]")
SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

ERRORS, TOPICS, WARNINGS = [], [], []


def _file(where):
    return where.split(".json")[0] + ".json"


def error(where, msg):
    ERRORS.append((_file(where), f"{where}: {msg}"))


def topic_problem(where, msg):
    TOPICS.append((_file(where), f"{where}: {msg}"))


def warn(where, msg):
    WARNINGS.append(f"{where}: {msg}")


def is_date(s):
    try:
        dt.date.fromisoformat(s)
        return True
    except (TypeError, ValueError):
        return False


def text(where, v, maxlen=None):
    if not isinstance(v, str) or not v.strip():
        warn(where, "missing or empty")
        return ""
    if maxlen and len(v) > maxlen:
        warn(where, f"{len(v)} characters, limit is {maxlen}")
    return v


def enum(where, v, allowed):
    if v not in allowed:
        warn(where, f"{v!r} is not one of {sorted(allowed)}")


def listing(where, v, lo, hi):
    if not isinstance(v, list):
        warn(where, "must be a list")
        return []
    if not (lo <= len(v) <= hi):
        warn(where, f"has {len(v)} items, expected {lo} to {hi}")
    return v


def url_problem(url, strict=True):
    """None if fine, else a message. Always https and never a homepage.
    strict=True also rejects section pages (used for news links);
    strict=False allows reference pages such as explainers and trackers."""
    if not isinstance(url, str) or not url:
        return "url is missing"
    p = urlparse(url)
    if p.scheme != "https" or not p.netloc:
        return f"url must be https: {url}"
    path = p.path.rstrip("/")
    last = path.split("/")[-1] if path else ""
    if not path:
        return f"url is a homepage, not an article: {url}"
    if strict and not (re.search(r"\d", path) or last.count("-") >= 4):
        return f"url looks like a section page, not an article: {url}"
    return None


def link(where, url, strict=True):
    msg = url_problem(url, strict)
    if msg:
        warn(where, msg)


def source_ids(doc, where, strict=True):
    srcs = doc.get("sources")
    if not isinstance(srcs, list):
        error(where + ".sources", "must be a list (the tab's source list would be missing)")
        return set()
    ids = set()
    for i, s in enumerate(srcs):
        w = f"{where}.sources[{i}]"
        if not isinstance(s, dict):
            warn(w, "must be an object")
            continue
        sid = s.get("id")
        if not isinstance(sid, int) or sid in ids:
            warn(w, "id must be a unique integer")
        else:
            ids.add(sid)
        text(w + ".outlet", s.get("outlet"), 60)
        text(w + ".title", s.get("title"), 200)
        link(w + ".url", s.get("url"), strict)
        if not is_date(s.get("date")):
            warn(w + ".date", "must be an ISO date (YYYY-MM-DD)")
    if not (1 <= len(srcs) <= 20):
        warn(where + ".sources", f"has {len(srcs)} sources, expected 1 to 20")
    return ids


def markers(where, s, ids, used):
    for m in MARKER.findall(s or ""):
        n = int(m)
        used.add(n)
        if n not in ids:
            warn(where, f"cites [^{n}] but there is no source with id {n}")


def read_card(where, r, kinds, with_minutes, strict=True):
    if not isinstance(r, dict):
        warn(where, "missing or not an object")
        return
    text(where + ".title", r.get("title"), 160)
    text(where + ".outlet", r.get("outlet"), 60)
    link(where + ".url", r.get("url"), strict)
    enum(where + ".kind", r.get("kind"), kinds)
    text(where + ".summary", r.get("summary"), 240)
    if with_minutes:
        m = r.get("minutes")
        if not isinstance(m, int) or not (1 <= m <= 90):
            warn(where + ".minutes", "should be a whole number from 1 to 90")


def check_world(d, w, event_ids):
    topics = d.get("topics")
    if not isinstance(topics, list):
        error(w + ".topics", "must be a list (the World tab would be empty)")
        return
    text(w + ".summary", d.get("summary"), 220)
    if not is_date(d.get("date")):
        warn(w + ".date", "must be an ISO date")
    ids = source_ids(d, w)
    used = set()
    markers(w + ".summary", d.get("summary"), ids, used)
    if not (4 <= len(topics) <= 7):
        warn(w + ".topics", f"has {len(topics)} topics, expected 4 to 7 (a shorter brief is fine)")
    seen = set()
    for i, t in enumerate(topics):
        p = f"{w}.topics[{i}]"
        if not isinstance(t, dict):
            topic_problem(p, "must be an object")
            continue
        label = t.get("heading") if isinstance(t.get("heading"), str) else f"#{i}"
        tid = t.get("id")
        if not isinstance(tid, str) or not SLUG.match(tid or "") or tid in seen:
            warn(p + ".id", "should be a unique lowercase slug")
        seen.add(tid)
        text(p + ".heading", t.get("heading"), 90)
        if not is_date(t.get("date")):
            warn(p + ".date", "must be an ISO date")
        enum(p + ".status", t.get("status"), STATUS_TOPIC)
        text(p + ".summary", t.get("summary"), 450)
        markers(p + ".summary", t.get("summary"), ids, used)

        lead = t.get("lead")
        if not isinstance(lead, dict):
            topic_problem(p + ".lead", f'"{label}" has no verified source article')
        else:
            msg = url_problem(lead.get("url"), True)
            if msg:
                topic_problem(p + ".lead.url", f'"{label}": {msg}')
            text(p + ".lead.title", lead.get("title"), 160)
            text(p + ".lead.outlet", lead.get("outlet"), 60)
            if not is_date(lead.get("date")):
                warn(p + ".lead.date", "must be an ISO date")
            elif is_date(d.get("date")):
                age = (dt.date.fromisoformat(d["date"]) - dt.date.fromisoformat(lead["date"])).days
                if age > 3:
                    warn(p + ".lead.date", f"article is {age} days older than the brief")
                if age < 0:
                    warn(p + ".lead.date", "article date is after the brief date")
        for j, a in enumerate(listing(p + ".alsoReported", t.get("alsoReported") or [], 0, 2)):
            if isinstance(a, dict):
                text(f"{p}.alsoReported[{j}].title", a.get("title"), 160)
                text(f"{p}.alsoReported[{j}].outlet", a.get("outlet"), 60)
                link(f"{p}.alsoReported[{j}].url", a.get("url"))
        eid = t.get("eventId")
        if eid is not None and event_ids is not None and eid not in event_ids:
            warn(p + ".eventId", f"{eid!r} is not an id in events.json")

        paras = t.get("article")
        real = [x for x in paras if isinstance(x, str) and x.strip()] if isinstance(paras, list) else []
        if not real:
            topic_problem(p + ".article", f'"{label}" has no article text')
        else:
            if not (3 <= len(real) <= 6):
                warn(p + ".article", f"has {len(real)} paragraphs, expected 3 to 6")
            for j, para in enumerate(real):
                text(f"{p}.article[{j}]", para, 700)
                markers(f"{p}.article[{j}]", para, ids, used)
            total = sum(len(x) for x in real)
            if total > 3000:
                warn(p + ".article", f"{total} characters in total, limit is 3000")
        if t.get("differences") is not None:
            text(p + ".differences", t["differences"], 600)
            markers(p + ".differences", t["differences"], ids, used)

    q = d.get("question")
    if isinstance(q, dict):
        enum(w + ".question.type", q.get("type"), QUESTION_TYPES)
        text(w + ".question.text", q.get("text"), 300)
    else:
        warn(w + ".question", "missing")
    read_card(w + ".read", d.get("read"), READ_KINDS, True)
    if d.get("weeklyRead") is not None:
        read_card(w + ".weeklyRead", d["weeklyRead"], READ_KINDS, True)
    unused = sorted(set(ids) - used)
    if unused:
        warn(w + ".sources", f"sources never cited in the text: {unused}")


def check_brief(d, w):
    body = d.get("body")
    if not isinstance(body, list) or not any(isinstance(x, str) and x.strip() for x in body):
        error(w + ".body", "must be a list with at least one paragraph (the tab would be empty)")
        return
    text(w + ".summary", d.get("summary"), 220)
    if not is_date(d.get("date")):
        warn(w + ".date", "must be an ISO date")
    ids = source_ids(d, w)
    used = set()
    markers(w + ".summary", d.get("summary"), ids, used)
    if not (1 <= len(body) <= 4):
        warn(w + ".body", f"has {len(body)} paragraphs, expected 1 to 4")
    total = 0
    for j, para in enumerate(body):
        text(f"{w}.body[{j}]", para, 1200)
        total += len(para) if isinstance(para, str) else 0
        markers(f"{w}.body[{j}]", para, ids, used)
    if total > 2200:
        warn(w + ".body", f"{total} characters in total, limit is 2200")
    if d.get("differences") is not None:
        text(w + ".differences", d["differences"], 600)
        markers(w + ".differences", d["differences"], ids, used)
    for j, r in enumerate(listing(w + ".reads", d.get("reads") or [], 0, 2)):
        read_card(f"{w}.reads[{j}]", r, READ_KINDS, False)


def check_events(d, w):
    events = d.get("events")
    if not isinstance(events, list) or not events:
        error(w + ".events", "must be a non-empty list (the Events tab would be empty)")
        return None
    if not is_date(d.get("reviewed")):
        warn(w + ".reviewed", "must be an ISO date")
    ids = source_ids(d, w, strict=False)
    used = set()
    if len(events) != 5:
        warn(w + ".events", f"has {len(events)} events, the rule is exactly 5")
    evids = {e.get("id") for e in events if isinstance(e, dict)}
    seen = set()
    for i, e in enumerate(events):
        p = f"{w}.events[{i}]"
        if not isinstance(e, dict):
            warn(p, "must be an object")
            continue
        eid = e.get("id")
        if not isinstance(eid, str) or not SLUG.match(eid or "") or eid in seen:
            warn(p + ".id", "should be a unique lowercase slug")
        seen.add(eid)
        text(p + ".title", e.get("title"), 60)
        enum(p + ".status", e.get("status"), STATUS_EVENT)
        if not is_date(e.get("added")):
            warn(p + ".added", "must be an ISO date")
        for key, lim in (("whyHere", 300), ("standing", 500), ("removeWhen", 300)):
            text(f"{p}.{key}", e.get(key), lim)
            markers(f"{p}.{key}", e.get(key), ids, used)
        h = e.get("heading") if isinstance(e.get("heading"), dict) else {}
        for key in ("likely", "possible", "unlikely"):
            text(f"{p}.heading.{key}", h.get(key), 220)
            markers(f"{p}.heading.{key}", h.get(key), ids, used)
        for j, x in enumerate(listing(p + ".watch", e.get("watch"), 2, 5)):
            if isinstance(x, dict):
                if not is_date(x.get("date")):
                    warn(f"{p}.watch[{j}].date", "must be an ISO date")
                text(f"{p}.watch[{j}].what", x.get("what"), 120)
        for j, c in enumerate(e.get("connects") or []):
            cid = c.get("id") if isinstance(c, dict) else None
            if cid not in evids or cid == eid:
                warn(f"{p}.connects[{j}].id", f"{cid!r} is not another event id")
            text(f"{p}.connects[{j}].why", c.get("why") if isinstance(c, dict) else None, 200)
        for j, ch in enumerate(listing(p + ".history", e.get("history"), 4, 10)):
            if not isinstance(ch, dict):
                continue
            q = f"{p}.history[{j}]"
            text(q + ".heading", ch.get("heading"), 90)
            text(q + ".period", ch.get("period"), 30)
            for k, para in enumerate(listing(q + ".paragraphs", ch.get("paragraphs"), 1, 4)):
                text(f"{q}.paragraphs[{k}]", para, 900)
                markers(f"{q}.paragraphs[{k}]", para, ids, used)
        for j, g in enumerate(listing(p + ".goDeeper", e.get("goDeeper"), 2, 3)):
            read_card(f"{p}.goDeeper[{j}]", g, DEEPER_KINDS, False, strict=False)
        for s in e.get("sources") or []:
            if s not in ids:
                warn(p + ".sources", f"source {s} does not exist")
    for j, c in enumerate(d.get("changes") or []):
        if isinstance(c, dict):
            if not is_date(c.get("date")):
                warn(f"{w}.changes[{j}].date", "must be an ISO date")
            text(f"{w}.changes[{j}].text", c.get("text"), 300)
    return evids


def check_generation(d, w):
    if not isinstance(d.get("data"), list) or not isinstance(d.get("why"), list):
        error(w, '"data" and "why" must both be lists (the tab would be empty)')
        return
    if not is_date((d.get("updated") or "")[:10]):
        warn(w + ".updated", "must start with an ISO date")
    ids = source_ids(d, w, strict=False)
    used = set()
    text(w + ".topic", d.get("topic"), 120)
    text(w + ".intro", d.get("intro"), 600)
    for j, x in enumerate(listing(w + ".data", d["data"], 3, 6)):
        if isinstance(x, dict):
            text(f"{w}.data[{j}].stat", x.get("stat"), 200)
            text(f"{w}.data[{j}].detail", x.get("detail"), 400)
            if x.get("source") not in ids:
                warn(f"{w}.data[{j}].source", f"source {x.get('source')} does not exist")
    for j, x in enumerate(listing(w + ".why", d["why"], 3, 6)):
        if isinstance(x, dict):
            text(f"{w}.why[{j}].claim", x.get("claim"), 200)
            enum(f"{w}.why[{j}].evidence", x.get("evidence"), EVIDENCE)
            text(f"{w}.why[{j}].detail", x.get("detail"), 500)
            markers(f"{w}.why[{j}].detail", x.get("detail"), ids, used)
    for j, q in enumerate(listing(w + ".test", d.get("test"), 3, 4)):
        text(f"{w}.test[{j}]", q, 220)


def check_weekly(d, w):
    """data/weekly.json: past weekly reads, newest first. Optional; not listed in index.json."""
    reads = d.get("reads")
    if not isinstance(reads, list):
        error(w + ".reads", "must be a list")
        return
    if len(reads) > 6:
        warn(w + ".reads", "has %d entries; keep about a month (5 or fewer)" % len(reads))
    last = ""
    for j, r in enumerate(reads):
        here = f"{w}.reads[{j}]"
        if not isinstance(r, dict):
            warn(here, "must be an object")
            continue
        day = r.get("date")
        if not isinstance(day, str) or not is_date(day):
            warn(here + ".date", "must be a date like 2026-11-01 (the Sunday it was added)")
        elif last and day > last:
            warn(here + ".date", "entries must be newest first")
        else:
            last = day
        read_card(here, r, READ_KINDS, True)


def load(path, name):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError) as e:
        error(name, f"cannot be read as JSON ({e})")
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default=os.path.join(os.path.dirname(__file__), "..", "data"))
    ap.add_argument("--production", action="store_true", help='treat "sample": true as ERROR')
    a = ap.parse_args()
    base = os.path.normpath(a.dir)

    idx = load(os.path.join(base, "index.json"), "index.json")
    if not isinstance(idx, dict):
        return finish()
    try:
        dt.datetime.fromisoformat(idx.get("updated"))
    except (TypeError, ValueError):
        error("index.json.updated", "must be an ISO timestamp with offset, e.g. 2026-10-16T06:05:00-04:00")
    run = idx.get("run")
    if run is None:
        warn("index.json.run", 'missing: add {"finished": <ISO time>, "issues": [...]} so the run card can report on today')
    elif not isinstance(run, dict):
        warn("index.json.run", "must be an object")
    else:
        try:
            dt.datetime.fromisoformat(run.get("finished"))
        except (TypeError, ValueError):
            warn("index.json.run.finished", "must be an ISO timestamp with offset")
        for j, x in enumerate(listing("index.json.run.issues", run.get("issues"), 0, 10)):
            text(f"index.json.run.issues[{j}]", x, 200)
    files = idx.get("files")
    if not isinstance(files, list):
        error("index.json.files", "must be a list")
        return finish()

    docs = {}
    for name in files:
        if not isinstance(name, str) or "/" in name or not name.endswith(".json"):
            error("index.json.files", f"bad file name {name!r}")
            continue
        d = load(os.path.join(base, name), name)
        if isinstance(d, dict):
            docs[name] = d
            if a.production and d.get("sample"):
                error(name, '"sample": true in a production file. Remove the flag only when the content is real.')
        elif d is not None:
            error(name, "must be a JSON object")

    def guarded(name, fn, *args):
        try:
            return fn(docs[name], name, *args)
        except (AttributeError, TypeError, KeyError, ValueError) as e:
            error(name, f"malformed structure ({type(e).__name__}: {e})")
            return None

    event_ids = guarded("events.json", check_events) if "events.json" in docs else None
    if "world.json" in docs:
        guarded("world.json", check_world, event_ids)
    for name in ("canada.json", "china.json"):
        if name in docs:
            guarded(name, check_brief)
    if "generation.json" in docs:
        guarded("generation.json", check_generation)
    weekly_path = os.path.join(base, "weekly.json")
    if os.path.exists(weekly_path):
        wk = load(weekly_path, "weekly.json")
        if isinstance(wk, dict):
            docs["weekly.json"] = wk
            guarded("weekly.json", check_weekly)
        elif wk is not None:
            error("weekly.json", "must be a JSON object")
    return finish()


def finish():
    for w in WARNINGS:
        print("warning:", w)
    for _, m in TOPICS:
        print("TOPIC:", m)
    for _, m in ERRORS:
        print("ERROR:", m)
    print()
    if TOPICS:
        print("Topics to fix with a verified link, or drop (only these): " +
              "; ".join(sorted({m.split(": ", 1)[0] for _, m in TOPICS})))
    if ERRORS:
        print("Files with ERROR (fix, or restore only these from git): " +
              ", ".join(sorted({f for f, _ in ERRORS})))
    if ERRORS or TOPICS:
        print(f"NOT CLEAN: {len(ERRORS)} error(s), {len(TOPICS)} topic problem(s), {len(WARNINGS)} warning(s).")
        return 1
    print(f"OK: nothing blocks publishing ({len(WARNINGS)} warning(s)).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
