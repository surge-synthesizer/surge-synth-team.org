import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";
import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";

const docs = defineCollection({
    loader: docsLoader(),
    schema: docsSchema(),
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
    loader: glob({ pattern: "**/*.json", base: "./src/content/projects" }),
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
            changelog: z.string().optional(),
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
    docs,
    pages,
    projects,
    generated,
};
