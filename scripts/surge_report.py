#!/usr/bin/env python3
"""Daily activity report for a GitHub organization (default: surge-synthesizer).

Produces a Markdown file and a self-contained HTML page covering:

  1. Open pull requests across every repo in the org
  2. Activity in the last N days (merged PRs + newly opened issues) by repo
  3. Open-issue age histogram by repo (week / month / year / older buckets)

Optionally posts the Markdown as a file attachment to a Discord webhook.

READ-ONLY: every GitHub call is a GraphQL *query* issued through `gh api graphql`.
The script refuses to send any document containing a mutation, and it never
writes to GitHub. The only outbound write it can make is the opt-in Discord
webhook post, which requires an explicit --discord-webhook flag or the
SURGE_REPORT_DISCORD_WEBHOOK environment variable.

Requires python3 and nothing else. It talks to the GitHub GraphQL API directly
when GITHUB_TOKEN or GH_TOKEN is set (which is how CI runs it), and otherwise
shells out to an authenticated `gh` CLI, which is the convenient path locally.
"""

import argparse
import datetime as dt
import html
import json
import mimetypes
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid
import webbrowser
from collections import defaultdict

DEFAULT_ORG = "surge-synthesizer"
SEARCH_RESULT_CAP = 1000  # GitHub search API hard limit per query

# ---------------------------------------------------------------------------
# Age buckets. Ordered youngest -> oldest; the HTML ramp is ordinal blue.
# ---------------------------------------------------------------------------

BUCKETS = [
    ("week", "≤ 1 week", 7, "░"),
    ("month", "≤ 1 month", 30, "▒"),
    ("year", "≤ 1 year", 365, "▓"),
    ("older", "> 1 year", None, "█"),
]
BUCKET_KEYS = [b[0] for b in BUCKETS]


def bucket_for(age_days):
    for key, _label, limit, _ch in BUCKETS:
        if limit is None or age_days < limit:
            return key
    return "older"


# ---------------------------------------------------------------------------
# GitHub access (read-only)
# ---------------------------------------------------------------------------


GRAPHQL_URL = "https://api.github.com/graphql"
RETRY_STATUS = {403, 429, 500, 502, 503, 504}


class GitHubError(RuntimeError):
    def __init__(self, message, retryable=False):
        super().__init__(message)
        self.retryable = retryable


def api_token():
    """Token from the environment, if any. CI sets this; locally we use gh."""
    for var in ("GITHUB_TOKEN", "GH_TOKEN"):
        value = os.environ.get(var)
        if value:
            return value
    return None


def _post_via_http(payload, token):
    req = urllib.request.Request(
        GRAPHQL_URL,
        data=payload.encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/vnd.github+json",
            "User-Agent": "surge-synth-team-report",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:400].strip()
        raise GitHubError(
            f"HTTP {exc.code} from the GitHub API: {detail}",
            retryable=exc.code in RETRY_STATUS,
        ) from None
    except urllib.error.URLError as exc:
        raise GitHubError(f"network error: {exc.reason}", retryable=True) from None


def _post_via_gh(payload):
    try:
        proc = subprocess.run(
            ["gh", "api", "graphql", "--input", "-"],
            input=payload,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        raise GitHubError(
            "no GITHUB_TOKEN/GH_TOKEN in the environment and `gh` is not on "
            "PATH — set a token or install the GitHub CLI"
        ) from None
    if proc.returncode != 0:
        raise GitHubError(f"gh api graphql failed:\n{proc.stderr.strip()}")
    return json.loads(proc.stdout)


def gh_graphql(query, variables, attempts=4):
    """Run one GraphQL query. Queries only — never a mutation.

    Uses a token from the environment when present (so CI needs no `gh`), and
    falls back to the GitHub CLI for local runs where gh holds the auth.
    """
    if re.search(r"\bmutation\b", query):
        raise GitHubError("refusing to send a mutation; this tool is read-only")

    payload = json.dumps({"query": query, "variables": variables})
    token = api_token()

    for attempt in range(attempts):
        try:
            body = _post_via_http(payload, token) if token else _post_via_gh(payload)
            if "errors" in body:
                msgs = "; ".join(e.get("message", str(e)) for e in body["errors"])
                # Abuse/secondary limits surface as errors, not HTTP codes.
                transient = any(
                    word in msgs.lower()
                    for word in ("rate limit", "secondary", "timeout", "try again")
                )
                raise GitHubError(f"GraphQL error: {msgs}", retryable=transient)
            return body["data"]
        except GitHubError as exc:
            if not exc.retryable or attempt == attempts - 1:
                raise
            delay = 5 * (2**attempt)
            print(f"  {exc}\n  retrying in {delay}s "
                  f"({attempt + 1}/{attempts - 1})", file=sys.stderr)
            time.sleep(delay)


SEARCH_QUERY = """
query($q: String!, $after: String) {
  search(query: $q, type: ISSUE, first: 100, after: $after) {
    issueCount
    pageInfo { hasNextPage endCursor }
    nodes {
      __typename
      ... on PullRequest {
        number title url createdAt mergedAt isDraft
        author { login __typename }
        reviewDecision
        repository { name isPrivate }
      }
      ... on Issue {
        number title url createdAt closedAt
        author { login }
        repository { name isPrivate }
      }
    }
  }
}
"""


def search_all(search_query, verbose=True):
    """Page through an issue/PR search, returning every node."""
    nodes, cursor, total = [], None, None
    while True:
        data = gh_graphql(SEARCH_QUERY, {"q": search_query, "after": cursor})
        result = data["search"]
        if total is None:
            total = result["issueCount"]
            if verbose:
                print(f"  {total:>5} matches  ←  {search_query}", file=sys.stderr)
        nodes.extend(n for n in result["nodes"] if n)
        page = result["pageInfo"]
        if not page["hasNextPage"]:
            break
        cursor = page["endCursor"]

    if total is not None and total > SEARCH_RESULT_CAP:
        print(
            f"  ! search returned {total} matches but GitHub caps results at "
            f"{SEARCH_RESULT_CAP}; report is truncated for: {search_query}",
            file=sys.stderr,
        )
    return nodes


# The shipping products the release section covers. An allowlist rather than a
# skiplist: several repos publish "releases" that are really asset hosts (a
# manual PDF, a skin library) and would otherwise sort to the top as the newest
# release. Add a repo here when it becomes something people download.
RELEASE_PRODUCTS = [
    "surge",
    "shortcircuit-xt",
    "OB-Xf",
    "SpectrumWorx",
    "stochas",
    "b-step",
    "monique-monosynth",
    "tuning-note-claps",
]

# Products whose stable releases are cut somewhere other than the repo they are
# developed in. Surge XT builds nightlies in surge/ but tags stable in
# releases-xt/, so without this it would show no stable version at all.
STABLE_RELEASE_SOURCE = {
    "surge": "releases-xt",
}
NIGHTLY_RE = re.compile(r"nightly", re.I)
DORMANT_DAYS = 365

RELEASES_QUERY = """
query($org: String!, $after: String) {
  organization(login: $org) {
    repositories(first: 50, after: $after, isArchived: false,
                 orderBy: {field: NAME, direction: ASC}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        name
        isPrivate
        releases(first: 20, orderBy: {field: CREATED_AT, direction: DESC}) {
          nodes {
            tagName name url isPrerelease isDraft
            createdAt publishedAt updatedAt
          }
        }
      }
    }
  }
}
"""


def collect_releases(org, public_only, now, verbose=True):
    """Nightly freshness and latest stable release for every product repo.

    A nightly release keeps one tag and is re-uploaded in place, so its
    publishedAt is the date the tag was first cut — often years ago — while
    updatedAt tracks the most recent asset upload. Use updatedAt for nightlies
    and publishedAt for stable releases.
    """
    if verbose:
        print("  fetching releases…", file=sys.stderr)

    repos, cursor = [], None
    while True:
        data = gh_graphql(RELEASES_QUERY, {"org": org, "after": cursor})
        block = data["organization"]["repositories"]
        repos.extend(block["nodes"])
        if not block["pageInfo"]["hasNextPage"]:
            break
        cursor = block["pageInfo"]["endCursor"]

    by_name = {r["name"]: r for r in repos}

    def usable_releases(repo_name):
        repo = by_name.get(repo_name)
        if repo is None or (public_only and repo["isPrivate"]):
            return None, []
        return repo, [r for r in repo["releases"]["nodes"] if not r["isDraft"]]

    nightlies, stable = [], []
    for name in RELEASE_PRODUCTS:
        repo, rels = usable_releases(name)
        if repo is None:
            continue

        nightly_rels = [r for r in rels if NIGHTLY_RE.search(r["tagName"] or "")]
        if nightly_rels:
            rel = max(nightly_rels, key=lambda r: r["updatedAt"] or "")
            when = parse_ts(rel["updatedAt"])
            nightlies.append({
                "repo": name, "private": repo["isPrivate"],
                "tag": rel["tagName"], "url": rel["url"], "when": when,
                # From calendar dates, so the age always agrees with the date
                # shown beside it; a timestamp delta can read "2d" next to a
                # date that another row calls "1d".
                "age_days": (now.date() - when.date()).days,
            })

        # Surge XT builds nightlies in surge/ but cuts stable releases in
        # releases-xt/, so the stable row has to come from a different repo.
        source = STABLE_RELEASE_SOURCE.get(name, name)
        src_repo, src_rels = usable_releases(source)
        if src_repo is None:
            continue
        stable_rels = [
            r for r in src_rels
            if not NIGHTLY_RE.search(r["tagName"] or "") and not r["isPrerelease"]
        ]
        if stable_rels:
            rel = max(stable_rels,
                      key=lambda r: r["publishedAt"] or r["createdAt"] or "")
            when = parse_ts(rel["publishedAt"] or rel["createdAt"])
            stable.append({
                "repo": name, "source": source, "private": src_repo["isPrivate"],
                "tag": rel["tagName"], "url": rel["url"], "when": when,
                "age_days": (now.date() - when.date()).days,
            })

    nightlies.sort(key=lambda r: r["age_days"])
    stable.sort(key=lambda r: r["age_days"])
    return {"nightlies": nightlies, "stable": stable}


SAFE_LOGIN = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$")


def prior_merge_counts(scope, logins, before_date, verbose=True, batch=15):
    """How many PRs each login had merged in the org *before* before_date.

    Batched with GraphQL aliases so N authors cost N/batch round trips.
    A count of 0 means their first merge in the org lands in the window.
    """
    counts = {}
    logins = [lg for lg in logins if SAFE_LOGIN.match(lg)]
    for start in range(0, len(logins), batch):
        chunk = logins[start:start + batch]
        parts = []
        for idx, login in enumerate(chunk):
            q = f"{scope} is:pr is:merged author:{login} merged:<{before_date}"
            parts.append(f'  a{idx}: search(query: "{q}", type: ISSUE) {{ issueCount }}')
        data = gh_graphql("query {\n" + "\n".join(parts) + "\n}", {})
        for idx, login in enumerate(chunk):
            counts[login] = data[f"a{idx}"]["issueCount"]
        if verbose:
            print(f"  checked history for {min(start + batch, len(logins))}"
                  f"/{len(logins)} authors", file=sys.stderr)
    return counts


# ---------------------------------------------------------------------------
# Formatting helpers
# ---------------------------------------------------------------------------


def parse_ts(value):
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))


