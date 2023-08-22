import { z, defineCollection } from "astro:content";

const page = defineCollection({
    type: "content",
    schema: z.object({
        title: z.string(),
    }),
});

const post = defineCollection({
    type: "content",
    schema: z.object({
        order: z.number(),
        title: z.string(),
        summary: z.string(),
        "featured-image": z.string(),
        categories: z.array(z.string()),
        "issue-tracker": z.string(),
        published: z.boolean(),
        external_url: z.string(),
    }),
});

export const collections = {
    page: page,
    post: post,
};
