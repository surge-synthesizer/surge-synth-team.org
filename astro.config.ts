import mdx from "@astrojs/mdx";
import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
    vite: { plugins: [tailwindcss()] },
    redirects: {
        "/ob-xf/manual/": "/ob-xf/manual/getting-started/",
    },
    integrations: [
        starlight({
            title: "OB-Xf Manual",
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
                        { label: "Patch Memory", slug: "ob-xf/manual/patch-memory" },
                        { label: "Master", slug: "ob-xf/manual/master" },
                        { label: "Global", slug: "ob-xf/manual/global" },
                        { label: "Control", slug: "ob-xf/manual/control" },
                        { label: "Oscilllators", slug: "ob-xf/manual/oscillators" },
                        { label: "Mixer", slug: "ob-xf/manual/mixer" },
                        { label: "Filter", slug: "ob-xf/manual/filter" },
                        { label: "LFO", slug: "ob-xf/manual/lfo" },
                        { label: "Envelopes", slug: "ob-xf/manual/envelopes" },
                        { label: "Voice Variation", slug: "ob-xf/manual/voice-variation" },
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
