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

// Each pair is a surface as it is actually declared in src/layouts/tokens.css.
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
    // The accent surface, which a manual also paints its active sidebar entry
    // with - so all three products are asserted, not just Surge's.
    { name: "accent (surge orange)", bg: "#ff9900", fg: "#171717" },
    {
        name: "accent (spectrumworx blue)",
        bg: "#109ac7",
        fg: "#171717",
        floor: AA_BODY_TEXT,
        why: "the SpectrumWorx product colour, by request; the lighter #58b6d4 it replaces reached 7.73:1",
    },
    {
        name: "spectrumworx link, dark base",
        bg: "#171717",
        fg: "#109ac7",
        floor: AA_BODY_TEXT,
        why: "--paper-link follows the product colour in dark, so it carries the same 5.52:1",
    },
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
    { name: "nav org pages", bg: "#ff9000", fg: "#171717" },

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
    {
        name: "surge link, light base",
        bg: "#efece7",
        fg: "#005db6",
        floor: AA_BODY_TEXT,
        why: "Surge's own blue for links on light paper, by request; the site default #00468c reaches 7.90:1 here, this brand value 5.50:1",
    },
    {
        name: "surge link, light raised",
        bg: "#e5e1da",
        fg: "#005db6",
        floor: AA_BODY_TEXT,
        why: "as above, over raised paper",
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

    // OB-Xf's secondaries, off the instrument: the red button and the wood cheek.
    // One of them wears the downloads band; both are declared.
    { name: "ob-xf ember band", bg: "#7f282a", fg: "#ffffff" },
    {
        name: "ob-xf walnut band",
        bg: "#795336",
        fg: "#ffffff",
        floor: AA_BODY_TEXT,
        why: "the wood cheek at its own value; 6.77:1, just under AAA",
    },
    { name: "ob-xf link, light base", bg: "#efece7", fg: "#43474e" },
    { name: "ob-xf link, light raised", bg: "#e5e1da", fg: "#43474e" },
    { name: "ob-xf link, dark base", bg: "#171717", fg: "#adb3bd" },
    { name: "ob-xf link, ink footer", bg: "#171717", fg: "#adb3bd" },

    ...manualPairs(),
];

/*
 * The manuals. starlight.css derives its grey ramp by mixing --paper and
 * --paper-ink, so there is no hex to copy down here - the mix is reproduced
 * instead, which cannot drift. The ramp depends only on the paper pair, which
 * no product overrides, so this is two sets rather than one per product.
 */
function manualPairs() {
    // Keep in step with the --sl-color-gray-* ramp in starlight.css.
    const RAMP = { 6: 8, 5: 16, 3: 72, 2: 85 };

    const pairs = [];

    for (const [theme, paper, ink] of [
        ["light", "#efece7", "#262626"],
        ["dark", "#171717", "#f5f5f5"],
    ]) {
        const gray = Object.fromEntries(
            Object.entries(RAMP).map(([step, pct]) => [step, mixOklab(ink, pct, paper)]),
        );

        // Starlight's own assignments: inline code sits on gray-5 in dark,
        // gray-6 in light.
        const code = theme === "dark" ? gray[5] : gray[6];

        pairs.push(
            { name: `manual body, ${theme}`, bg: paper, fg: gray[2] },
            { name: `manual headings, ${theme}`, bg: paper, fg: ink },
            {
                name: `manual secondary, ${theme}`,
                bg: paper,
                fg: gray[3],
                floor: AA_BODY_TEXT,
                why: "Starlight's gray-3 - contents heading, page dates, inactive tab labels; supporting chrome rather than prose",
            },
            {
                name: `manual secondary on sidebar, ${theme}`,
                bg: theme === "dark" ? "#262626" : "#e5e1da",
                fg: gray[3],
                floor: AA_BODY_TEXT,
                why: "as above, over the raised paper the sidebar uses",
            },
            { name: `manual inline code, ${theme}`, bg: code, fg: gray[2] },
        );
    }

    return pairs;
}

/* color-mix(in oklab, <a> <pct>%, <b>), resolved the way a browser would. */
function mixOklab(a, pct, b) {
    const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

    const toOklab = (hex) => {
        const n = parseInt(hex.slice(1), 16);
        const [r, g, bl] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => toLinear(v / 255));
        const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * bl);
        const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * bl);
        const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * bl);

        return [
            0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
        ];
    };

    const [A, B] = [toOklab(a), toOklab(b)];
    const t = pct / 100;
    const [L, ca, cb] = A.map((v, i) => v * t + B[i] * (1 - t));

    const l = (L + 0.3963377774 * ca + 0.2158037573 * cb) ** 3;
    const m = (L - 0.1055613458 * ca - 0.0638541728 * cb) ** 3;
    const s = (L - 0.0894841775 * ca - 1.291485548 * cb) ** 3;

    return (
        "#" +
        [
            4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
            -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
            -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
        ]
            .map((v) =>
                Math.round(Math.min(1, Math.max(0, toGamma(v))) * 255)
                    .toString(16)
                    .padStart(2, "0"),
            )
            .join("")
    );
}

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
