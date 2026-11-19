/*
 * Every anchor link inside a manual or changelog must resolve to a real target.
 *
 * The Surge manual was one long page, so every cross-reference was a bare
 * #fragment. Split into chapters, a fragment only resolves within its own page:
 * 74 of 99 links silently pointed at nothing, landing the reader at the top of
 * whichever chapter they were already on.
 *
 * Targets are read from the built HTML rather than recomputed from the MDX,
 * because rehype-slug's output is what ships - it disambiguates repeated
 * headings with a numeric suffix, and slugs a heading containing inline HTML
 * from its text content. Reimplementing that is how a checker invents failures
 * that are not real, and misses ones that are.
 *
 * Run against dist/ after a build: node scripts/check-manual-links.mjs
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";

const manuals = [];

for (const product of readdirSync(DIST, { withFileTypes: true })) {
    if (!product.isDirectory()) continue;

    for (const folder of readdirSync(join(DIST, product.name), { withFileTypes: true })) {
        if (
            folder.isDirectory() &&
            /^(manual(-[a-z]+)?|changelog|microtuning-guide)$/.test(folder.name)
        ) {
            manuals.push(`${product.name}/${folder.name}`);
        }
    }
}

let checked = 0;
let broken = 0;

const body = (html) => html.slice(html.indexOf("<main"), html.indexOf("</main>"));

for (const manual of manuals) {
    const base = join(DIST, manual);
    /*
     * Walk to any depth rather than a fixed one or two levels. An archived
     * manual sits at manual/archive/<version>/<chapter>, three deep, and the
     * old two-level walk skipped every page of it - so the checker reported
     * that everything resolved while 30 of Surge 1.9's links dangled. A gate
     * that quietly stops looking is worse than no gate.
     */
    const chapters = [];

    const walk = (relative) => {
        for (const entry of readdirSync(relative ? join(base, relative) : base, {
            withFileTypes: true,
        })) {
            if (!entry.isDirectory()) continue;

            const next = relative ? `${relative}/${entry.name}` : entry.name;

            if (existsSync(join(base, next, "index.html"))) chapters.push(next);

            walk(next);
        }
    };

    walk("");

    // chapter -> the ids and names that page actually renders
    const targets = new Map();

    for (const chapter of chapters) {
        const main = body(readFileSync(join(base, chapter, "index.html"), "utf8"));
        const owned = new Set();

        for (const match of main.matchAll(/\s(?:id|name)="([^"]+)"/g)) owned.add(match[1]);

        targets.set(chapter, owned);
    }

    for (const chapter of chapters) {
        const main = body(readFileSync(join(base, chapter, "index.html"), "utf8"));

        const report = (where, anchor) => {
            broken++;
            console.log(`FAIL  /${manual}/${chapter}/  ->  ${where}#${anchor}`);
        };

        for (const match of main.matchAll(/href="#([^"]+)"/g)) {
            if (match[1] === "_top") continue;
            checked++;
            if (!targets.get(chapter)?.has(match[1])) report("", match[1]);
        }

        const cross = new RegExp(`href="/${manual}/([^/"#]+)/#([^"]+)"`, "g");

        for (const match of main.matchAll(cross)) {
            checked++;
            if (!targets.get(match[1])?.has(match[2])) report(`${match[1]}/`, match[2]);
        }
    }
}

if (broken > 0) {
    console.error(`\n${broken} of ${checked} manual anchor link(s) resolve to nothing.`);
    process.exit(1);
}

console.log(
    `All ${checked} anchor links across ${manuals.length} doc set(s) resolve: ${manuals.join(", ")}`,
);
