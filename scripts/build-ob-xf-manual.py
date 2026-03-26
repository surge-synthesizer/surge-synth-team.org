#!/usr/bin/env python3
"""Convert the OB-Xf MDX manual pages to a single PDF via pandoc."""

import re
import subprocess
import sys
import tempfile
from pathlib import Path

MANUAL_DIR = Path(__file__).parent.parent / "src/content/docs/ob-xf/manual"
OUTPUT_PDF = Path(__file__).parent.parent / "public" / "ob-xf-manual.pdf"

TITLE = "OB-Xf Manual"
AUTHOR = "Surge Synth Team"


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
        elif re.match(r"^\s+(\w[\w-]*):\s*(.*)", line):
            m2 = re.match(r"^\s+(\w[\w-]*):\s*(.*)", line)
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


def collect_pages() -> list[tuple[int, str, str]]:
    """Return list of (order, title, markdown_body) sorted by order."""
    pages = []
    for mdx_file in MANUAL_DIR.glob("*.mdx"):
        text = mdx_file.read_text(encoding="utf-8")
        meta, body = parse_frontmatter(text)
        order = int(meta.get("sidebar.order", 999))
        title = meta.get("title", mdx_file.stem)
        body = clean_mdx(body)
        pages.append((order, title, body))
    pages.sort(key=lambda p: p[0])
    return pages


def build_combined_markdown(pages: list[tuple[int, str, str]]) -> str:
    chunks = []
    for _order, title, body in pages:
        chunks.append(f"# {title}\n\n{body.strip()}")
    return "\n\n\\newpage\n\n".join(chunks)


def main() -> None:
    pages = collect_pages()
    if not pages:
        sys.exit(f"No .mdx files found in {MANUAL_DIR}")

    combined = build_combined_markdown(pages)

    with tempfile.NamedTemporaryFile(
        suffix=".md", mode="w", encoding="utf-8", delete=False
    ) as tmp:
        tmp.write(combined)
        tmp_path = tmp.name

    cmd = [
        "pandoc",
        tmp_path,
        "--from=markdown",
        "--to=pdf",
        f"--output={OUTPUT_PDF}",
        f"--metadata=title:{TITLE}",
        f"--metadata=author:{AUTHOR}",
        "--pdf-engine=xelatex",
        "--toc",
        "--toc-depth=2",
        "-V", "geometry:margin=25mm",
        "-V", "fontsize=11pt",
        "-V", "mainfont=Helvetica",
    ]

    print(f"Building PDF from {len(pages)} pages...")
    result = subprocess.run(cmd, capture_output=True, text=True)

    Path(tmp_path).unlink(missing_ok=True)

    if result.returncode != 0:
        print("pandoc stderr:", result.stderr, file=sys.stderr)
        sys.exit(result.returncode)

    print(f"Done: {OUTPUT_PDF}")


if __name__ == "__main__":
    main()
