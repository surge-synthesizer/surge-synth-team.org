/*
 * Guards the two ways the shared nav has broken.
 *
 * 1. The nav renders on Starlight routes as well as Base.astro ones, but the
 *    two load entirely different stylesheets. Tailwind reaches Base.astro
 *    through base.css; a Starlight page that does not also get the utilities
 *    renders the nav as unstyled block elements.
 * 2. Dropdowns are wired by one delegated handler keyed on .nav-group-toggle.
 *    A menu without that toggle beside it keeps its `invisible` class forever,
 *    which is exactly how the Projects dropdown disappeared.
 *
 * Run against dist/ after a build: node scripts/check-nav.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

// Must match CHROME in src/fonts.ts.
const CHROME_FACE = "Blinker-400";
const DIST = "dist";

// Representative of the nav's layout, colour and spacing. If these resolve, the
// utilities reached the page; if they do not, the bar is a stack of raw blocks.
const REQUIRED_CLASSES = ["bg-black", "shrink-0", "items-center", "whitespace-nowrap"];

// src/layouts/nav.css, which both layouts import. Base.astro pages would mostly
// survive without it on Preflight alone; Starlight pages would not, and that
// asymmetry is exactly what made the nav render differently in manuals.
const REQUIRED_RULES = [
    { name: "nav list reset", find: ":where(#nav) :where(menu,ul)" },
    { name: "nav button reset", find: ":where(#nav) :where(button)" },
    // Matched loosely: the minifier is free to reorder declarations within a rule.
    { name: "nav typeface", find: "font-family:Lato" },
    { name: "Lato font-face", find: "@font-face{font-family:Lato" },
    { name: "nav surface", find: "#nav{" },
    { name: "nav surface default", find: "--surface-nav-bg:#000" },
];

const pages = execSync(`grep -rl 'id="nav"' ${DIST} --include=index.html`, { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean);

let failures = 0;

const cssFor = (html) =>
    [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)]
        .map((m) => DIST + m[1])
        .filter((path) => existsSync(path))
        .map((path) => readFileSync(path, "utf8"))
        .join("\n");

for (const page of pages) {
    const html = readFileSync(page, "utf8");
    const css = cssFor(html);
    const missing = REQUIRED_CLASSES.filter((cls) => !css.includes(`.${cls}`));

    if (missing.length > 0) {
        console.log(
            `FAIL  ${page}\n      nav utilities not in any linked stylesheet: ${missing.join(", ")}`,
        );
        failures++;
        continue;
    }

    // The chrome face is font-display: block, so until the file arrives the nav
    // paints nothing and then reflows. src/fonts.ts preloads it on every page;
    // this asserts that, since the face is named in two places.
    if (!new RegExp(`rel="preload"[^>]*${CHROME_FACE}`).test(html)) {
        console.log(`FAIL  ${page}\n      nav typeface is not preloaded; it will reflow on load`);
        failures++;
        continue;
    }

    const missingRules = REQUIRED_RULES.filter((rule) => !css.includes(rule.find));

    if (missingRules.length > 0) {
        console.log(
            `FAIL  ${page}\n      nav baseline missing: ${missingRules.map((r) => r.name).join(", ")}`,
        );
        failures++;
        continue;
    }

    /*
     * The theme control renders from NavHeader but its behaviour used to live
     * in Base.astro, which Starlight pages never run - so in a manual the
     * select showed the wrong value and changing it did nothing. Nothing about
     * the rendered markup gave that away, hence the check: the id plus at least
     * one scripted reference to it must both reach the page.
     */
    const themeControls = (html.match(/id="theme-control"/g) ?? []).length;
    const themeRefs = (html.match(/theme-control/g) ?? []).length;

    if (themeControls !== 1 || themeRefs < 2) {
        console.log(
            `FAIL  ${page}\n      theme control: ${themeControls} control(s), ${themeRefs - themeControls} script reference(s)`,
        );
        failures++;
        continue;
    }

    // Count menus and toggles; the handler pairs them as siblings.
    const menus = (html.match(/class="nav-group-menu/g) ?? []).length;
    const toggles = (html.match(/class="nav-group-toggle/g) ?? []).length;

    if (menus !== toggles) {
        console.log(`FAIL  ${page}\n      ${menus} dropdown menu(s) but ${toggles} toggle(s)`);
        failures++;
        continue;
    }

    console.log(`pass  ${page}  (${toggles} dropdown(s))`);
}

/*
 * The rail button carries popovertarget, which is what opens the pane on mobile
 * with no JavaScript. On desktop that same activation opens the popover into
 * the top layer - which outranks every z-index - and paints over the button
 * itself, so collapsing made the control vanish until a click elsewhere
 * dismissed it. The handler must cancel the activation on desktop.
 */
for (const page of pages.filter((p) => readFileSync(p, "utf8").includes("data-sidebar-toggle"))) {
    const html = readFileSync(page, "utf8");

    if (!/data-sidebar-toggle[\s\S]{0,400}preventDefault/.test(html)) {
        console.log(
            `FAIL  ${page}\n      rail button does not suppress its popover activation on desktop`,
        );
        failures++;
    }
}

const bundles = execSync(`ls ${DIST}/_astro/*.css`, { encoding: "utf8" }).trim().split("\n");

/*
 * nav.css is a set of defaults for the nav's utility classes to override, and
 * zero specificity is not enough to guarantee that: an UNLAYERED rule beats
 * every cascade layer no matter how specific, and base.css puts Tailwind's
 * utilities in @layer utilities. Imported unlayered, `padding: 0` there beat
 * `px-2` and squashed every nav button on product pages while manuals, which
 * import utilities unlayered, rendered correctly.
 */
const insideLayer = (css, index) => {
    let depth = 0;
    let layerDepth = null;

    for (let i = 0; i < index; i++) {
        if (css[i] === "{") {
            if (
                layerDepth === null &&
                /@layer\s+[\w.-]+[^{;]*$/.test(css.slice(Math.max(0, i - 60), i))
            ) {
                layerDepth = depth;
            }
            depth++;
        } else if (css[i] === "}") {
            depth--;
            if (layerDepth !== null && depth <= layerDepth) layerDepth = null;
        }
    }

    return layerDepth !== null;
};

for (const bundle of bundles) {
    const css = readFileSync(bundle, "utf8");
    const at = css.indexOf(":where(#nav) :where(button)");

    if (at >= 0 && !insideLayer(css, at)) {
        console.log(
            `FAIL  ${bundle}\n      nav reset is unlayered, so it overrides the utilities it should defer to`,
        );
        failures++;
    }
}

/*
 * Starlight reuses --sl-sidebar-width for the RIGHT-hand table of contents as
 * well as the left pane (TwoColumnContent.astro, PageSidebar.astro). Collapsing
 * the left pane by redefining it therefore shrinks "On this page" to one letter
 * per line - which it did. The collapse must narrow --sl-content-inline-start
 * and the pane's own width instead.
 */
for (const bundle of bundles) {
    const css = readFileSync(bundle, "utf8");

    for (const rule of css.matchAll(/html\[data-sidebar=["']?collapsed["']?\][^{]*\{([^}]*)\}/g)) {
        if (rule[1].includes("--sl-sidebar-width")) {
            console.log(
                `FAIL  ${bundle}\n      collapse redefines --sl-sidebar-width, which is also the TOC's width`,
            );
            failures++;
        }
    }
}

if (failures > 0) {
    console.error(`\n${failures} failure(s).`);
    process.exit(1);
}

console.log(`\nAll ${pages.length} pages carrying the nav have its styles and wired dropdowns.`);
