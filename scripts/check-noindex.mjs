/*
 * Unreleased and superseded pages carry noindex, and nothing else does.
 *
 * The rule lives in src/components/starlight/Head.astro and in Base.astro's
 * `noindex` prop, which is easy to get subtly wrong: a new doc set inherits
 * nothing, and a page that stops being unreleased keeps the flag until someone
 * remembers. Both directions are failures here - an unreleased page that is
 * indexable competes with the shipped one, and a shipped page that is not
 * indexable quietly disappears from search.
 *
 * What should carry it, matching Head.astro:
 *
 * - a nightly manual                   /<product>/manual-nightly/...
 * - a frozen manual of an old version  /<product>/manual/archive/...
 * - superseded release notes           /<product>/changelog/archive/...
 * - notes for a release not yet out    `nightly: true` in frontmatter, which
 *                                      is a version-numbered URL, so it is
 *                                      read from the sources rather than
 *                                      guessed from the path
 *
 * Redirect stubs are skipped: Astro gives them their own noindex and they are
 * nobody's canonical URL.
 *
 * Run against dist/ after a build: node scripts/check-noindex.mjs
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";
const PRODUCTS = "src/content/products";

if (!existsSync(DIST)) {
    console.log("FAIL  dist/ does not exist - build first.");
    process.exit(1);
}

/** Paths whose pages are unreleased notes, read from `nightly: true`. */
const nightlyNotes = new Set();

const findNightlyNotes = (relative) => {
    const absolute = join(PRODUCTS, relative);

    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
        const next = `${relative}/${entry.name}`;

        if (entry.isDirectory()) {
            findNightlyNotes(next);
        } else if (/\.mdx?$/.test(entry.name)) {
            const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(
                readFileSync(join(PRODUCTS, next), "utf8"),
            );

            if (front && /^\s*nightly:\s*true\s*$/m.test(front[1])) {
                nightlyNotes.add(`/${next.replace(/\.mdx?$/, "")}/`);
            }
        }
    }
};

for (const product of readdirSync(PRODUCTS, { withFileTypes: true })) {
    if (product.isDirectory()) findNightlyNotes(product.name);
}

const shouldBeNoindex = (path) =>
    path.includes("/manual-nightly/") ||
    path.includes("/manual/archive/") ||
    path.includes("/changelog/archive/") ||
    nightlyNotes.has(path);

let checked = 0;
let wrong = 0;

const walk = (relative) => {
    for (const entry of readdirSync(join(DIST, relative), { withFileTypes: true })) {
        const next = relative ? `${relative}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
            walk(next);
            continue;
        }

        if (entry.name !== "index.html") continue;

        const html = readFileSync(join(DIST, next), "utf8");

        if (/<meta http-equiv="refresh"/i.test(html)) continue;

        const path = `/${relative ? `${relative}/` : ""}`;
        const has = /<meta name="robots" content="[^"]*noindex/i.test(html);
        const want = shouldBeNoindex(path);

        checked++;

        if (has !== want) {
            wrong++;
            console.log(
                want
                    ? `FAIL  ${path} is unreleased or superseded but is indexable`
                    : `FAIL  ${path} is shipped content but carries noindex`,
            );
        }
    }
};

walk("");

if (wrong) {
    console.log(`\n${wrong} of ${checked} page(s) have the wrong robots policy.`);
    process.exit(1);
}

console.log(`All ${checked} pages carry the robots policy their path calls for.`);
