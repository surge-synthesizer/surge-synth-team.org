import mdx from "@astrojs/mdx";
import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
    vite: { plugins: [tailwindcss()] },
    integrations: [
        starlight({
            title: "OB-Xf Manual",
            sidebar: [
                {
                    label: "OB-Xf Manual",
                    autogenerate: { directory: "ob-xf/manual" },
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
