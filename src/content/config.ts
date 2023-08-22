import { z, defineCollection } from "astro:content";

const page = defineCollection({
    type: "content",
    schema: z.object({
        title: z.string(),
    }),
});

const posts = defineCollection({
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
    page: page,
    posts: posts,
};
