/*
 * Which faces a page actually paints text with, so they can be preloaded.
 *
 * They are declared font-display: block, which shows nothing until the file
 * arrives - so an un-preloaded face is invisible text, not a reflow. Both
 * layouts read this: Base.astro directly, and the Starlight Head override,
 * since astro.config's `head` is static and cannot vary per product.
 */

const CHROME = ["/fonts/Blinker-400.woff2"];

/* Lato ships a real italic; the variable faces below are upright only, so a
   browser obliques them rather than loading a second file. */
const LATO = ["/fonts/Lato-Regular.woff", "/fonts/Lato-Italic.woff"];

/** Keep in step with the --font-product overrides in src/layouts/tokens.css. */
const PRODUCT_FACES: Record<string, string[]> = {
    "team": ["/fonts/Blinker-300.woff2"],
    "ob-xf": ["/fonts/Saira-Variable.woff2"],
    "shortcircuit-xt": ["/fonts/Inter-Variable.woff2"],
};

export const preloadFonts = (project?: string) => [
    ...new Set([...CHROME, ...(PRODUCT_FACES[project ?? ""] ?? LATO)]),
];

export const fontType = (href: string) => (href.endsWith(".woff2") ? "font/woff2" : "font/woff");
