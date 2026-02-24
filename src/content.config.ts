import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

const pages = defineCollection({
    loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/pages" }),
    schema: () =>
        z.object({
            title: z.string(),
            repo: z.string().optional(),
            url: z.string().optional(),
        }),
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
        }),
});

const generated = defineCollection({
    loader: glob({ pattern: "**/*.json", base: "./src/content/generated" }),
    schema: () =>
        z.object({
            build_time: z.string(),
            data: z.record(z.any()),
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
            releases: z.record(z.string()),
            version: z.string(),
        }),
});

export const collections = {
    pages,
    projects,
    generated,
};
