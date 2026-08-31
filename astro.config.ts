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
