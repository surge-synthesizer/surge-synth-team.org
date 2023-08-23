import type { Config } from "tailwindcss";

export default {
    plugins: [require("@tailwindcss/typography")],
    content: ["./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}"],
    theme: {
        extend: {
            colors: {
                accent1A: "#FFB949",
                accent1B: "#D09030",
                accent2A: "#278BD6",
                accent2B: "#004F8A",
                darkBackground: "#262A2F",
                cardBackground: "#1B1D20",
            },
        },
        fontFamily: {
            sans: ["Lato"],
        },
    },
    corePlugins: {
        preflight: true,
    },
} satisfies Config;
