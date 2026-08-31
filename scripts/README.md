# scripts/

Helper scripts run by CI or by hand. Both are plain Python 3, stdlib only
(`build-manual-pdf.py` additionally shells out to `pandoc`).

---

## build-manual-pdf.py

Flattens an MDX manual under `src/content/docs/<slug>/manual/` into one PDF at
`public/<slug>-manual.pdf`, which the manual's Getting Started page links to.

```sh
python3 scripts/build-manual-pdf.py              # every manual
python3 scripts/build-manual-pdf.py spectrumworx # just one
```

CI does **not** run this — `ubuntu-slim` has neither `pandoc` nor a TeX
distribution, and installing a TeX would cost minutes per run. The PDFs are
committed artifacts; regenerate and commit them when you change manual content.
CI only *checks* that you did — see below.

Manuals are registered in the `MANUALS` table at the top. Pages are ordered by
their `sidebar.order` frontmatter and joined with a `\newpage`, so the PDF
follows the same order as the sidebar. A manual's `exclude` lists page stems to
leave out — `spectrumworx` uses it to drop `to-update-for-3-0`, which is site
scaffolding rather than manual content.

### Two rewrites happen before pandoc sees the text

Both exist because pandoc reads a temp file, not the page's own directory:

- **Relative image paths become absolute.** A page refers to
  `../../../../images/spectrumworx/x.png`; that resolves against the source
  file, not the temp file.
- **Site-absolute links become `https://surge-synth-team.org/…`.** A PDF has no
  site root, so `/ob-xf/manual/lfo/` would otherwise be a dead link.

### Gotcha: images carry `{alt=""}`

Pandoc 3.9 emits `\includegraphics[alt={…}]`, and the `alt` key only arrived in
`graphicx` in 2022 — against the TeX Live currently in use this fails with
`Package keyval Error: alt undefined` and no PDF. Setting an empty `alt`
attribute suppresses that key while keeping the figure caption. Drop the
workaround only after confirming the TeX everyone builds with is new enough.

### Staleness: `--check`

```sh
python3 scripts/build-manual-pdf.py --check
```

Reports whether each committed PDF predates the manual it was built from, and
exits non-zero if any does. `--json FILE` writes the same verdict for
`surge_report.py --stale-manuals` to fold into the daily Discord post, which
names the manual, both dates, and the command to fix it.

`build.yaml` runs this on every build with `continue-on-error`, so a stale PDF
shows as a warning in the Actions UI without failing the deploy, and is
announced on the days the report posts. If the report step itself fails there
is no Discord post at all, so the notice waits for the next run.

The rubric is **commit dates, not mtimes** — `git log -1 --format=%cI` over the
manual directory and `src/images/<slug>/` versus the same for the PDF. A fresh
checkout gives every file the same mtime, so mtimes would say nothing. Two
consequences:

- **The checkout must not be shallow.** `git log` on a depth-1 clone sees one
  commit and would call everything stale, so `build.yaml` sets
  `fetch-depth: 0`. The script detects a shallow clone and skips rather than
  crying wolf; if you ever see the check silently pass in CI, that is the
  first thing to look at.
- **Editing a manual and rebuilding its PDF in the same commit reads as
  fresh**, which is the intended workflow. A commit that touches a manual
  without changing rendered output still trips the check — rerun the script,
  commit the (possibly identical) PDF, and it goes quiet.

## surge_report.py

Generates the page published at
<https://surge-synth-team.org/reports/surge-repo-activity/> — a daily snapshot
of every repository in the `surge-synthesizer` org.

### What the report contains

1. **Open pull requests** — grouped by repo, oldest first, with author, age,
   and badges for draft / approved / changes requested, plus `stale` at 90+
   days.
2. **Activity** — two tables, a short window and a long window (7 and 90 days
   by default): merged PRs, newly opened issues, and closed issues per repo.
   Bars share one scale *within* a table, never across the two.
3. **New contributors** — authors whose *first ever* merged PR in the org
   landed in the last 30 days, with that PR, its repo, and merges since. Bots
   are excluded via the GraphQL `__typename`.
4. **Open issue age** — per repo, the open count, a stacked bar splitting the
   backlog into ≤ 1 week / ≤ 1 month / ≤ 1 year / > 1 year, those four counts
   as heatmap cells shaded by each bucket's share of that repo's backlog, and
   how many issues the repo closed in the last 30 days.
5. **Releases** — for each shipping product, when its nightly was last
   refreshed and what its latest stable release is, with ages.

Every repo name links to the tab its numbers came from — pulls, issues or
releases.

All windows derive from a single long-window fetch, so `--days`,
`--closed-days` and the 90-day table cost no extra queries between them.

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

The same message carries a warning when a manual PDF has fallen behind its
manual, built by `stale_manual_notice()` from the JSON that
`build-manual-pdf.py --check` wrote earlier in the job. Nothing stale means
nothing added, so the usual message is unchanged.

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

### Which products appear in the release section

`RELEASE_PRODUCTS` is an allowlist, not a skiplist, because several repos
publish "releases" that are really asset hosts — a manual PDF, a skin
library — and those sort to the top as the newest release. Add a repo there
when it becomes something people download.

`STABLE_RELEASE_SOURCE` handles products whose stable releases are cut in a
different repo from the one they are developed in. Surge XT is the only one
today: nightlies come from `surge`, but tagged releases live in `releases-xt`,
so without the mapping Surge would show no version at all. The row keeps the
product's name, links to the source repo, and says "via releases-xt".

Nightly rows use the release's `updatedAt`, not `publishedAt`. A nightly keeps
one tag and is re-uploaded in place, so `publishedAt` is when the tag was first
cut — years ago for Surge — while `updatedAt` tracks the newest asset. Ages
are computed from calendar dates so they always agree with the date shown
beside them.

### The Discord message is built in Python

`--discord-payload` writes the complete webhook JSON body, and the workflow
curls that file verbatim. Message wording lives in `main()`, not in the
workflow, so it can be tested by running the script.

The payload crosses from the build job to the deploy job as a job output. It
is deliberately single-line JSON, and the workflow uses `printf`, never
`echo`, to write it: the content contains a `\n` escape before the link, and
some shells' `echo` expands that into a real newline, which corrupts both the
JSON and `GITHUB_OUTPUT`'s `key=value` parsing.

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
| `--closed-days` | 30 | window for the closed-issues column in section 4 |
| `--org` | `surge-synthesizer` | org to report on |
| `--publish-dir` | — | site repo root; writes `public/reports/<slug>/` |
| `--slug` | `surge-repo-activity` | path under `/reports/` |
| `--site-name` | `surge-synth-team.org` | name in the page breadcrumb |
| `--summary-json` | — | writes headline counts as JSON |
| `--discord-payload` | — | writes the webhook body the deploy job posts |
| `--stale-manuals` | — | JSON from `build-manual-pdf.py --check`; stale PDFs are called out in the message |
| `--report-url` | — | link used in the Discord message |
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
