# scripts/

Helper scripts run by CI or by hand. Both are plain Python 3, stdlib only
(`build-ob-xf-manual.py` additionally shells out to `pandoc`).

---

## surge_report.py

Generates the page published at
<https://surge-synth-team.org/reports/surge-repo-activity/> — a daily snapshot
of every repository in the `surge-synthesizer` org.

### What the report contains

1. **Open pull requests** — grouped by repo, oldest first, with author, age,
   and badges for draft / approved / changes requested, plus `stale` at 90+
   days.
2. **Activity** — two tables, a short window and a long window (7 and 90 days
   by default): merged PRs and newly opened issues per repo. Bars share one
   scale *within* a table, never across the two.
3. **New contributors** — authors whose *first ever* merged PR in the org
   landed in the last 30 days, with that PR, its repo, and merges since. Bots
   are excluded via the GraphQL `__typename`.
4. **Open issue age** — per repo, the open count, a stacked bar splitting the
   backlog into ≤ 1 week / ≤ 1 month / ≤ 1 year / > 1 year, and those four
   counts as heatmap cells shaded by each bucket's share of that repo's
   backlog.

The output is one self-contained HTML file — no external requests, follows the
viewer's light/dark preference, hover tooltips on every bar and cell.

### How it is published

`.github/workflows/build.yaml` runs it **before** `pnpm build`, on every push
to `master` and daily at 12:00 UTC. It writes into
`public/reports/surge-repo-activity/`, which Astro copies to the site root
untouched — no Astro page or route is involved.

CI commits nothing: the report is regenerated on each deploy, so there is no
daily churn in git history. The copy that *is* committed is a **fallback**.
The generate step is `continue-on-error`, so if the GitHub API is unavailable
the site still deploys with that last-committed copy, which shows its own
"Generated ..." timestamp rather than pretending to be current. Expect the
committed copy to look stale in `git log` — that is deliberate, not neglect.

After a successful deploy, and **only** on the scheduled run (or a manual
dispatch with `notify_discord` ticked), the workflow posts a one-line summary
plus the link to Discord via the `DISCORD_REPO_REPORTS_WEBHOOK` repository
secret. Ordinary pushes to `master` deploy without announcing, so the channel
does not get spammed. If the secret is missing the step logs and exits 0
rather than failing the run.

### Authentication

- **CI** sets `GITHUB_TOKEN`, and the script talks to the GraphQL API directly
  over HTTPS. It needs no `gh` CLI — important, because the runner is
  `ubuntu-slim` and does not have one.
- **Locally**, with no token in the environment, it shells out to an
  authenticated `gh api graphql` instead.

Both paths are equivalent; only the transport differs.

`--public-only` is passed in CI and **must stay**. The site is public, and
without it the report names private org repos (`surge-xt2` currently shows up
in the 90-day activity table).

### Gotcha: Discord needs a User-Agent

Discord sits behind Cloudflare, which **rejects urllib's default
`Python-urllib/x.y` agent with HTTP 403, Cloudflare error 1010** — before the
request ever reaches Discord. It looks exactly like a bad webhook secret but
is not. The workflow uses `curl`, which sends an acceptable agent of its own;
`post_to_discord()` in the script sets one explicitly. If you rewrite either,
keep the User-Agent.

The tell: a 403 with body `error code: 1010` is Cloudflare, whereas a genuinely
bad webhook returns 401/404 with a JSON body like
`{"message": "Unknown Webhook", "code": 10015}`.

### Read-only

Every GitHub call is a GraphQL **query**. `gh_graphql()` refuses to send any
document containing a mutation, so the script cannot write to GitHub even by
accident. The only outbound write is the Discord post, which lives in the
workflow, not the script.

### Running it by hand

```sh
# preview without touching the repo
python3 scripts/surge_report.py --out /tmp --open

# regenerate exactly what CI publishes
python3 scripts/surge_report.py --publish-dir . --public-only --out /tmp
```

Then `pnpm build && pnpm preview` to see it in place.

### Flags worth knowing

| flag | default | meaning |
|---|---|---|
| `--days` | 7 | short activity window |
| `--long-days` | 90 | long activity window; widened automatically if another window exceeds it |
| `--contrib-days` | 30 | new-contributor window |
| `--org` | `surge-synthesizer` | org to report on |
| `--publish-dir` | — | site repo root; writes `public/reports/<slug>/` |
| `--slug` | `surge-repo-activity` | path under `/reports/` |
| `--site-name` | `surge-synth-team.org` | name in the page breadcrumb |
| `--summary-json` | — | writes headline counts for the Discord step |
| `--public-only` | off | exclude private repos entirely |
| `--discord-webhook` | — | post the markdown as an attachment (unused by CI) |

### Changing the report later

- **Add or change a section** — sections are built in `render_markdown()` and
  `render_html()`, which are deliberately parallel; update both so the `.md`
  and `.html` stay in step. Data is gathered once in `collect()`.
- **Add a data source** — add a search in `collect()` via `search_all()`,
  which paginates. GitHub caps any single search at 1000 results; the script
  warns on stderr if a query exceeds it rather than silently truncating. The
  long window is fetched once and the shorter windows are derived from it, so
  a new window costs no extra queries.
- **Colors** — the bucket ramp and the heatmap ramp are validated for both
  light and dark surfaces (monotone lightness, adjacent-step separation,
  single hue, contrast). If you change them, re-validate rather than
  eyeballing: the dark heatmap ramp originally failed with adjacent lightness
  gaps of 0.047 against a 0.06 floor, which would have made its five steps
  indistinguishable.
- **The age buckets** are the `BUCKETS` table near the top; `bucket_for()` and
  the markdown glyphs derive from it, so adding a bucket only needs an entry
  there plus a matching `--hm-*`/`--age-*` CSS token.

### Adding a second report

Write it to `public/reports/<slug>/index.html`, add a generate step to
`build.yaml` alongside the existing one, and extend the Discord message if it
should be announced. Nothing else in the site needs to change; there is
currently no index page at `/reports`, so `/reports/` itself 404s by design.
