import { z, defineCollection } from "astro:content";

const pages = defineCollection({
    type: "content",
    schema: z.object({
        title: z.string(),
    }),
});

const projects = defineCollection({
    type: "content",
    schema: z.object({
        title: z.string(),
        summary: z.string(),
        order: z.number(),
        thumbnail: z.string(),
        categories: z.array(z.string()),
        url: z.string(),
        issue_tracker: z.string(),
    }),
});

export const collections = {
    pages: pages,
    projects: projects,
};