def humanize_age(days):
    days = int(days)
    if days < 1:
        return "today"
    if days < 45:
        return f"{days}d"
    if days < 365:
        return f"{days // 30}mo"
    years, rem = divmod(days, 365)
    months = rem // 30
    return f"{years}y" if not months else f"{years}y {months}mo"


def pct(part, whole):
    return 0.0 if not whole else 100.0 * part / whole


# ---------------------------------------------------------------------------
# Data collection
# ---------------------------------------------------------------------------


def collect(org, days, long_days, contrib_days, closed_days, public_only,
            verbose=True):
    now = dt.datetime.now(dt.timezone.utc)
    since_short = (now - dt.timedelta(days=days)).date()
    since_long = (now - dt.timedelta(days=long_days)).date()
    since_contrib = (now - dt.timedelta(days=contrib_days)).date()
    since_closed = (now - dt.timedelta(days=closed_days)).date()
    scope = f"org:{org}" + (" is:public" if public_only else "")

    if verbose:
        print(f"Querying GitHub for {org} (read-only)…", file=sys.stderr)

    # The long window is fetched once; the shorter windows are subsets of it.
    open_prs = search_all(f"{scope} is:pr is:open sort:created-asc", verbose)
    merged_prs = search_all(f"{scope} is:pr merged:>={since_long}", verbose)
    new_issues = search_all(f"{scope} is:issue created:>={since_long}", verbose)
    open_issues = search_all(f"{scope} is:issue is:open sort:created-asc", verbose)
    closed_issues = search_all(f"{scope} is:issue closed:>={since_long}", verbose)

    private_repos = set()

    def repo_of(node):
        repo = node["repository"]
        if repo["isPrivate"]:
            private_repos.add(repo["name"])
        return repo["name"]

    # --- Section 1: open pull requests -------------------------------------
    prs_by_repo = defaultdict(list)
    for node in open_prs:
        created = parse_ts(node["createdAt"])
        prs_by_repo[repo_of(node)].append(
            {
                "number": node["number"],
                "title": node["title"],
                "url": node["url"],
                "author": (node.get("author") or {}).get("login") or "ghost",
                "age_days": (now - created).days,
                "created": created,
                "draft": node.get("isDraft", False),
                "review": node.get("reviewDecision"),
            }
        )
    for prs in prs_by_repo.values():
        prs.sort(key=lambda p: p["age_days"], reverse=True)

    # --- Section 2: recent activity, two windows ---------------------------
    def activity_since(cutoff):
        act = defaultdict(lambda: {"merged": 0, "issues": 0, "closed": 0})
        merged = issues = closed = 0
        for node in merged_prs:
            if parse_ts(node["mergedAt"]).date() >= cutoff:
                act[repo_of(node)]["merged"] += 1
                merged += 1
        for node in new_issues:
            if parse_ts(node["createdAt"]).date() >= cutoff:
                act[repo_of(node)]["issues"] += 1
                issues += 1
        for node in closed_issues:
            stamp = node.get("closedAt")
            if stamp and parse_ts(stamp).date() >= cutoff:
                act[repo_of(node)]["closed"] += 1
                closed += 1
        return dict(act), merged, issues, closed

    act_short, merged_short, issues_short, closed_short = activity_since(since_short)
    act_long, merged_long, issues_long, closed_long = activity_since(since_long)

    # --- Section 3: new contributors ---------------------------------------
    window_prs = [
        n for n in merged_prs if parse_ts(n["mergedAt"]).date() >= since_contrib
    ]
    by_author = defaultdict(list)
    bots_seen = set()
    for node in window_prs:
        author = node.get("author") or {}
        login = author.get("login")
        if not login:
            continue
        if author.get("__typename") == "Bot" or login.endswith("[bot]"):
            bots_seen.add(login)
            continue
        by_author[login].append(node)

    if verbose and by_author:
        print(f"  resolving first-merge history for {len(by_author)} authors…",
              file=sys.stderr)
    history = prior_merge_counts(scope, sorted(by_author), since_contrib, verbose)

    newcomers = []
    for login, prs in by_author.items():
        if history.get(login, 1) != 0:
            continue
        prs = sorted(prs, key=lambda p: p["mergedAt"])
        first = prs[0]
        newcomers.append(
            {
                "login": login,
                "merges": len(prs),
                "repos": sorted({p["repository"]["name"] for p in prs}),
                "first_url": first["url"],
                "first_number": first["number"],
                "first_title": first["title"],
                "first_repo": first["repository"]["name"],
                "first_at": parse_ts(first["mergedAt"]),
            }
        )
    newcomers.sort(key=lambda c: c["first_at"])

    # --- Section 3: open issue ages ----------------------------------------
    closed_recent = defaultdict(int)
    closed_recent_total = 0
    for node in closed_issues:
        stamp = node.get("closedAt")
        if stamp and parse_ts(stamp).date() >= since_closed:
            closed_recent[repo_of(node)] += 1
            closed_recent_total += 1

    ages = defaultdict(lambda: dict.fromkeys(BUCKET_KEYS, 0))
    oldest = {}
    for node in open_issues:
        name = repo_of(node)
        created = parse_ts(node["createdAt"])
        age = (now - created).days
        ages[name][bucket_for(age)] += 1
        if name not in oldest or age > oldest[name]["age_days"]:
            oldest[name] = {
                "age_days": age,
                "number": node["number"],
                "title": node["title"],
                "url": node["url"],
            }

    # A repo that closed its last open issue inside the window would otherwise
    # drop out of the table while still counting toward the total, so the
    # column would not add up. Keep it with an all-zero row instead.
    for name in closed_recent:
        ages.setdefault(name, dict.fromkeys(BUCKET_KEYS, 0))

    releases = collect_releases(org, public_only, now, verbose)

    return {
        "org": org,
        "releases": releases,
        "generated": now,
        "days": days,
        "long_days": long_days,
        "contrib_days": contrib_days,
        "since": since_short.isoformat(),
        "since_long": since_long.isoformat(),
        "since_contrib": since_contrib.isoformat(),
        "public_only": public_only,
        "private_repos": private_repos,
        "prs_by_repo": dict(prs_by_repo),
        "open_pr_count": len(open_prs),
        "activity": act_short,
        "activity_long": act_long,
        "merged_total": merged_short,
        "new_issue_total": issues_short,
        "merged_total_long": merged_long,
        "new_issue_total_long": issues_long,
        "newcomers": newcomers,
        "bots_skipped": sorted(bots_seen),
        "contrib_authors": len(by_author),
        "ages": dict(ages),
        "closed_recent": dict(closed_recent),
        "closed_days": closed_days,
        "closed_total": closed_recent_total,
        "closed_short": closed_short,
        "closed_long": closed_long,
        "since_closed": since_closed.isoformat(),
        "oldest": oldest,
        "open_issue_total": len(open_issues),
    }


