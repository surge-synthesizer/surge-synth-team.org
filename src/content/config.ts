import { z, defineCollection } from "astro:content";

const pages = defineCollection({
    type: "content",
    schema: z.object({
        title: z.string(),
        order: z.number(),
        summary: z.string().optional(),
        thumbnail: z.string().optional(),
        categories: z.array(z.string()).optional(),
        url: z.string().optional(),
        issue_tracker: z.string().optional(),
    }),
});

export const collections = {
    pages: pages,
};
