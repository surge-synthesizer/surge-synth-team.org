/*
 * Guards the surface palette's contrast ratios.
 *
 * The light theme deliberately sits below the old near-white paper: #efece7 on
 * #262626 reads as paper rather than glare. That makes it the pairing most
 * likely to drift further down during a future tweak, so the floor is asserted
 * here rather than left to judgement.
 *
 * Surfaces target WCAG AAA for body text (7:1). A surface may drop to the AA
 * floor (4.5:1) only with a `why` recorded against it, so the exception stays
 * visible in review instead of being absorbed into the palette.
 *
 * Run: node scripts/check-contrast.mjs
 */

const AAA_BODY_TEXT = 7;
const AA_BODY_TEXT = 4.5;

// Each pair is a surface as it is actually declared in src/layouts/base.css.
// Gradients are checked against both stops, since text sits over the whole band.
const PAIRS = [
    { name: "light base", bg: "#efece7", fg: "#262626" },
    { name: "light base link", bg: "#efece7", fg: "#00468c" },
    { name: "light raised", bg: "#e5e1da", fg: "#262626" },
    { name: "light raised link", bg: "#e5e1da", fg: "#00468c" },
    { name: "dark base", bg: "#171717", fg: "#f5f5f5" },
    { name: "dark base link (surge orange)", bg: "#171717", fg: "#ff9900" },
    { name: "dark raised", bg: "#262626", fg: "#f5f5f5" },
    { name: "ink", bg: "#171717", fg: "#e5e5e5" },
    { name: "ink link (surge orange)", bg: "#171717", fg: "#ff9900" },
    { name: "accent (surge orange)", bg: "#ff9900", fg: "#171717" },
    { name: "deep top stop", bg: "#1d222a", fg: "#e5e5e5" },
    {
        name: "deep bottom stop",
        bg: "#004f8a",
        fg: "#e5e5e5",
        floor: AA_BODY_TEXT,
        why: "the old site's stop, kept exact with the rest of Surge's blues",
    },

    // The nav bar, which the footer now renders too, so both ends of a page are
    // one decision. Declared in src/layouts/nav.css, not base.css: Starlight
    // pages never load base.css and would otherwise lose the nav's colours.
    { name: "nav default", bg: "#000000", fg: "#ffffff" },
    { name: "nav dark theme", bg: "#171717", fg: "#ffffff" },
    { name: "nav surge family", bg: "#ff9900", fg: "#171717" },

    // Surge's two extra bands, declared on html[data-project="surge-xt"].
    {
        name: "surge ocean band",
        bg: "#005db6",
        fg: "#e5e5e5",
        floor: AA_BODY_TEXT,
        why: "the old site's backgroundBlue, kept exact by request; AAA needs it a fifth darker, which stops reading as the brand blue",
    },
    {
        name: "surge ocean link",
        bg: "#005db6",
        fg: "#ffffff",
        floor: AA_BODY_TEXT,
        why: "links on the ocean band, white as on the old site - 6.48:1",
    },
    { name: "surge night band", bg: "#103364", fg: "#e5e5e5" },
    { name: "surge hero top, light", bg: "#f5f2ed", fg: "#262626" },
    { name: "surge hero bottom, light", bg: "#e2ded6", fg: "#262626" },
    { name: "surge hero top, dark", bg: "#171717", fg: "#f5f5f5" },
    { name: "surge hero bottom, dark", bg: "#0a0a0a", fg: "#f5f5f5" },
    { name: "surge videos gradient, orange stop", bg: "#ff9900", fg: "#171717" },
    {
        // Not a declared colour: the oklab midpoint of the two stops, which is
        // where the ramp is least legible and so the value worth asserting.
        name: "surge videos gradient, mid band",
        bg: "#7c7f92",
        fg: "#171717",
        floor: AA_BODY_TEXT,
        why: "a gradient between a light and a dark stop suits no single foreground; dark reaches 4.5:1 here against light's 3.1:1, and the blue corner where dark would fail carries the video, not copy",
    },

    // OB-Xf. The brand grey #727882 appears in none of these pairs on purpose:
    // it reaches only 4.72:1 against black and 4.44:1 against white, so it is
    // the scrollbar colour and nothing that sits behind text.
    {
        name: "ob-xf slate band",
        bg: "#6b717a",
        fg: "#ffffff",
        floor: AA_BODY_TEXT,
        why: "holds the OB-Xf GUI grey; AAA needs it 30% darker, which stops looking like the product",
    },
    {
        name: "ob-xf download button",
        bg: "#6b717a",
        fg: "#ffffff",
        floor: AA_BODY_TEXT,
        why: "matches the slate band it sits above",
    },
    // The nav surface, from src/layouts/nav.css. A product that declares none
    // gets the first two.
    { name: "nav default, light theme", bg: "#000000", fg: "#ffffff" },
    { name: "nav default, dark theme", bg: "#171717", fg: "#ffffff" },
    {
        name: "ob-xf nav",
        bg: "#6b717a",
        fg: "#ffffff",
        floor: AA_BODY_TEXT,
        why: "same slate as the downloads band; AAA needs it 30% darker, which stops looking like the product",
    },

    { name: "ob-xf link, light base", bg: "#efece7", fg: "#43474e" },
    { name: "ob-xf link, light raised", bg: "#e5e1da", fg: "#43474e" },
    { name: "ob-xf link, dark base", bg: "#171717", fg: "#adb3bd" },
    { name: "ob-xf link, ink footer", bg: "#171717", fg: "#adb3bd" },
];

const channel = (eightBit) => {
    const c = eightBit / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(channel);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
};

let failed = 0;
const exceptions = [];

for (const { name, bg, fg, floor = AAA_BODY_TEXT, why } of PAIRS) {
    const ratio = contrast(bg, fg);
    const ok = ratio >= floor;

    if (!ok) failed++;
    if (why) exceptions.push({ name, ratio, floor, why });

    const level = floor === AAA_BODY_TEXT ? "AAA" : "AA ";

    console.log(
        `${ok ? "pass" : "FAIL"}  ${level}  ${ratio.toFixed(2)}:1  ${name}  (${fg} on ${bg})`,
    );
}

if (exceptions.length > 0) {
    console.log(`\nHeld to the ${AA_BODY_TEXT}:1 AA floor rather than AAA:`);

    for (const { name, ratio, why } of exceptions) {
        console.log(`  ${name} - ${ratio.toFixed(2)}:1 - ${why}`);
    }
}

if (failed > 0) {
    console.error(`\n${failed} surface pair(s) below their floor.`);
    process.exit(1);
}

console.log(`\nAll ${PAIRS.length} surface pairs meet their floor.`);