# ---------------------------------------------------------------------------
# Markdown rendering
# ---------------------------------------------------------------------------


def md_bar(counts, width=32):
    """Full-width stacked composition bar; glyph density rises with age."""
    total = sum(counts.values())
    if not total:
        return ""
    cells, out, placed = width, [], 0
    for idx, (key, _label, _limit, ch) in enumerate(BUCKETS):
        if idx == len(BUCKETS) - 1:
            n = cells - placed
        else:
            n = round(cells * counts[key] / total)
            n = min(n, cells - placed)
        if counts[key] and n == 0 and cells - placed > 0:
            n = 1
        out.append(ch * max(0, n))
        placed += max(0, n)
    return "".join(out)


def md_repo(org, name, path=""):
    """Repo name as a markdown link to the tab a section's numbers came from."""
    return f"[{name}](https://github.com/{org}/{name}{path})"


def render_markdown(d):
    org = d["org"]
    stamp = d["generated"].strftime("%Y-%m-%d %H:%M UTC")
    L = []
    add = L.append

    add(f"# {org} — daily report")
    add("")
    add(f"*Generated {stamp} · activity windows: {d['days']} and "
        f"{d['long_days']} days · new contributors over {d['contrib_days']} days*")
    add("")
    add(f"**{d['open_pr_count']}** open PRs · "
        f"**{d['merged_total']}** merges in {d['days']}d · "
        f"**{d['new_issue_total']}** new issues in {d['days']}d · "
        f"**{len(d['newcomers'])}** new contributors in {d['contrib_days']}d · "
        f"**{d['open_issue_total']}** open issues")
    if d["private_repos"] and not d["public_only"]:
        names = ", ".join(sorted(d["private_repos"]))
        add("")
        add(f"> Includes private repos: {names}. Run with `--public-only` to exclude them.")
    add("")

    # --- 1. open PRs -------------------------------------------------------
    add("## 1. Open pull requests")
    add("")
    if not d["prs_by_repo"]:
        add("*No open pull requests.*")
    else:
        for repo in sorted(d["prs_by_repo"], key=lambda r: (-len(d["prs_by_repo"][r]), r.lower())):
            prs = d["prs_by_repo"][repo]
            add(f"### {md_repo(org, repo, '/pulls')} ({len(prs)})")
            add("")
            add("| PR | Title | Author | Age | Status |")
            add("|---|---|---|---|---|")
            for p in prs:
                flags = []
                if p["draft"]:
                    flags.append("draft")
                if p["review"] == "APPROVED":
                    flags.append("approved")
                elif p["review"] == "CHANGES_REQUESTED":
                    flags.append("changes requested")
                if p["age_days"] >= 90:
                    flags.append("stale")
                title = p["title"].replace("|", "\\|")
                add(f"| [#{p['number']}]({p['url']}) | {title} | {p['author']} | "
                    f"{humanize_age(p['age_days'])} | {', '.join(flags) or '—'} |")
            add("")

    # --- 2. activity, two windows ------------------------------------------
    add("## 2. Activity")
    add("")

    def activity_table(act, merged_total, issue_total, closed_total,
                       window_days, since):
        add(f"### Last {window_days} days (since {since})")
        add("")
        if not act:
            add(f"*No merges or new issues in the last {window_days} days.*")
            add("")
            return
        rows = sorted(
            act.items(),
            key=lambda kv: (-(kv[1]["merged"] + kv[1]["issues"]
                              + kv[1]["closed"]), kv[0].lower()),
        )
        peak = max(max(v["merged"], v["issues"], v["closed"])
                   for _, v in rows) or 1

        def ascii_bar(count, ch, width=14):
            return "" if not count else ch * max(1, round(width * count / peak))

        add("| Repo | Merged PRs | | New issues | | Closed issues | |")
        add("|---|---:|---|---:|---|---:|---|")
        for repo, v in rows:
            add(f"| {md_repo(org, repo)} | {v['merged']} | `{ascii_bar(v['merged'], '█')}` "
                f"| {v['issues']} | `{ascii_bar(v['issues'], '░')}` "
                f"| {v['closed']} | `{ascii_bar(v['closed'], '▒')}` |")
        add(f"| **total** | **{merged_total}** | | **{issue_total}** | | "
            f"**{closed_total}** | |")
        add("")
        add("`█` merged PRs · `░` new issues · `▒` closed issues — all three "
            "bars share one scale within this table.")
        add("")

    activity_table(d["activity"], d["merged_total"], d["new_issue_total"],
                   d["closed_short"], d["days"], d["since"])
    activity_table(d["activity_long"], d["merged_total_long"],
                   d["new_issue_total_long"], d["closed_long"],
                   d["long_days"], d["since_long"])

    # --- 3. new contributors -----------------------------------------------
    add(f"## 3. New contributors, last {d['contrib_days']} days")
    add("")
    add(f"*Authors whose first ever merged PR in {org} landed since "
        f"{d['since_contrib']}. Bots excluded.*")
    add("")
    if not d["newcomers"]:
        add(f"*No new contributors in the last {d['contrib_days']} days "
            f"({d['contrib_authors']} authors had PRs merged, all returning).*")
    else:
        add("| Contributor | First merged PR | Repo | Merged on | Merges since |")
        add("|---|---|---|---|---:|")
        for c in d["newcomers"]:
            title = c["first_title"].replace("|", "\\|")
            add(f"| [@{c['login']}](https://github.com/{c['login']}) | "
                f"[#{c['first_number']}]({c['first_url']}) {title} | "
                f"{md_repo(org, c['first_repo'])} | {c['first_at'].strftime('%Y-%m-%d')} | "
                f"{c['merges']} |")
        add("")
        add(f"**{len(d['newcomers'])}** new of **{d['contrib_authors']}** authors "
            f"with merges in the window.")
    add("")

    # --- 4. issue ages -----------------------------------------------------
    add("## 4. Open issue age")
    add("")
    if not d["ages"]:
        add("*No open issues.*")
    else:
        rows = sorted(
            d["ages"].items(), key=lambda kv: (-sum(kv[1].values()), kv[0].lower())
        )
        add(f"| Repo | Open | ≤ 1w | ≤ 1mo | ≤ 1y | > 1y | Age mix "
            f"| Closed {d['closed_days']}d |")
        add("|---|---:|---:|---:|---:|---:|---|---:|")
        for repo, counts in rows:
            total = sum(counts.values())
            add(
                f"| {md_repo(org, repo, '/issues')} | {total} | {counts['week']} | {counts['month']} | "
                f"{counts['year']} | {counts['older']} | `{md_bar(counts)}` "
                f"| {d['closed_recent'].get(repo, 0)} |"
            )
        totals = {k: sum(c[k] for c in d["ages"].values()) for k in BUCKET_KEYS}
        add(
            f"| **total** | **{d['open_issue_total']}** | **{totals['week']}** | "
            f"**{totals['month']}** | **{totals['year']}** | "
            f"**{totals['older']}** | | **{d['closed_total']}** |"
        )
        add("")
        add("Age mix is each repo's open issues as a share of its own total; glyph "
            "density rises with age: `░` ≤ 1 week · `▒` ≤ 1 month · "
            "`▓` ≤ 1 year · `█` > 1 year. Volume is the Open column.")
    add("")

    # --- 5. releases -------------------------------------------------------
    rel = d.get("releases") or {"nightlies": [], "stable": []}
    add("## 5. Releases")
    add("")

    add("### Nightly builds")
    add("")
    if not rel["nightlies"]:
        add("*No repos publish a nightly release.*")
    else:
        add("| Product | Last nightly | Age | |")
        add("|---|---|---:|---|")
        for r in rel["nightlies"]:
            flag = "dormant" if r["age_days"] >= DORMANT_DAYS else ""
            add(f"| {md_repo(org, r['repo'], '/releases')} | "
                f"{r['when'].strftime('%Y-%m-%d')} | "
                f"{humanize_age(r['age_days'])} | {flag} |")
        add("")
        add(f"Nightly tags are re-uploaded in place, so this is when the assets "
            f"last changed, not when the tag was cut. *dormant* marks a nightly "
            f"untouched for over {DORMANT_DAYS} days.")
    add("")

    add("### Latest stable release")
    add("")
    if not rel["stable"]:
        add("*No repos publish a tagged stable release.*")
    else:
        add("| Product | Version | Released | Age |")
        add("|---|---|---|---:|")
        for r in rel["stable"]:
            src = r.get("source", r["repo"])
            via = "" if src == r["repo"] else f" *(via {src})*"
            add(f"| [{r['repo']}](https://github.com/{org}/{src}/releases){via} "
                f"| [{r['tag']}]({r['url']}) | "
                f"{r['when'].strftime('%Y-%m-%d')} | "
                f"{humanize_age(r['age_days'])} |")
        add("")
        add("Drafts and prereleases are excluded.")
    add("")

    return "\n".join(L)


