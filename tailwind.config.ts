import type { Config } from "tailwindcss";

export default {
    content: ["./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}"],
    theme: {
        fontFamily: {
            sans: ["Lato"],
        },
    },
} satisfies Config;
