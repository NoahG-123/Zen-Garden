# Daily update

A scheduled task starts at 5:22 am Toronto time every day, rewrites the JSON in `data/` and pushes it to `main`, so the brief is ready by about 6 am. GitHub Pages republishes the site a minute or two later. The site code is never touched.

## What it writes
`world.json`, `canada.json` and `china.json` every day. `events.json` is reviewed daily and changes rarely. `generation.json` changes monthly. `index.json` gets a new `updated` time, which makes every browser fetch the fresh files.

## The safety check
Before every push the task runs:

```
python3 scripts/validate.py --production
```

A small problem never stops the day. The checker reports three kinds of findings:

| Finding | Meaning | What happens |
|---|---|---|
| warning | Quality note: text a bit long, a loose source, a missing optional field | Published anyway and mentioned in the run summary |
| TOPIC | A World topic has no verified source article or no article text | Only that topic is fixed or dropped |
| ERROR | A file is broken (invalid JSON, a core section missing) | Only that file goes back to yesterday's version |

Everything else still publishes. You can run the same command yourself at any time.

## Things you may want to do
- **Pause the schedule:** turn the scheduled task off in Claude's settings. The site keeps showing the last brief, and the run chip in the top bar switches to "No update today" once the last run is not from today (or is more than 26 hours old).
- **Fix a mistake by hand:** edit the JSON on GitHub and commit. Keep the shape the same and run the checker if you can.
- **See the exact task prompt:** `docs/DAILY_TASK_PROMPT.md`.