# ---------------------------------------------------------------------------
# HTML rendering
# ---------------------------------------------------------------------------

# Ordinal blue ramp, validated for both surfaces (dataviz validator, --ordinal).
AGE_LIGHT = {"week": "#86b6ef", "month": "#3987e5", "year": "#256abf", "older": "#104281"}
AGE_DARK = {"week": "#b7d3f6", "month": "#6da7ec", "year": "#3987e5", "older": "#1c5cab"}

CSS = """
*, *::before, *::after { box-sizing: border-box; }
:root {
  color-scheme: light;
  --page: #f9f9f7;
  --surface: #fcfcfb;
  --ink: #0b0b0b;
  --ink-2: #52514e;
  --muted: #898781;
  --grid: #e1e0d9;
  --axis: #c3c2b7;
  --border: rgba(11,11,11,0.10);
  --merged: #2a78d6;
  --issues: #eb6834;
  --closed: #1baf7a;
  --age-week: #86b6ef;
  --age-month: #3987e5;
  --age-year: #256abf;
  --age-older: #104281;
  --stale-bg: rgba(236,131,90,0.16);
  --stale-ink: #8a4021;
  /* heatmap: share of a repo's open issues falling in the bucket */
  --hm-1: #cde2fb; --hm-1-ink: #0b0b0b;
  --hm-2: #9ec5f4; --hm-2-ink: #0b0b0b;
  --hm-3: #6da7ec; --hm-3-ink: #0b0b0b;
  --hm-4: #2a78d6; --hm-4-ink: #ffffff;
  --hm-5: #1c5cab; --hm-5-ink: #ffffff;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --page: #0d0d0d;
    --surface: #1a1a19;
    --ink: #ffffff;
    --ink-2: #c3c2b7;
    --muted: #898781;
    --grid: #2c2c2a;
    --axis: #383835;
    --border: rgba(255,255,255,0.10);
    --merged: #3987e5;
    --issues: #d95926;
  --closed: #199e70;
    --closed: #199e70;
    --age-week: #b7d3f6;
    --age-month: #6da7ec;
    --age-year: #3987e5;
    --age-older: #1c5cab;
    --stale-bg: rgba(236,131,90,0.20);
    --stale-ink: #ec835a;
    --hm-1: #104281; --hm-1-ink: #ffffff;
    --hm-2: #1c5cab; --hm-2-ink: #ffffff;
    --hm-3: #2a78d6; --hm-3-ink: #ffffff;
    --hm-4: #5598e7; --hm-4-ink: #0b0b0b;
    --hm-5: #9ec5f4; --hm-5-ink: #0b0b0b;
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --page: #0d0d0d;
  --surface: #1a1a19;
  --ink: #ffffff;
  --ink-2: #c3c2b7;
  --muted: #898781;
  --grid: #2c2c2a;
  --axis: #383835;
  --border: rgba(255,255,255,0.10);
  --merged: #3987e5;
  --issues: #d95926;
  --closed: #199e70;
  --age-week: #b7d3f6;
  --age-month: #6da7ec;
  --age-year: #3987e5;
  --age-older: #1c5cab;
  --stale-bg: rgba(236,131,90,0.20);
  --stale-ink: #ec835a;
  --hm-1: #104281; --hm-1-ink: #ffffff;
  --hm-2: #1c5cab; --hm-2-ink: #ffffff;
  --hm-3: #2a78d6; --hm-3-ink: #ffffff;
  --hm-4: #5598e7; --hm-4-ink: #0b0b0b;
  --hm-5: #9ec5f4; --hm-5-ink: #0b0b0b;
}

body {
  margin: 0;
  background: var(--page);
  color: var(--ink);
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: 15px;
  line-height: 1.5;
}
.wrap { max-width: 1080px; margin: 0 auto; padding: 40px 24px 96px; }

.crumb { font-size: 13px; color: var(--muted); margin: 0 0 18px; }
.crumb a { color: var(--ink-2); border-bottom-color: transparent; }
.crumb a:hover { border-bottom-color: currentColor; }
.crumb .sep { padding: 0 7px; opacity: .55; }
header.top { border-bottom: 1px solid var(--grid); padding-bottom: 24px; margin-bottom: 32px; }
h1 { font-size: 30px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 6px; }
h1 .org { color: var(--muted); font-weight: 400; }
.stamp { color: var(--ink-2); font-size: 13.5px; margin: 0; }
.notice {
  margin-top: 16px; padding: 10px 14px; font-size: 13px; color: var(--ink-2);
  background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
}

.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-top: 24px; }
.tile { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 16px 18px; }
.tile .label { font-size: 12.5px; color: var(--ink-2); margin-bottom: 6px; }
.tile .value { font-size: 32px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.1; }
.tile .sub { font-size: 12px; color: var(--muted); margin-top: 4px; }

section { margin-top: 48px; }
h2 { font-size: 13px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
     color: var(--ink-2); margin: 0 0 4px; }
.section-note { color: var(--muted); font-size: 13px; margin: 0 0 18px; }

.legend { display: flex; flex-wrap: wrap; gap: 16px; margin: 0 0 14px; font-size: 12.5px; color: var(--ink-2); }
.legend .item { display: inline-flex; align-items: center; gap: 7px; }
.swatch { width: 11px; height: 11px; border-radius: 3px; flex: none; }

.card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.scroll { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-size: 13.5px; }
th, td { text-align: left; padding: 9px 14px; border-bottom: 1px solid var(--grid); vertical-align: middle; }
th { font-size: 11.5px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase;
     color: var(--muted); background: var(--surface); position: sticky; top: 0; }
tbody tr:last-child td { border-bottom: none; }
tr.total td { font-weight: 600; border-top: 1px solid var(--axis); }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
td.dim { color: var(--muted); }
a { color: inherit; text-decoration: none; border-bottom: 1px solid var(--axis); }
a:hover { border-bottom-color: currentColor; }
table.pr { table-layout: fixed; min-width: 760px; }
table.age { min-width: 860px; }
table.age td:first-child, table.act td:first-child { white-space: nowrap; }

/* heatmap cells: shade = share of that repo's own open issues */
td.hm { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap;
        border-left: 2px solid var(--surface); }
td.hm-0 { color: var(--muted); }
td.hm-1 { background: var(--hm-1); color: var(--hm-1-ink); }
td.hm-2 { background: var(--hm-2); color: var(--hm-2-ink); }
td.hm-3 { background: var(--hm-3); color: var(--hm-3-ink); }
td.hm-4 { background: var(--hm-4); color: var(--hm-4-ink); }
td.hm-5 { background: var(--hm-5); color: var(--hm-5-ink); }
.hm-key { display: inline-flex; align-items: center; gap: 0; margin-left: 4px;
          vertical-align: middle; }
.hm-key i { width: 22px; height: 11px; display: block; }
.hm-key i + i { border-left: 2px solid var(--surface); }
table.pr td.title-cell { white-space: normal; }
.repo-head { display: flex; align-items: baseline; gap: 10px; margin: 26px 0 10px; }
.repo-head:first-of-type { margin-top: 0; }
.repo-name { font-size: 15px; font-weight: 600; }
.repo-count { font-size: 12.5px; color: var(--muted); }
.title-cell { max-width: 440px; }
.badge { display: inline-block; font-size: 11px; padding: 2px 7px; border-radius: 999px;
         border: 1px solid var(--border); color: var(--ink-2); margin-right: 4px; white-space: nowrap; }
.badge.stale { background: var(--stale-bg); color: var(--stale-ink); border-color: transparent; }
.lock { font-size: 11px; color: var(--muted); }

.bar-cell { width: 46%; min-width: 200px; }
.bar-row { display: flex; align-items: center; gap: 2px; height: 14px; }
.bar-row .seg { height: 100%; min-width: 2px; }
.bar-row .seg:last-child { border-radius: 0 4px 4px 0; }
.grp { display: flex; flex-direction: column; gap: 3px; }
.grp .bar-row { height: 9px; }

#tip {
  position: fixed; z-index: 50; pointer-events: none; opacity: 0;
  transition: opacity .09s ease; background: var(--surface); color: var(--ink);
  border: 1px solid var(--border); border-radius: 8px; padding: 8px 11px;
  font-size: 12.5px; line-height: 1.45; box-shadow: 0 6px 22px rgba(0,0,0,0.18);
  max-width: 260px;
}
#tip .tip-title { font-weight: 600; margin-bottom: 3px; }
#tip .tip-row { color: var(--ink-2); white-space: nowrap; }

footer { margin-top: 56px; padding-top: 20px; border-top: 1px solid var(--grid);
         color: var(--muted); font-size: 12.5px; }
"""

