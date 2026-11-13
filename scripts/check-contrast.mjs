/*
 * Guards the surface palette's contrast ratios.
 *
 * The light theme deliberately sits below the old near-white paper: #efece7 on
 * #262626 reads as paper rather than glare. That makes it the pairing most
 * likely to drift further down during a future tweak, so the floor is asserted
 * here rather than left to judgement. WCAG AAA for body text is 7:1.
 *
 * Run: node scripts/check-contrast.mjs
 */

const AAA_BODY_TEXT = 7;

// Each pair is a surface as it is actually declared in src/layouts/base.css.
// Gradients are checked against both stops, since text sits over the whole band.
const PAIRS = [
    { name: "light base", bg: "#efece7", fg: "#262626" },
    { name: "light base link", bg: "#efece7", fg: "#00468c" },
    { name: "light raised", bg: "#e5e1da", fg: "#262626" },
    { name: "light raised link", bg: "#e5e1da", fg: "#00468c" },
    { name: "dark base", bg: "#171717", fg: "#f5f5f5" },
    { name: "dark base link (surge orange)", bg: "#171717", fg: "#ff9000" },
    { name: "dark raised", bg: "#262626", fg: "#f5f5f5" },
    { name: "ink", bg: "#171717", fg: "#e5e5e5" },
    { name: "ink link (surge orange)", bg: "#171717", fg: "#ff9000" },
    { name: "accent (surge orange)", bg: "#ff9000", fg: "#171717" },
    { name: "deep top stop", bg: "#1d222a", fg: "#e5e5e5" },
    { name: "deep bottom stop", bg: "#004a82", fg: "#e5e5e5" },
    { name: "ob-xf tide", bg: "#0055a7", fg: "#ffffff" },
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

for (const { name, bg, fg } of PAIRS) {
    const ratio = contrast(bg, fg);
    const ok = ratio >= AAA_BODY_TEXT;

    if (!ok) failed++;

    console.log(`${ok ? "pass" : "FAIL"}  ${ratio.toFixed(2)}:1  ${name}  (${fg} on ${bg})`);
}

if (failed > 0) {
    console.error(`\n${failed} surface pair(s) below the ${AAA_BODY_TEXT}:1 AAA floor.`);
    process.exit(1);
}

console.log(`\nAll ${PAIRS.length} surface pairs meet the ${AAA_BODY_TEXT}:1 AAA floor.`);
