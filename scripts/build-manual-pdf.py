#!/usr/bin/env python3
"""Convert an MDX manual under src/content/docs to a single PDF via pandoc."""

import argparse
import json
import re
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).parent.parent
SITE = "https://surge-synth-team.org"
AUTHOR = "Surge Synth Team"


@dataclass(frozen=True)
class Manual:
    slug: str
    title: str
    exclude: tuple[str, ...] = field(default=())

    @property
    def source_dir(self) -> Path:
        return ROOT / "src/content/docs" / self.slug / "manual"

    @property
    def image_dir(self) -> Path:
        return ROOT / "src/images" / self.slug

    @property
    def output(self) -> Path:
        return ROOT / "public" / f"{self.slug}-manual.pdf"

    @property
    def sources(self) -> list[Path]:
        """Everything whose content ends up inside the PDF."""
        return [d for d in (self.source_dir, self.image_dir) if d.is_dir()]

    @property
    def fix_command(self) -> str:
        return f"python3 scripts/build-manual-pdf.py {self.slug}"


MANUALS = {
    m.slug: m
    for m in (
        Manual("ob-xf", "OB-Xf Manual"),
        # the 3.0 cleanup list is site-only scaffolding, not part of the manual
        Manual("spectrumworx", "SpectrumWorx Manual", exclude=("to-update-for-3-0",)),
    )
}


def parse_frontmatter(text: str) -> tuple[dict, str]:
    """Extract YAML frontmatter and return (meta, body)."""
    if not text.startswith("---"):
        return {}, text
    end = text.index("\n---", 3)
    fm_text = text[4:end]
    body = text[end + 4:].lstrip("\n")
    meta: dict = {}
    key = None
    for line in fm_text.splitlines():
        if m := re.match(r"^(\w[\w-]*):\s*(.*)", line):
            key = m.group(1)
            meta[key] = m.group(2).strip()
        elif m2 := re.match(r"^\s+(\w[\w-]*):\s*(.*)", line):
            meta[f"{key}.{m2.group(1)}"] = m2.group(2).strip()
    return meta, body


def clean_mdx(body: str) -> str:
    """Strip MDX-specific syntax that pandoc can't handle."""
    # Remove JSX block comments: {/* ... */} (possibly multiline)
    body = re.sub(r"\{/\*.*?\*/\}", "", body, flags=re.DOTALL)
    # Remove any remaining bare JSX expressions on their own line: {expression}
    body = re.sub(r"^\{[^}\n]*\}\s*$", "", body, flags=re.MULTILINE)
    # Remove import/export statements
    body = re.sub(r"^(?:import|export)\s+.*$", "", body, flags=re.MULTILINE)
    return body


def resolve_targets(body: str, source: Path) -> str:
    """Make link and image targets work from the temp file pandoc actually reads."""

    def fix(match: re.Match[str]) -> str:
        bang, label, target = match.group(1), match.group(2), match.group(3).strip()
        if target.startswith("/"):
            # site-absolute: no such path in a PDF, so point at the live site
            return f"{bang}[{label}]({SITE}{target})"
        if bang and not re.match(r"^[a-z]+:", target):
            # empty alt keeps the caption but drops \includegraphics[alt=],
            # whose key graphicx only learned in 2022
            return f"{bang}[{label}]({(source.parent / target).resolve()}){{alt=\"\"}}"
        return match.group(0)

    return re.sub(r"(!?)\[([^\]]*)\]\(([^)]+)\)", fix, body)


def collect_pages(manual: Manual) -> list[tuple[int, str, str]]:
    """Return list of (order, title, markdown_body) sorted by order."""
    pages = []
    for mdx_file in manual.source_dir.glob("*.mdx"):
        if mdx_file.stem in manual.exclude:
            continue
        text = mdx_file.read_text(encoding="utf-8")
        meta, body = parse_frontmatter(text)
        order = int(meta.get("sidebar.order", 999))
        title = meta.get("title", mdx_file.stem).strip('"')
        body = resolve_targets(clean_mdx(body), mdx_file)
        pages.append((order, title, body))
    pages.sort(key=lambda p: p[0])
    return pages