TIP_JS = """
(function () {
  var tip = document.getElementById('tip');
  function show(e) {
    var t = e.currentTarget.getAttribute('data-tip');
    if (!t) return;
    tip.innerHTML = t;
    tip.style.opacity = '1';
    move(e);
  }
  function move(e) {
    var pad = 14, r = tip.getBoundingClientRect();
    var x = e.clientX + pad, y = e.clientY + pad;
    if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - pad;
    if (y + r.height > window.innerHeight - 8) y = e.clientY - r.height - pad;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }
  function hide() { tip.style.opacity = '0'; }
  document.querySelectorAll('[data-tip]').forEach(function (el) {
    el.addEventListener('mouseenter', show);
    el.addEventListener('mousemove', move);
    el.addEventListener('mouseleave', hide);
  });
})();
"""


def esc(text):
    return html.escape(str(text), quote=True)


def heat_step(share):
    """Map a 0-100 share onto heatmap step 0-5 (0 == empty, unshaded)."""
    if share <= 0:
        return 0
    for idx, edge in enumerate((10, 25, 50, 75), start=1):
        if share <= edge:
            return idx
    return 5


def seg(width_flex, color_var, tip):
    return (
        f'<span class="seg" style="flex:{width_flex} 1 0;background:var({color_var})" '
        f'data-tip="{esc(tip)}"></span>'
    )


