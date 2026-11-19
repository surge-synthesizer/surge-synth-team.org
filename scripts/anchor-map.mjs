/*
 * Build the anchor -> page table the redirect shell needs, and refuse to emit
 * one that has lost an anchor.
 *
 * Surge 1.9 compiled an absolute help_url into every binary it shipped, and
 * those links are bare `#fragment`s against a manual that is now eight pages.
 * A fragment never reaches the server, so the shell resolves them in the
 * browser from this table. Generating it from the built HTML rather than from
 * the MDX is deliberate: rehype-slug's output is what actually ships, and it
 * disambiguates repeated headings with a numeric suffix that no reimplemented
 * slugger would reproduce faithfully.
 *
 * ANCHORS is the list as the single-page manual rendered it, captured before
 * the split. Every one of them must still resolve, and the mapping is by
 * DOCUMENT ORDER rather than by name: the split preserved the order exactly,
 * but not the slugs of repeated headings. Two sections both titled "LFOs" were
 * `#lfos` and `#lfos-1` on one page; on eight pages they are `#lfos` apiece,
 * and `#lfos-1` exists nowhere. Matching by name silently drops it - matching
 * by position puts it on the right page, which is why this reconstructs the
 * original sequence instead of searching for each anchor.
 *
 * A mismatch is a broken in-app help link for an installed base nobody can
 * patch, so it fails the build rather than printing a warning.
 *
 * Run against dist/ after a build: node scripts/anchor-map.mjs
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";
const BASE = "surge-xt/manual/archive/1.9";
const OUT = join(DIST, "anchor-map-1.9.json");

/** The 152 anchors the single-page 1.9 manual rendered, in document order. */
const ANCHORS = JSON.parse(readFileSync("scripts/anchors-1.9.json", "utf8"));

/*
 * Anchors whose content has deliberately been removed, and the page that used
 * to hold them. An old link still has to land somewhere sensible, so these
 * resolve to that page rather than disappearing from the table.
 *
 * anchors-1.9.json is left alone on purpose: it records what the shipped manual
 * rendered, which is what a 1.9 binary may still ask for. This is the list of
 * decisions taken since, and entries here are removed from the positional
 * comparison so a deletion mid-document cannot shift everything after it.
 *
 * - questions: a "come ask us on Discord" sign-off, redundant now that every
 *   page carries Contact in its nav. Not a parameter help target - 1.9's
 *   help_url entries all point at parameter sections.
 */
const RETIRED = {
    questions: "technical-reference",
};

const root = join(DIST, BASE);

if (!existsSync(root)) {
    console.log(`FAIL  ${root} does not exist - build first.`);
    process.exit(1);
}

/*
 * Document order, which is the sidebar's order - not readdirSync's, which is
 * alphabetical and would scramble the correspondence this depends on.
 */
const PAGES = [
    "getting-started",
    "introduction-to-the-user-interface",
    "patchglobal-section",
    "scene-controls-section",
    "modulationrouting-section",
    "fx-section",
    "menu-button",
    "technical-reference",
];

/*
 * Rebuild the sequence the single page used to render: each section heading,
 * which is now a page of its own, followed by that page's headings in order.
 */
const expected = [];

for (const page of PAGES) {
    if (!existsSync(join(root, page, "index.html"))) {
        console.log(`FAIL  ${BASE}/${page}/ was not built`);
        process.exit(1);
    }

    const html = readFileSync(join(root, page, "index.html"), "utf8");
    const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));

    expected.push({ anchor: page, target: `/${BASE}/${page}/` });

    for (const match of main.matchAll(/<h[2-6][^>]*\sid="([^"]+)"/g)) {
        expected.push({ anchor: match[1], target: `/${BASE}/${page}/#${match[1]}` });
    }
}

const problems = [];
const map = {};

for (const [anchor, page] of Object.entries(RETIRED)) {
    if (!PAGES.includes(page)) {
        problems.push(`#${anchor} is retired onto ${page}, which is not a page`);
        continue;
    }

    map[anchor] = `/${BASE}/${page}/`;
}

/* Retired anchors no longer render, so they take no position in the sequence. */
const live = ANCHORS.filter((anchor) => !(anchor in RETIRED));

if (expected.length !== live.length) {
    problems.push(`${live.length} anchors expected after retirements, ${expected.length} rendered`);
}

for (const [index, anchor] of live.entries()) {
    const found = expected[index];

    if (!found) break;

    /*
     * The slug is either unchanged, or the old one carried a disambiguating
     * suffix that a page of its own no longer needs. Anything else means the
     * sequences have slipped out of step and the rest of the table is guesswork.
     */
    if (anchor !== found.anchor && anchor.replace(/-\d+$/, "") !== found.anchor) {
        problems.push(`position ${index}: #${anchor} does not line up with #${found.anchor}`);
    }

    map[anchor] = found.target;
}

for (const problem of problems) console.log(`FAIL  ${problem}`);

if (problems.length) {
    console.log(`\n${problems.length} problem(s); table not written.`);
    process.exit(1);
}

writeFileSync(OUT, JSON.stringify(map, null, 2) + "\n");

const retired = Object.keys(RETIRED).length;
const asAnchor = Object.values(map).filter((target) => target.includes("#")).length;

console.log(
    `All ${ANCHORS.length} of Surge 1.9's anchors resolve across ${PAGES.length} pages ` +
        `(${asAnchor} within a page, ${ANCHORS.length - asAnchor - retired} as a page of ` +
        `their own, ${retired} retired to the page that held them).`,
);
console.log(`Table written to ${OUT} for the 5c redirect shell.`);