def build_combined_markdown(pages: list[tuple[int, str, str]]) -> str:
    chunks = [f"# {title}\n\n{body.strip()}" for _order, title, body in pages]
    return "\n\n\\newpage\n\n".join(chunks)


def build(manual: Manual) -> None:
    pages = collect_pages(manual)
    if not pages:
        sys.exit(f"No .mdx files found in {manual.source_dir}")

    with tempfile.NamedTemporaryFile(
        suffix=".md", mode="w", encoding="utf-8", delete=False
    ) as tmp:
        tmp.write(build_combined_markdown(pages))
        tmp_path = tmp.name

    cmd = [
        "pandoc",
        tmp_path,
        "--from=markdown",
        "--to=pdf",
        f"--output={manual.output}",
        f"--metadata=title:{manual.title}",
        f"--metadata=author:{AUTHOR}",
        "--pdf-engine=xelatex",
        "--toc",
        "--toc-depth=2",
        "-V", "geometry:margin=25mm",
        "-V", "fontsize=11pt",
        "-V", "mainfont=Helvetica",
    ]

    print(f"Building {manual.output.name} from {len(pages)} pages...")
    result = subprocess.run(cmd, capture_output=True, text=True)

    Path(tmp_path).unlink(missing_ok=True)

    if result.returncode != 0:
        print("pandoc stderr:", result.stderr, file=sys.stderr)
        sys.exit(result.returncode)

    print(f"Done: {manual.output}")


def git(*args: str) -> str:
    result = subprocess.run(
        ["git", *args], cwd=ROOT, capture_output=True, text=True, check=False
    )
    return result.stdout.strip() if result.returncode == 0 else ""


def last_commit_date(paths: list[Path]) -> datetime | None:
    """When any of these paths was last committed, or None if never."""
    if not paths:
        return None
    rel = [str(p.relative_to(ROOT)) for p in paths]
    stamp = git("log", "-1", "--format=%cI", "--", *rel)
    return datetime.fromisoformat(stamp) if stamp else None


def stamp(when: datetime | None) -> str | None:
    # minutes, not just the date: two commits a minute apart on the same day
    # is exactly the confusing case
    return when.strftime("%Y-%m-%d %H:%M") if when else None


def check(manual: Manual) -> dict:
    """Is the committed PDF older than the manual it was built from?"""
    pdf = last_commit_date([manual.output])
    source = last_commit_date(manual.sources)
    stale = pdf is None or (source is not None and source > pdf)
    return {
        "slug": manual.slug,
        "title": manual.title,
        "pdf": manual.output.relative_to(ROOT).as_posix(),
        "pdf_committed": stamp(pdf),
        "source_committed": stamp(source),
        "stale": stale,
        "fix": manual.fix_command,
    }


def run_checks(manuals: list[Manual], out: str | None) -> int:
    # git log on a shallow clone sees one commit and would call everything
    # stale; CI must check out with fetch-depth: 0
    if git("rev-parse", "--is-shallow-repository") == "true":
        print(
            "Shallow clone: commit dates are not available, skipping the check.",
            file=sys.stderr,
        )
        if out:
            Path(out).write_text(json.dumps([]), encoding="utf-8")
        return 0

    results = [check(m) for m in manuals]
    for r in results:
        state = "STALE" if r["stale"] else "ok"
        print(
            f"{state:5} {r['slug']}: manual {r['source_committed']}, "
            f"pdf {r['pdf_committed'] or 'never committed'}"
        )

    if out:
        Path(out).write_text(json.dumps(results), encoding="utf-8")

    return 1 if any(r["stale"] for r in results) else 0


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "manual",
        nargs="?",
        default="all",
        choices=["all", *MANUALS],
        help="which manual to act on (default: all)",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="report whether each PDF predates its manual instead of building; "
             "exits 1 if any is stale",
    )
    parser.add_argument(
        "--json",
        metavar="FILE",
        help="with --check, write the verdict for surge_report.py to read",
    )
    args = parser.parse_args()

    targets = list(MANUALS.values()) if args.manual == "all" else [MANUALS[args.manual]]

    if args.check:
        sys.exit(run_checks(targets, args.json))

    for manual in targets:
        build(manual)


if __name__ == "__main__":
    main()