def render_html(d):
    org = d["org"]
    stamp = d["generated"].strftime("%Y-%m-%d %H:%M UTC")
    o = []
    add = o.append

    add("<!doctype html>")
    add('<html lang="en"><head><meta charset="utf-8">')
    add('<meta name="viewport" content="width=device-width, initial-scale=1">')
    add(f"<title>{esc(org)} daily report — {esc(d['generated'].date())}</title>")
    add(f"<style>{CSS}</style></head><body><div id='tip'></div><div class='wrap'>")

    # header + stat tiles
    add("<header class='top'>")
    if d.get("crumbs"):
        bits = []
        for label, href in d["crumbs"]:
            bits.append(f"<a href='{esc(href)}'>{esc(label)}</a>" if href
                        else f"<span>{esc(label)}</span>")
        add("<p class='crumb'>" + "<span class='sep'>/</span>".join(bits) + "</p>")
    add(f"<h1>Daily report <span class='org'>· {esc(org)}</span></h1>")
    add(f"<p class='stamp'>Generated {esc(stamp)} · activity windows: "
        f"{d['days']} and {d['long_days']} days · new contributors over "
        f"{d['contrib_days']} days</p>")
    add("<div class='tiles'>")
    for label, value, sub in [
        ("Open pull requests", d["open_pr_count"], f"across {len(d['prs_by_repo'])} repos"),
        ("Merged PRs", d["merged_total"], f"last {d['days']} days"),
        ("New issues", d["new_issue_total"], f"last {d['days']} days"),
        ("New contributors", len(d["newcomers"]), f"last {d['contrib_days']} days"),
        ("Open issues", d["open_issue_total"],
         f"across {sum(1 for v in d['ages'].values() if sum(v.values()))} repos"),
        ("Nightlies", len(d["releases"]["nightlies"]),
         f"{sum(1 for r in d['releases']['nightlies'] if r['age_days'] < 7)}"
         f" refreshed this week"),
    ]:
        add(f"<div class='tile'><div class='label'>{esc(label)}</div>"
            f"<div class='value'>{value}</div><div class='sub'>{esc(sub)}</div></div>")
    add("</div>")
    if d["private_repos"] and not d["public_only"]:
        names = ", ".join(sorted(d["private_repos"]))
        add(f"<div class='notice'>Includes private repos ({esc(names)}), marked "
            f"<span class='lock'>● private</span> below. "
            f"Re-run with <code>--public-only</code> to exclude them.</div>")
    add("</header>")

    priv = d["private_repos"]

    def repo_label(name, path="", label=None):
        """Repo name as a link. `path` points at the relevant tab, so each
        section links where its numbers came from (issues, pulls, releases).
        `label` lets a product keep its own name while linking elsewhere."""
        mark = " <span class='lock'>● private</span>" if name in priv else ""
        href = f"https://github.com/{org}/{name}{path}"
        return f"<a href='{esc(href)}'>{esc(label or name)}</a>{mark}"

    # --- 1. open PRs -------------------------------------------------------
    add("<section><h2>1 · Open pull requests</h2>")
    add(f"<p class='section-note'>{d['open_pr_count']} open, oldest first within "
        f"each repo.</p>")
    if not d["prs_by_repo"]:
        add("<div class='card'><table><tbody><tr><td class='dim'>"
            "No open pull requests.</td></tr></tbody></table></div>")
    else:
        for repo in sorted(d["prs_by_repo"], key=lambda r: (-len(d["prs_by_repo"][r]), r.lower())):
            prs = d["prs_by_repo"][repo]
            add(f"<div class='repo-head'><span class='repo-name'>"
                f"{repo_label(repo, '/pulls')}</span>"
                f"<span class='repo-count'>{len(prs)} open</span></div>")
            add("<div class='card scroll'><table class='pr'>"
                "<colgroup><col style='width:78px'><col><col style='width:150px'>"
                "<col style='width:70px'><col style='width:190px'></colgroup>"
                "<thead><tr>"
                "<th class='num'>PR</th><th>Title</th><th>Author</th>"
                "<th class='num'>Age</th><th>Status</th></tr></thead><tbody>")
            for p in prs:
                badges = []
                if p["draft"]:
                    badges.append("<span class='badge'>draft</span>")
                if p["review"] == "APPROVED":
                    badges.append("<span class='badge'>approved</span>")
                elif p["review"] == "CHANGES_REQUESTED":
                    badges.append("<span class='badge'>changes requested</span>")
                if p["age_days"] >= 90:
                    badges.append("<span class='badge stale'>stale</span>")
                add(
                    f"<tr><td class='num'><a href='{esc(p['url'])}'>#{p['number']}</a></td>"
                    f"<td class='title-cell'>{esc(p['title'])}</td>"
                    f"<td class='dim'>{esc(p['author'])}</td>"
                    f"<td class='num' data-tip=\"opened {esc(p['created'].strftime('%Y-%m-%d'))}\">"
                    f"{esc(humanize_age(p['age_days']))}</td>"
                    f"<td>{''.join(badges) or '<span class=dim>—</span>'}</td></tr>"
                )
            add("</tbody></table></div>")
    add("</section>")

    # --- 2. activity, two windows ------------------------------------------
    add("<section><h2>2 · Activity</h2>")
    add("<p class='section-note'>Merged pull requests and newly opened issues by "
        "repo, over two windows. Bars share one scale within each table, not "
        "across them.</p>")
    add("<div class='legend'>"
        "<span class='item'><span class='swatch' style='background:var(--merged)'></span>"
        "Merged PRs</span>"
        "<span class='item'><span class='swatch' style='background:var(--issues)'></span>"
        "New issues</span>"
        "<span class='item'><span class='swatch' style='background:var(--closed)'></span>"
        "Closed issues</span></div>")

    def activity_table(act, merged_total, issue_total, closed_total,
                       window_days, since):
        add(f"<div class='repo-head'><span class='repo-name'>Last {window_days} days"
            f"</span><span class='repo-count'>since {esc(since)}</span></div>")
        if not act:
            add("<div class='card'><table><tbody><tr><td class='dim'>No merges or "
                "new issues in this window.</td></tr></tbody></table></div>")
            return
        rows = sorted(
            act.items(),
            key=lambda kv: (-(kv[1]["merged"] + kv[1]["issues"]
                              + kv[1]["closed"]), kv[0].lower()),
        )
        peak = max(max(v["merged"], v["issues"], v["closed"])
                   for _, v in rows) or 1
        add("<div class='card scroll'><table class='act'><thead><tr><th>Repo</th>"
            "<th class='num'>Merged</th><th class='num'>New issues</th>"
            "<th class='num'>Closed</th>"
            "<th class='bar-cell'></th></tr></thead><tbody>")
        for repo, v in rows:
            def row(count, var, name):
                if not count:
                    return "<span class='bar-row'></span>"
                tip = (f"<div class='tip-title'>{esc(repo)}</div>"
                       f"<div class='tip-row'>{name}: {count} "
                       f"in {window_days}d</div>")
                return (
                    f"<span class='bar-row'>{seg(count, var, tip)}"
                    f"<span style='flex:{peak - count} 1 0'></span></span>"
                )
            add(
                f"<tr><td>{repo_label(repo)}</td>"
                f"<td class='num'>{v['merged']}</td>"
                f"<td class='num'>{v['issues']}</td>"
                f"<td class='num'>{v['closed']}</td>"
                f"<td class='bar-cell'><span class='grp'>"
                f"{row(v['merged'], '--merged', 'Merged PRs')}"
                f"{row(v['issues'], '--issues', 'New issues')}"
                f"{row(v['closed'], '--closed', 'Closed issues')}"
                f"</span></td></tr>"
            )
        add(f"<tr class='total'><td>total</td><td class='num'>{merged_total}</td>"
            f"<td class='num'>{issue_total}</td>"
            f"<td class='num'>{closed_total}</td><td></td></tr>")
        add("</tbody></table></div>")

    activity_table(d["activity"], d["merged_total"], d["new_issue_total"],
                   d["closed_short"], d["days"], d["since"])
    activity_table(d["activity_long"], d["merged_total_long"],
                   d["new_issue_total_long"], d["closed_long"],
                   d["long_days"], d["since_long"])
    add("</section>")

    # --- 3. new contributors -----------------------------------------------
    add(f"<section><h2>3 · New contributors, last {d['contrib_days']} days</h2>")
    add(f"<p class='section-note'>Authors whose first ever merged PR in "
        f"{esc(org)} landed since {esc(d['since_contrib'])}. Bots excluded.</p>")
    if not d["newcomers"]:
        add(f"<div class='card'><table><tbody><tr><td class='dim'>No new "
            f"contributors in this window — all {d['contrib_authors']} authors "
            f"with merges are returning.</td></tr></tbody></table></div>")
    else:
        add("<div class='card scroll'><table class='act'><thead><tr>"
            "<th>Contributor</th><th>First merged PR</th><th>Repo</th>"
            "<th>Merged on</th><th class='num'>Merges since</th>"
            "</tr></thead><tbody>")
        for c in d["newcomers"]:
            repos_tip = ", ".join(c["repos"])
            add(
                f"<tr><td><a href='https://github.com/{esc(c['login'])}'>"
                f"@{esc(c['login'])}</a></td>"
                f"<td class='title-cell'><a href='{esc(c['first_url'])}'>"
                f"#{c['first_number']}</a> {esc(c['first_title'])}</td>"
                f"<td class='dim'>{repo_label(c['first_repo'])}</td>"
                f"<td class='dim'>{esc(c['first_at'].strftime('%Y-%m-%d'))}</td>"
                f"<td class='num' data-tip=\"{esc('repos: ' + repos_tip)}\">"
                f"{c['merges']}</td></tr>"
            )
        add(f"<tr class='total'><td>{len(d['newcomers'])} new</td>"
            f"<td colspan='4' class='dim'>of {d['contrib_authors']} authors with "
            f"merges in the window</td></tr>")
        add("</tbody></table></div>")
    add("</section>")

    # --- 4. issue ages -----------------------------------------------------
    add("<section><h2>4 · Open issue age</h2>")
    add("<p class='section-note'>Every open issue bucketed by how long it has been "
        "open. Each bar is that repo's own backlog split into shares, oldest "
        "darkest — volume is the Open column, sorted descending. Bucket cells are "
        "shaded by that bucket's share of the repo's backlog. The last column counts issues closed in the window, whenever they were opened.</p>")
    if not d["ages"]:
        add("<div class='card'><table><tbody><tr><td class='dim'>No open issues."
            "</td></tr></tbody></table></div>")
    else:
        add("<div class='legend'>")
        for key, label, _limit, _ch in BUCKETS:
            add(f"<span class='item'><span class='swatch' "
                f"style='background:var(--age-{key})'></span>{esc(label)}</span>")
        add("</div>")
        rows = sorted(
            d["ages"].items(), key=lambda kv: (-sum(kv[1].values()), kv[0].lower())
        )
        add("<div class='card scroll'><table class='age'><thead><tr><th>Repo</th>"
            "<th class='num'>Open</th><th class='bar-cell'>Age mix</th>"
            "<th class='num'>≤ 1w</th><th class='num'>≤ 1mo</th>"
            "<th class='num'>≤ 1y</th><th class='num'>&gt; 1y</th>"
            f"<th class='num'>Closed {d['closed_days']}d</th>"
            "</tr></thead><tbody>")
        for repo, counts in rows:
            total = sum(counts.values())
            segs = []
            for key, label, _limit, _ch in BUCKETS:
                n = counts[key]
                if not n:
                    continue
                tip = (
                    f"<div class='tip-title'>{esc(repo)}</div>"
                    f"<div class='tip-row'>{esc(label)}: {n} "
                    f"({pct(n, total):.0f}% of {total})</div>"
                )
                segs.append(seg(n, f"--age-{key}", tip))
            cells = []
            for key, label, _limit, _ch in BUCKETS:
                n = counts[key]
                share = pct(n, total)
                tip = (
                    f"<div class='tip-title'>{esc(repo)} · {esc(label)}</div>"
                    f"<div class='tip-row'>{n} of {total} open "
                    f"({share:.0f}%)</div>"
                )
                cells.append(
                    f"<td class='hm hm-{heat_step(share)}' data-tip=\"{esc(tip)}\">"
                    f"{n}</td>"
                )
            add(
                f"<tr><td>{repo_label(repo, '/issues')}</td>"
                f"<td class='num'>{total}</td>"
                f"<td class='bar-cell'><span class='bar-row'>{''.join(segs)}</span></td>"
                f"{''.join(cells)}"
                f"<td class='num'>{d['closed_recent'].get(repo, 0)}</td></tr>"
            )
        totals = {k: sum(c[k] for c in d["ages"].values()) for k in BUCKET_KEYS}
        add(
            f"<tr class='total'><td>total</td><td class='num'>{d['open_issue_total']}</td>"
            f"<td></td><td class='num'>{totals['week']}</td>"
            f"<td class='num'>{totals['month']}</td><td class='num'>{totals['year']}</td>"
            f"<td class='num'>{totals['older']}</td>"
            f"<td class='num'>{d['closed_total']}</td></tr>"
        )
        add("</tbody></table></div>")
        add("<p class='section-note' style='margin-top:12px'>Cell shade is the "
            "bucket's share of that repo's open issues: "
            "<span class='hm-key'>"
            "<i style='background:var(--hm-1)'></i>"
            "<i style='background:var(--hm-2)'></i>"
            "<i style='background:var(--hm-3)'></i>"
            "<i style='background:var(--hm-4)'></i>"
            "<i style='background:var(--hm-5)'></i></span> "
            "0% → 100%. The total row is unshaded (different scale).</p>")
    add("</section>")

    # --- 5. releases -------------------------------------------------------
    rel = d.get("releases") or {"nightlies": [], "stable": []}
    add("<section><h2>5 · Releases</h2>")
    add("<p class='section-note'>Nightly tags are re-uploaded in place, so a "
        "nightly's date is when its assets last changed, not when the tag was "
        "cut. Stable rows exclude drafts and prereleases.</p>")

    add("<div class='repo-head'><span class='repo-name'>Nightly builds</span>"
        f"<span class='repo-count'>{len(rel['nightlies'])} products</span></div>")
    if not rel["nightlies"]:
        add("<div class='card'><table><tbody><tr><td class='dim'>No repos "
            "publish a nightly release.</td></tr></tbody></table></div>")
    else:
        add("<div class='card scroll'><table class='act'><thead><tr>"
            "<th>Product</th><th>Last nightly</th><th class='num'>Age</th>"
            "<th>Status</th></tr></thead><tbody>")
        for r in rel["nightlies"]:
            badge = ("<span class='badge stale'>dormant</span>"
                     if r["age_days"] >= DORMANT_DAYS
                     else "<span class='dim'>—</span>")
            add(f"<tr><td>{repo_label(r['repo'], '/releases')}</td>"
                f"<td class='dim'><a href='{esc(r['url'])}'>"
                f"{esc(r['when'].strftime('%Y-%m-%d'))}</a></td>"
                f"<td class='num'>{esc(humanize_age(r['age_days']))}</td>"
                f"<td>{badge}</td></tr>")
        add("</tbody></table></div>")

    add("<div class='repo-head'><span class='repo-name'>Latest stable release"
        f"</span><span class='repo-count'>{len(rel['stable'])} products</span>"
        "</div>")
    if not rel["stable"]:
        add("<div class='card'><table><tbody><tr><td class='dim'>No repos "
            "publish a tagged stable release.</td></tr></tbody></table></div>")
    else:
        add("<div class='card scroll'><table class='act'><thead><tr>"
            "<th>Product</th><th>Version</th><th>Released</th>"
            "<th class='num'>Age</th></tr></thead><tbody>")
        for r in rel["stable"]:
            src = r.get("source", r["repo"])
            via = ("" if src == r["repo"]
                   else f" <span class='repo-count'>via {esc(src)}</span>")
            add(f"<tr><td>{repo_label(src, '/releases', label=r['repo'])}{via}</td>"
                f"<td><a href='{esc(r['url'])}'>{esc(r['tag'])}</a></td>"
                f"<td class='dim'>{esc(r['when'].strftime('%Y-%m-%d'))}</td>"
                f"<td class='num'>{esc(humanize_age(r['age_days']))}</td></tr>")
        add("</tbody></table></div>")
    add("</section>")

    add(f"<footer>Read-only report generated by surge_report.py from the GitHub "
        f"API · {esc(org)} · {esc(stamp)}</footer>")
    add(f"</div><script>{TIP_JS}</script></body></html>")
    return "\n".join(o)


