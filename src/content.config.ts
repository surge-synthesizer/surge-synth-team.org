import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";
import { docsSchema } from "@astrojs/starlight/schema";

/*
 * Everything about one product lives in src/content/products/<slug>/: its
 * manual, its metadata, its images. Adding a product is one folder.
 *
 * docsLoader() is a thin wrapper over glob() with src/content/docs hardcoded,
 * so it is replaced rather than configured. The ids it produces are unchanged -
 * "ob-xf/manual/filter" either way - which is what keeps every manual URL and
 * every sidebar slug exactly where it was.
 *
 * Known cost: Starlight's lastUpdated (which walks the docs directory for git
 * dates) and its i18n (which infers language from the absolute path) both
 * assume src/content/docs. Neither is configured here, so both are inert.
 */
const docs = defineCollection({
    loader: glob({
        base: "./src/content/products",
        pattern: "*/{manual*,changelog,microtuning-guide}/**/[^_]*.{md,mdx}",
        /*
         * Keep the path as written. The default generator slugifies, which
         * turns a release note named 1.0.0.mdx into the id "100" and the URL
         * /changelog/100/. Version numbers are the one place dots matter.
         */
        generateId: ({ entry }) => entry.replace(/\.mdx?$/, "").replace(/\/index$/, ""),
    }),
    schema: docsSchema({
        extend: z.object({
            /** Release notes carry the version they describe and when it shipped. */
            version: z.string().optional(),
            // YAML parses an unquoted 2022-01-18 as a Date, not a string.
            date: z.coerce.date().optional(),
            /** Notes for a release that has not shipped. */
            nightly: z.boolean().default(false),
        }),
    }),
});

/*
 * Frozen manuals for versions that have shipped and moved on. Kept whole rather
 * than split into chapters: nothing is being written here, splitting serves no
 * reader, and one page means every anchor in it stays valid - which matters,
 * because Surge 1.9 shipped with an absolute help_url pointing at this manual.
 *
 * Deliberately kept outside the manual folders, so the docs glob below -
 * which matches any folder whose name starts with "manual" - does not claim it.
 */
const archives = defineCollection({
    loader: glob({ pattern: "*/archive/*.mdx", base: "./src/content/products" }),
    schema: () =>
        z.object({
            title: z.string(),
            version: z.string(),
        }),
});

const pages = defineCollection({
    loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/pages" }),
    schema: () =>
        z.object({
            title: z.string(),
            repo: z.string().optional(),
            url: z.string().optional(),
        }),
});

/*
 * Pages belonging to one product: its FAQ, downloads, skin library and so on.
 *
 * Separate from `pages` above, which is org-level and keyed by a bare slug.
 * These are keyed by "<product>/<page>", which is both the id and the URL, so
 * the folder a page sits in decides the product it belongs to - no slug field
 * to keep in sync, and moving a product's folder moves its pages with it.
 *
 * Deliberately not part of `docs`: these wear the product's look and its
 * blocks, not Starlight's manual chrome.
 */
/*
 * A product's landing page, composed of blocks rather than hand-written in
 * src/pages. Optional: a product without one falls back to the three blocks
 * [project].astro generates from meta.json.
 *
 * Prose stays prose here, which is the whole point - a band with a link or an
 * emphasis in it needs no escaping and no { html } string.
 */
const productLanding = defineCollection({
    loader: glob({
        base: "./src/content/products",
        pattern: "*/page.mdx",
        generateId: ({ entry }) => entry.split("/")[0]!,
    }),
    schema: () => z.object({ title: z.string() }),
});

const productPages = defineCollection({
    loader: glob({
        base: "./src/content/products",
        pattern: "*/pages/**/[^_]*.{md,mdx}",
        // "surge-xt/pages/faq" would put /pages/ in every URL for nothing.
        generateId: ({ entry }) => entry.replace("/pages/", "/").replace(/\.mdx?$/, ""),
    }),
    schema: () =>
        z.object({
            title: z.string(),
            /** A contents list beside the body, for pages long enough to need one. */
            toc: z.boolean().default(false),
        }),
});

/*
 * Community skins offered for download, one JSON file each, beside the images
 * they show. Adding a skin is a file and a screenshot - no page to edit.
 *
 * Data rather than MDX because none of these entries has a body: the old site
 * kept twelve .mdx files whose content was entirely frontmatter. The thumbnail
 * goes through image(), so 5.2 MB of PNGs reach the reader as optimised webp.
 */
const skins = defineCollection({
    loader: glob({
        base: "./src/content/products",
        pattern: "*/skins/*.json",
        generateId: ({ entry }) => entry.replace("/skins/", "/").replace(/\.json$/, ""),
    }),
    schema: ({ image }) =>
        z.object({
            name: z.string(),
            order: z.number(),
            author: z.string(),
            url: z.url().optional(),
            download: z.url(),
            thumbnail: image(),
            description: z.string().optional(),
        }),
});

// Rejects bare fragments and relative paths: nav is shared with manual routes,
// where "#faq" would resolve against the current chapter rather than the product.
const navItem = z.object({
    label: z.string(),
    href: z
        .string()
        .refine(
            (href) => href.startsWith("/") || /^https?:\/\//.test(href),
            "nav href must be a site-absolute path or a full URL",
        ),
});

const projects = defineCollection({
    // One meta.json per product folder. generateId strips the filename so ids
    // stay bare slugs ("ob-xf"), which is what every route and nav lookup uses.
    loader: glob({
        pattern: "*/meta.json",
        base: "./src/content/products",
        generateId: ({ entry }) => entry.split("/")[0]!,
    }),
    schema: ({ image }) =>
        z.object({
            title: z.string(),
            order: z.number(),
            summary: z.string(),
            cover: image(),
            categories: z.string().array(),
            issue_tracker: z.string(),
            repo: z.string().optional(),
            url: z.string().optional(),
            manual: z.string().optional(),
            // Additions to the nav skeleton every product shares. NavHeader
            // supplies the product link, Documentation (with Manual and Changelog
            // filled in where they exist), About and Source Code; this adds the
            // rest. A group named here that the skeleton does not have is created.
            //
            // Shared by the product page and every page of that product's manual,
            // so hrefs must be absolute: a bare "#faq" would resolve against the
            // manual chapter the reader happens to be on.
            nav: z
                .object({
                    links: z.array(navItem).optional(),
                    groups: z.record(z.string(), z.array(navItem)).optional(),
                })
                .optional(),
        }),
});

const generated = defineCollection({
    loader: glob({ pattern: "**/*.json", base: "./src/content/generated" }),
    schema: () =>
        z.object({
            build_time: z.string(),
            data: z.record(z.string(), z.any()),
            latest_commit: z.string(),
            name: z.string(),
            project_repo: z.string().url(),
            recent_commits: z
                .array(
                    z.object({
                        author: z.string(),
                        commit: z.string(),
                        date: z.string(),
                        message: z.string(),
                    }),
                )
                .optional(),
            releases: z.record(z.string(), z.string()),
            version: z.string(),
        }),
});

export const collections = {
    archives,
    docs,
    pages,
    productLanding,
    productPages,
    projects,
    generated,
    skins,
};
