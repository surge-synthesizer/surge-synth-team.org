/*
 * Every internal link on every built page resolves.
 *
 * check-manual-links.mjs is narrower on purpose: it reports per doc set and
 * only sees manuals and changelogs. This is the site-wide sweep that used to
 * be run by hand - it covers product pages, org pages and the reports, and it
 * is the one that would have caught the Tuning Note CLAPs page pointing at the
 * old site, or /shortcircuit-xt#faq after the FAQ became a page of its own.
 *
 * Checked, for each page:
 *
 * - a root-absolute href ("/surge-xt/manual/") resolves to a built page, a
 *   redirect, or a file in dist
 * - a fragment on it names an id that page actually renders
 * - a bare "#fragment" names an id on the page carrying the link
 *
 * Targets come from the built HTML rather than from the sources, for the same
 * reason the manual checker does it: rehype-slug's output is what ships, and
 * it disambiguates repeated headings in ways no reimplementation would match.
 *
 * External links are not fetched. This is a build gate, not a link rot
 * crawler - it must not depend on the network or on anyone else's uptime.
 *
 * Run against dist/ after a build: node scripts/check-links.mjs
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";

if (!existsSync(DIST)) {
    console.log("FAIL  dist/ does not exist - build first.");
    process.exit(1);
}

/** Every built page, by the URL path it is served at. */
const pages = new Map();

const walk = (relative) => {
    for (const entry of readdirSync(join(DIST, relative), { withFileTypes: true })) {
        const next = relative ? `${relative}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
            walk(next);
        } else if (entry.name === "index.html") {
            const html = readFileSync(join(DIST, next), "utf8");
            const path = `/${relative ? `${relative}/` : ""}`;

            pages.set(path, {
                html,
                // A redirect stub has no content of its own to link into, and
                // its target is checked as a page in its own right.
                redirect: /<meta http-equiv="refresh"/i.test(html),
                ids: new Set([...html.matchAll(/\s(?:id|name)="([^"]+)"/g)].map((m) => m[1])),
            });
        }
    }
};

walk("");

/** A link may also point at a file - a PDF, an image, a .tosc template. */
const isFile = (path) => {
    const target = join(DIST, decodeURIComponent(path));

    return existsSync(target) && statSync(target).isFile();
};

let checked = 0;
let broken = 0;

const report = (from, link, why) => {
    broken++;
    console.log(`FAIL  ${from}  ->  ${link}  (${why})`);
};

for (const [path, page] of pages) {
    if (page.redirect) continue;

    for (const match of page.html.matchAll(/\shref="([^"]+)"/g)) {
        const href = match[1];

        // Anything not rooted at the site: external, mailto, tel, data, or a
        // protocol-relative URL.
        if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")) continue;

        checked++;

        const hashAt = href.indexOf("#");
        const target = hashAt === -1 ? href : href.slice(0, hashAt);
        const fragment = hashAt === -1 ? "" : decodeURIComponent(href.slice(hashAt + 1));

        // "#fragment" alone: resolved against the page carrying it.
        if (target === "") {
            if (fragment && !page.ids.has(fragment)) report(path, href, "no such id on this page");
            continue;
        }

        /*
         * Relative links are resolved against the page carrying them rather
         * than rejected: they are legal and most of them work. The ones that
         * do not are the interesting cases - "../accessibility" from inside
         * the manual lands on the chapter itself, not the product page it
         * means, and nothing about the link looks wrong.
         */
        const resolved = new URL(target, `https://site${path}`).pathname;
        const normalised = resolved.endsWith("/") ? resolved : `${resolved}/`;
        const destination = pages.get(normalised);

        if (!destination) {
            if (!isFile(resolved)) report(path, href, "no such page or file");
            else if (fragment) report(path, href, "fragment on a file");
            continue;
        }

        // A fragment pointing through a redirect cannot be followed here: the
        // stub carries no ids, and the browser keeps the fragment across the
        // hop. The destination is verified separately as a page.
        if (fragment && !destination.redirect && !destination.ids.has(fragment)) {
            report(path, href, "page exists, no such id on it");
        }
    }
}

if (broken) {
    console.log(`\n${broken} of ${checked} internal link(s) resolve to nothing.`);
    process.exit(1);
}

console.log(`All ${checked} internal links across ${pages.size} pages resolve.`);