# ---------------------------------------------------------------------------
# Discord
# ---------------------------------------------------------------------------


def post_to_discord(webhook, message, attachments):
    """POST a message with file attachments to a Discord webhook (multipart)."""
    boundary = uuid.uuid4().hex
    body = bytearray()

    def field(name, value):
        body.extend(f"--{boundary}\r\n".encode())
        body.extend(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
        body.extend(value.encode("utf-8"))
        body.extend(b"\r\n")

    payload = {"content": message, "allowed_mentions": {"parse": []}}
    field("payload_json", json.dumps(payload))

    for idx, path in enumerate(attachments):
        name = os.path.basename(path)
        ctype = mimetypes.guess_type(name)[0] or "application/octet-stream"
        with open(path, "rb") as fh:
            data = fh.read()
        body.extend(f"--{boundary}\r\n".encode())
        body.extend(
            f'Content-Disposition: form-data; name="files[{idx}]"; '
            f'filename="{name}"\r\n'.encode()
        )
        body.extend(f"Content-Type: {ctype}\r\n\r\n".encode())
        body.extend(data)
        body.extend(b"\r\n")

    body.extend(f"--{boundary}--\r\n".encode())

    req = urllib.request.Request(
        webhook,
        data=bytes(body),
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            # Required. Discord is behind Cloudflare, which rejects urllib's
            # default "Python-urllib/x.y" agent with a 403 (error 1010).
            "User-Agent": "surge-report/1.0 (+https://surge-synth-team.org)",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:500].strip()
        raise GitHubError(
            f"Discord rejected the post: HTTP {exc.code}: {detail}"
        ) from None


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main(argv=None):
    ap = argparse.ArgumentParser(
        description="Read-only daily activity report for a GitHub org.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    ap.add_argument("--org", default=DEFAULT_ORG, help="GitHub organization")
    ap.add_argument("--days", type=int, default=7,
                    help="short activity window in days")
    ap.add_argument("--long-days", type=int, default=90,
                    help="long activity window in days")
    ap.add_argument("--contrib-days", type=int, default=30,
                    help="window for the new-contributors section")
    ap.add_argument("--closed-days", type=int, default=30,
                    help="window for the closed-issues column")
    ap.add_argument("--out", default=".", help="output directory")
    ap.add_argument("--publish-dir", default=None,
                    help="root of the Astro site repo; writes the report to "
                         "public/reports/<slug>/ ready to commit and push")
    ap.add_argument("--slug", default="surge-repo-activity",
                    help="URL slug under /reports/ when publishing")
    ap.add_argument("--site-name", default="surge-synth-team.org",
                    help="site name shown in the published page's breadcrumb")
    ap.add_argument("--summary-json", default=None,
                    help="write the headline counts to this JSON file, for a "
                         "downstream notification step")
    ap.add_argument("--discord-payload", default=None,
                    help="write a ready-to-POST Discord webhook JSON body to "
                         "this file; the workflow curls it verbatim")
    ap.add_argument("--report-url", default=None,
                    help="public URL of the published report, used in the "
                         "Discord payload")
    ap.add_argument("--public-only", action="store_true",
                    help="exclude private repos from every query")
    ap.add_argument("--open", dest="open_browser", action="store_true",
                    help="open the HTML report in a browser")
    ap.add_argument("--quiet", action="store_true", help="suppress progress output")
    ap.add_argument(
        "--discord-webhook",
        default=os.environ.get("SURGE_REPORT_DISCORD_WEBHOOK"),
        help="Discord webhook URL; posts the report as a file attachment "
             "(env: SURGE_REPORT_DISCORD_WEBHOOK)",
    )
    ap.add_argument("--discord-attach", choices=["md", "html", "both"], default="md",
                    help="which file(s) to attach to the Discord post")
    args = ap.parse_args(argv)

    long_days = max(args.long_days, args.days, args.contrib_days)
    if long_days != args.long_days:
        print(f"note: widening --long-days to {long_days} to cover the other "
              f"windows", file=sys.stderr)
    try:
        data = collect(args.org, args.days, long_days, args.contrib_days,
                       args.closed_days, args.public_only,
                       verbose=not args.quiet)
    except GitHubError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    outdir = os.path.abspath(args.out)
    os.makedirs(outdir, exist_ok=True)
    stem = f"{args.org}-report-{data['generated'].date()}"
    md_path = os.path.join(outdir, stem + ".md")
    html_path = os.path.join(outdir, stem + ".html")

    markdown = render_markdown(data)
    with open(md_path, "w", encoding="utf-8") as fh:
        fh.write(markdown)
    with open(html_path, "w", encoding="utf-8") as fh:
        fh.write(render_html(data))

    if not args.quiet:
        print(f"\nwrote {md_path}", file=sys.stderr)
        print(f"wrote {html_path}", file=sys.stderr)

    if args.publish_dir:
        site = os.path.abspath(args.publish_dir)
        pubroot = os.path.join(site, "public")
        if not os.path.isdir(pubroot):
            print(f"error: {pubroot} does not exist — is {site} the site repo "
                  f"root?", file=sys.stderr)
            return 1
        dest = os.path.join(pubroot, "reports", args.slug)
        os.makedirs(dest, exist_ok=True)
        # Published copy carries a breadcrumb back into the site.
        published = dict(data)
        published["crumbs"] = [
            (args.site_name, "/"),
            (args.slug.replace("-", " "), None),
        ]
        with open(os.path.join(dest, "index.html"), "w", encoding="utf-8") as fh:
            fh.write(render_html(published))
        with open(os.path.join(dest, "report.md"), "w", encoding="utf-8") as fh:
            fh.write(markdown)
        if not args.quiet:
            print(f"published to {dest}/index.html  →  /reports/{args.slug}/",
                  file=sys.stderr)

    if args.summary_json:
        summary = {
            "org": data["org"],
            "generated": data["generated"].isoformat(),
            "slug": args.slug,
            "open_prs": data["open_pr_count"],
            "open_issues": data["open_issue_total"],
            "merged": data["merged_total"],
            "new_issues": data["new_issue_total"],
            "new_contributors": len(data["newcomers"]),
            "days": data["days"],
            "contrib_days": data["contrib_days"],
        }
        os.makedirs(os.path.dirname(os.path.abspath(args.summary_json)) or ".",
                    exist_ok=True)
        with open(args.summary_json, "w", encoding="utf-8") as fh:
            json.dump(summary, fh, indent=2)
        if not args.quiet:
            print(f"wrote summary {args.summary_json}", file=sys.stderr)

    if args.discord_payload:
        line = (f"**{data['org']} report available.** "
                f"{data['open_pr_count']} open PRs and "
                f"{data['open_issue_total']} open issues.")
        url = args.report_url or f"https://{args.site_name}/reports/{args.slug}/"
        payload = {"content": f"{line}\n{url}",
                   "allowed_mentions": {"parse": []}}
        os.makedirs(os.path.dirname(os.path.abspath(args.discord_payload)) or ".",
                    exist_ok=True)
        with open(args.discord_payload, "w", encoding="utf-8") as fh:
            json.dump(payload, fh)  # single line, safe for a job output
        if not args.quiet:
            print(f"wrote discord payload {args.discord_payload}", file=sys.stderr)

    if args.discord_webhook:
        attach = {"md": [md_path], "html": [html_path], "both": [md_path, html_path]}[
            args.discord_attach
        ]
        summary = (
            f"**{args.org} daily report** — {data['generated'].strftime('%Y-%m-%d')}\n"
            f"{data['open_pr_count']} open PRs · {data['merged_total']} merges "
            f"and {data['new_issue_total']} new issues in {args.days}d · "
            f"{len(data['newcomers'])} new contributors in "
            f"{args.contrib_days}d · {data['open_issue_total']} open issues"
        )
        try:
            status = post_to_discord(args.discord_webhook, summary, attach)
            if not args.quiet:
                print(f"posted to Discord (HTTP {status})", file=sys.stderr)
        except Exception as exc:
            print(f"error: Discord post failed: {exc}", file=sys.stderr)
            return 1

    if args.open_browser:
        webbrowser.open("file://" + html_path)

    return 0


if __name__ == "__main__":
    sys.exit(main())
