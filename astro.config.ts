import mdx from "@astrojs/mdx";
import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { nightlyIn, pagesIn } from "./src/sidebar";

/*
 * A stable URL for the draft notes of whatever is next, which otherwise live at
 * the version number they will ship under and move every release. Pages that
 * link to the draft changelog - and, after cutover, the redirect shell - point
 * here instead of chasing the number.
 */
const nightlyChangelog = (product: string) => {
    const [page] = nightlyIn(`${product}/changelog`);

    return page ? { [`/${product}/changelog/nightly`]: `/${page.slug}/` } : {};
};

/*
 * The newest shipped release. /<product>/changelog/ opens straight on it,
 * there being no landing page in front of the list any more.
 */
const latestChangelog = (product: string) => {
    const [page] = pagesIn(`${product}/changelog`);

    return page ? { [`/${product}/changelog/`]: `/${page.slug}/` } : {};
};

// https://astro.build/config
export default defineConfig({
    vite: { plugins: [tailwindcss()] },
    redirects: {
        ...latestChangelog("surge-xt"),
        ...latestChangelog("ob-xf"),
        ...nightlyChangelog("surge-xt"),
        ...nightlyChangelog("ob-xf"),
        // The changelog moved under its product when content went product-first.
        "/ob-xf/manual/": "/ob-xf/manual/getting-started/",
        "/surge-xt/manual/": "/surge-xt/manual/getting-started/",
        "/surge-xt/manual-nightly/": "/surge-xt/manual-nightly/getting-started/",
        "/surge-xt/manual-rack/": "/surge-xt/manual-rack/getting-started/",
        "/surge-xt/microtuning-guide/": "/surge-xt/microtuning-guide/introduction/",
        // The 1.9 manual was one page at this URL until it was split. Keep it
        // resolving: both manuals link here, and so does anything outside.
        "/surge-xt/manual/archive/1.9/": "/surge-xt/manual/archive/1.9/getting-started/",
        "/ob-xf-changelog": "/ob-xf/changelog/",
        "/spectrumworx/manual/": "/spectrumworx/manual/getting-started/",
        "/shortcircuit-xt/manual/": "/shortcircuit-xt/manual/getting-started/",
    },
    integrations: [
        starlight({
            title: "Surge Synth Team Manuals",
            // Starlight defaults to /favicon.svg; this site ships an .ico.
            favicon: "/favicon.ico",
            routeMiddleware: "./src/starlightRouteData.ts",
            customCss: ["./src/layouts/starlight.css"],
            // Starlight shows H2-H3 by default. The manual's chapters were
            // sections of one page, so their structure runs a level deeper than
            // that: H2-H4 here is what H1-H3 was on the old single-page TOC.
            tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 4 },
            // Fonts are preloaded per product by the Head override, which can see
            // the route; this static list cannot.
            components: {
                Head: "./src/components/starlight/Head.astro",
                ThemeProvider: "./src/components/starlight/ThemeProvider.astro",
                ThemeSelect: "./src/components/starlight/ThemeSelect.astro",
                PageFrame: "./src/components/starlight/PageFrame.astro",
                Header: "./src/components/starlight/Header.astro",
                PageTitle: "./src/components/starlight/PageTitle.astro",
                Search: "./src/components/starlight/Search.astro",
            },
            sidebar: [
                {
                    label: "Surge XT Changelogs",
                    items: [
                        ...pagesIn("surge-xt/changelog"),
                        ...nightlyIn("surge-xt/changelog"),
                        {
                            label: "Older releases",
                            collapsed: true,
                            items: pagesIn("surge-xt/changelog/archive"),
                        },
                    ],
                },
                {
                    label: "OB-Xf Changelogs",
                    items: [...pagesIn("ob-xf/changelog"), ...nightlyIn("ob-xf/changelog")],
                },
                {
                    label: "Surge XT Manual",
                    items: [
                        { label: "Getting Started", slug: "surge-xt/manual/getting-started" },
                        {
                            label: "Installing or Building Surge XT",
                            slug: "surge-xt/manual/installing-or-building",
                        },
                        {
                            label: "User Interface Basics",
                            slug: "surge-xt/manual/user-interface-basics",
                        },
                        { label: "Header", slug: "surge-xt/manual/header" },
                        { label: "Scene Controls", slug: "surge-xt/manual/scene-controls" },
                        { label: "Modulation/Routing", slug: "surge-xt/manual/modulation-routing" },
                        { label: "Effects", slug: "surge-xt/manual/effects" },
                        { label: "Microtuning", slug: "surge-xt/manual/microtuning" },
                        { label: "Main Menu", slug: "surge-xt/manual/main-menu" },
                        { label: "Oscilloscope", slug: "surge-xt/manual/oscilloscope" },
                        { label: "Accessibility", slug: "surge-xt/manual/accessibility" },
                        {
                            label: "Technical Reference",
                            slug: "surge-xt/manual/technical-reference",
                        },
                    ],
                },
                {
                    label: "Surge XT VCV Modules Manual",
                    items: [
                        { label: "Getting Started", slug: "surge-xt/manual-rack/getting-started" },
                        { label: "Core Concepts", slug: "surge-xt/manual-rack/core-concepts" },
                        { label: "VCO Modules", slug: "surge-xt/manual-rack/vco" },
                        {
                            label: "VCF, Waveshaper and CXOR",
                            slug: "surge-xt/manual-rack/vcf-waveshaper",
                        },
                        { label: "Effect Modules", slug: "surge-xt/manual-rack/effects" },
                        { label: "Tuned Delays", slug: "surge-xt/manual-rack/tuned-delays" },
                        {
                            label: "Modulation and Envelopes",
                            slug: "surge-xt/manual-rack/modulation",
                        },
                        { label: "Mixer and Manipulators", slug: "surge-xt/manual-rack/mixer" },
                    ],
                },
                {
                    label: "Surge XT Microtuning Guide",
                    items: [
                        { label: "Introduction", slug: "surge-xt/microtuning-guide/introduction" },
                        { label: "Methods", slug: "surge-xt/microtuning-guide/methods" },
                        {
                            label: "Factory Tuning Library",
                            slug: "surge-xt/microtuning-guide/factory-library",
                        },
                        { label: "Tuning Editor", slug: "surge-xt/microtuning-guide/editor" },
                        {
                            label: "Microtonal Step Sequencing",
                            slug: "surge-xt/microtuning-guide/step-sequencing",
                        },
                        {
                            label: "Tuning Note CLAPs",
                            slug: "surge-xt/microtuning-guide/note-claps",
                        },
                        { label: "Questions?", slug: "surge-xt/microtuning-guide/questions" },
                    ],
                },
                {
                    /*
                     * Frozen content for a version that shipped and moved on.
                     * Collapsed for the same reason the nightly manual is: it
                     * should be reachable without crowding the current manual.
                     *
                     * Each page is named after the anchor it used to be, so the
                     * 5c shim can map 1.9's in-app help onto it - see
                     * scripts/anchor-map.mjs, which generates that table and
                     * fails if any of the 152 anchors stops resolving.
                     */
                    label: "Surge 1.9 Manual (archived)",
                    collapsed: true,
                    items: [
                        {
                            label: "Getting Started",
                            slug: "surge-xt/manual/archive/1.9/getting-started",
                        },
                        {
                            label: "Introduction to the User Interface",
                            slug: "surge-xt/manual/archive/1.9/introduction-to-the-user-interface",
                        },
                        {
                            label: "Patch/Global Section",
                            slug: "surge-xt/manual/archive/1.9/patchglobal-section",
                        },
                        {
                            label: "Scene Controls Section",
                            slug: "surge-xt/manual/archive/1.9/scene-controls-section",
                        },
                        {
                            label: "Modulation/Routing Section",
                            slug: "surge-xt/manual/archive/1.9/modulationrouting-section",
                        },
                        {
                            label: "FX Section",
                            slug: "surge-xt/manual/archive/1.9/fx-section",
                        },
                        {
                            label: "Menu Button",
                            slug: "surge-xt/manual/archive/1.9/menu-button",
                        },
                        {
                            label: "Technical Reference",
                            slug: "surge-xt/manual/archive/1.9/technical-reference",
                        },
                    ],
                },
                {
                    // Unreleased: linked for review in place, kept out of search
                    // engines by the Head override.
                    label: "Surge XT Manual (nightly)",
                    collapsed: true,
                    items: [
                        {
                            label: "Getting Started",
                            slug: "surge-xt/manual-nightly/getting-started",
                        },
                        {
                            label: "Installing or Building Surge XT",
                            slug: "surge-xt/manual-nightly/installing-or-building",
                        },
                        {
                            label: "User Interface Basics",
                            slug: "surge-xt/manual-nightly/user-interface-basics",
                        },
                        { label: "Header", slug: "surge-xt/manual-nightly/header" },
                        { label: "Scene Controls", slug: "surge-xt/manual-nightly/scene-controls" },
                        {
                            label: "Modulation/Routing",
                            slug: "surge-xt/manual-nightly/modulation-routing",
                        },
                        { label: "Effects", slug: "surge-xt/manual-nightly/effects" },
                        { label: "Microtuning", slug: "surge-xt/manual-nightly/microtuning" },
                        { label: "Main Menu", slug: "surge-xt/manual-nightly/main-menu" },
                        { label: "Oscilloscope", slug: "surge-xt/manual-nightly/oscilloscope" },
                        { label: "Accessibility", slug: "surge-xt/manual-nightly/accessibility" },
                        {
                            label: "Technical Reference",
                            slug: "surge-xt/manual-nightly/technical-reference",
                        },
                    ],
                },
                {
                    label: "OB-Xf Manual",
                    items: [
                        { label: "Getting Started", slug: "ob-xf/manual/getting-started" },
                        {
                            label: "Installing or Building OB-Xf",
                            slug: "ob-xf/manual/installing-or-building",
                        },
                        {
                            label: "User Interface Basics",
                            slug: "ob-xf/manual/user-interface-basics",
                        },
                        { label: "Patch Memory", slug: "ob-xf/manual/programmer" },
                        { label: "Master", slug: "ob-xf/manual/master" },
                        { label: "Global", slug: "ob-xf/manual/global" },
                        { label: "Control", slug: "ob-xf/manual/control" },
                        { label: "Oscillators", slug: "ob-xf/manual/oscillators" },
                        { label: "Mixer", slug: "ob-xf/manual/mixer" },
                        { label: "Filter", slug: "ob-xf/manual/filter" },
                        { label: "LFO", slug: "ob-xf/manual/lfo" },
                        { label: "Envelopes", slug: "ob-xf/manual/envelopes" },
                        { label: "Voice Variation", slug: "ob-xf/manual/voice-variation" },
                        { label: "Theme Authoring", slug: "ob-xf/manual/theme-authoring" },
                    ],
                },
                {
                    label: "SpectrumWorx Manual",
                    items: [
                        { label: "Getting Started", slug: "spectrumworx/manual/getting-started" },
                        {
                            label: "To Update for 3.0",
                            slug: "spectrumworx/manual/to-update-for-3-0",
                        },
                        {
                            label: "Installing SpectrumWorx",
                            slug: "spectrumworx/manual/installing",
                        },
                        { label: "The Interface", slug: "spectrumworx/manual/the-interface" },
                        { label: "The Main Window", slug: "spectrumworx/manual/main-window" },
                        { label: "LFOs", slug: "spectrumworx/manual/lfo" },
                        { label: "The Module Bank", slug: "spectrumworx/manual/module-bank" },
                        { label: "Settings: Engine", slug: "spectrumworx/manual/settings-engine" },
                        {
                            label: "Settings: GUI and About",
                            slug: "spectrumworx/manual/settings-gui",
                        },
                        { label: "Presets", slug: "spectrumworx/manual/presets" },
                        {
                            label: "The Modules",
                            collapsed: true,
                            items: [
                                { label: "Overview", slug: "spectrumworx/manual/modules" },
                                { label: "Pitch", slug: "spectrumworx/manual/modules-pitch" },
                                { label: "Timbre", slug: "spectrumworx/manual/modules-timbre" },
                                { label: "Time", slug: "spectrumworx/manual/modules-time" },
                                { label: "Space", slug: "spectrumworx/manual/modules-space" },
                                { label: "Phase", slug: "spectrumworx/manual/modules-phase" },
                                { label: "Loudness", slug: "spectrumworx/manual/modules-loudness" },
                                { label: "Combine", slug: "spectrumworx/manual/modules-combine" },
                                {
                                    label: "Phase Vocoder",
                                    slug: "spectrumworx/manual/modules-phase-vocoder",
                                },
                                {
                                    label: "Miscellaneous",
                                    slug: "spectrumworx/manual/modules-misc",
                                },
                            ],
                        },
                        { label: "Credits", slug: "spectrumworx/manual/credits" },
                    ],
                },
                {
                    label: "Shortcircuit XT Manual",
                    items: [
                        {
                            label: "What is Shortcircuit XT?",
                            slug: "shortcircuit-xt/manual/getting-started",
                        },
                        {
                            label: "Installing Shortcircuit XT",
                            slug: "shortcircuit-xt/manual/installing",
                        },
                        {
                            label: "Parts, Groups and Zones",
                            slug: "shortcircuit-xt/manual/structure-parts-groups-zones",
                        },
                        {
                            label: "Mixer and Mix Buses",
                            slug: "shortcircuit-xt/manual/structure-mixer-buses",
                        },
                        { label: "Routing", slug: "shortcircuit-xt/manual/structure-routing" },
                        {
                            label: "Zone, Group and Part Editor",
                            slug: "shortcircuit-xt/manual/ui-editor",
                        },
                        { label: "Mixer Screen", slug: "shortcircuit-xt/manual/ui-mixer-screen" },
                        { label: "Play Mode", slug: "shortcircuit-xt/manual/ui-play-mode" },
                        { label: "The Browser", slug: "shortcircuit-xt/manual/ui-browser" },
                        {
                            label: "The Sample, The Variants, and Empty Zones",
                            slug: "shortcircuit-xt/manual/zone-sample",
                        },
                        { label: "The Range", slug: "shortcircuit-xt/manual/zone-range" },
                        { label: "Processors", slug: "shortcircuit-xt/manual/zone-processors" },
                        { label: "Modulation", slug: "shortcircuit-xt/manual/zone-modulation" },
                        {
                            label: "Monophonic vs Polyphonic",
                            slug: "shortcircuit-xt/manual/group-mono-poly",
                        },
                        {
                            label: "Voice Management",
                            slug: "shortcircuit-xt/manual/group-voice-management",
                        },
                        {
                            label: "Trigger Conditions",
                            slug: "shortcircuit-xt/manual/group-triggers",
                        },
                        {
                            label: "Multitimbral Playback",
                            slug: "shortcircuit-xt/manual/parts-multitimbral",
                        },
                        { label: "Part FX", slug: "shortcircuit-xt/manual/parts-fx" },
                        { label: "Using the Mixer", slug: "shortcircuit-xt/manual/mixer" },
                        { label: "Importing Formats", slug: "shortcircuit-xt/manual/importing" },
                        { label: "MPE", slug: "shortcircuit-xt/manual/mpe" },
                        { label: "Microtuning", slug: "shortcircuit-xt/manual/microtuning" },
                        {
                            label: "Keyboard Shortcuts",
                            slug: "shortcircuit-xt/manual/keyboard-shortcuts",
                        },
                        {
                            label: "License, Source and Credits",
                            slug: "shortcircuit-xt/manual/credits",
                        },
                    ],
                },
            ],
        }),
        mdx(),
    ],
    markdown: {
        shikiConfig: {
            themes: {
                light: "dark-plus",
                dark: "light-plus",
            },
            wrap: true,
        },
    },
});
