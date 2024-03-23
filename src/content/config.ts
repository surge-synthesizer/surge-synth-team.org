import { defineCollection, z } from "astro:content";

const pages = defineCollection({
    type: "content",
    schema: z.object({
        title: z.string(),
    }),
});

const projects = defineCollection({
    type: "content",
    schema: ({ image }) =>
        z.object({
            title: z.string(),
            order: z.number(),
            summary: z.string(),
            cover: image(),
            categories: z.string().array(),
            url: z.string(),
            issue_tracker: z.string(),
        }),
});

export const collections = {
    pages: pages,
    projects: projects,
};
