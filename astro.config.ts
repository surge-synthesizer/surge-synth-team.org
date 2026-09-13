import mdx from "@astrojs/mdx";
import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
    vite: { plugins: [tailwindcss()] },
    redirects: {
        "/ob-xf/manual/": "/ob-xf/manual/getting-started/",
        "/spectrumworx/manual/": "/spectrumworx/manual/getting-started/",
        "/shortcircuit-xt/manual/": "/shortcircuit-xt/manual/getting-started/",
    },
    integrations: [
        starlight({
            title: "Surge Synth Team Manuals",
            routeMiddleware: "./src/starlightRouteData.ts",
            sidebar: [
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
                        { label: "To Update for 3.0", slug: "spectrumworx/manual/to-update-for-3-0" },
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
                                { label: "Miscellaneous", slug: "spectrumworx/manual/modules-misc" },
                            ],
                        },
                        { label: "Credits", slug: "spectrumworx/manual/credits" },
                    ],
                },
                {
                    label: "Shortcircuit XT Manual",
                    items: [
                        {
                            label: "Getting Started",
                            items: [
                                {
                                    label: "What is Shortcircuit XT?",
                                    slug: "shortcircuit-xt/manual/getting-started",
                                },
                                { label: "Installing", slug: "shortcircuit-xt/manual/installing" },
                            ],
                        },
                        {
                            label: "Instrument Structure",
                            items: [
                                {
                                    label: "Parts, Groups and Zones",
                                    slug: "shortcircuit-xt/manual/structure-parts-groups-zones",
                                },
                                {
                                    label: "Mixer and Mix Buses",
                                    slug: "shortcircuit-xt/manual/structure-mixer-buses",
                                },
                                {
                                    label: "Routing",
                                    slug: "shortcircuit-xt/manual/structure-routing",
                                },
                            ],
                        },
                        {
                            label: "Navigating the UI",
                            items: [
                                {
                                    label: "Zone, Group and Part Editor",
                                    slug: "shortcircuit-xt/manual/ui-editor",
                                },
                                {
                                    label: "Mixer Screen",
                                    slug: "shortcircuit-xt/manual/ui-mixer-screen",
                                },
                                { label: "Play Mode", slug: "shortcircuit-xt/manual/ui-play-mode" },
                                { label: "The Browser", slug: "shortcircuit-xt/manual/ui-browser" },
                            ],
                        },
                        {
                            label: "Inside a Zone",
                            items: [
                                {
                                    label: "The Sample, The Variants, and Empty Zones",
                                    slug: "shortcircuit-xt/manual/zone-sample",
                                },
                                { label: "The Range", slug: "shortcircuit-xt/manual/zone-range" },
                                {
                                    label: "Processors",
                                    slug: "shortcircuit-xt/manual/zone-processors",
                                },
                                {
                                    label: "Modulation",
                                    slug: "shortcircuit-xt/manual/zone-modulation",
                                },
                            ],
                        },
                        {
                            label: "Inside a Group",
                            items: [
                                {
                                    label: "Monophonic vs Polyphonic",
                                    slug: "shortcircuit-xt/manual/group-mono-poly",
                                },
                                {
                                    label: "Voice Management",
                                    slug: "shortcircuit-xt/manual/group-voice-management",
                                },
                            ],
                        },
                        {
                            label: "Using Parts for Multitimbral Playback",
                            items: [
                                {
                                    label: "Multitimbral Playback",
                                    slug: "shortcircuit-xt/manual/parts-multitimbral",
                                },
                                { label: "FX", slug: "shortcircuit-xt/manual/parts-fx" },
                            ],
                        },
                        { label: "Using the Mixer", slug: "shortcircuit-xt/manual/mixer" },
                        { label: "Importing Formats", slug: "shortcircuit-xt/manual/importing" },
                        {
                            label: "Other Features",
                            items: [
                                { label: "MPE", slug: "shortcircuit-xt/manual/mpe" },
                                {
                                    label: "Microtuning",
                                    slug: "shortcircuit-xt/manual/microtuning",
                                },
                            ],
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
