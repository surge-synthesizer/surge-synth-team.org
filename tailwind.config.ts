import type { Config } from "tailwindcss";

export default {
    plugins: [require("@tailwindcss/typography")],
    content: ["./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}"],
    theme: {
        extend: {},
        fontFamily: {
            sans: ["Inter", "Noto Emoji"],
        },
    },
    corePlugins: {
        preflight: true,
    },
} satisfies Config;
