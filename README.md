# surge-synth-team.org

### The website is built with [Astro](https://astro.build/) & [Tailwind CSS](https://tailwindcss.com/).

- [Astro Editor Setup](https://docs.astro.build/en/editor-setup/)

- [Tailwind Editor Setup](https://tailwindcss.com/docs/editor-setup)

### Instructions

-   Install [node.js](https://nodejs.org/en)
    -   (Optional) Install [pnpm](https://pnpm.io/)
-   Run `npm install` or `pnpm install` depending on your choice of package manager
-   Run `npm run dev` or `pnpm dev` to run the development server @ http://localhost:3000/
-   Run `npm run build` or `pnpm build` to build the site to the `dist` directory
-   Run `npm run preview` or `pnpm preview` to preview the built site

Static assets (images, fonts, etc.) live in the `public` directory.

You can use tailwind inline or edit the main file in the `src/css` directory.

### Adding and editing pages

To make changes, all you need to is fork the project. Once you have done that you can create a branch on your fork make changes and then open a PR. [This](https://github.com/surge-synthesizer/surge/blob/main/doc/How%20to%20Git.md) git document for the OSS Surge-Synthesizer project outlines a suggested way of doing work and then creating PRs.

Once you have created a branch in your fork you can then just click the edit button (upper right corner) to edit a post in the `src/content` folder. Because the posts are markdown documents you can just edit stuff in place in the GitHub editor.

To add a project, open the `src/content/project` folder in your fork and click the create new file button.

A post has a frontmatter section and a body section. The frontmatter section is metadata about the post, such as which image to use and what categories it belongs to. A new post would have frontmatter that looks something like:

```
---
slug: surge-xt
title: Surge XT
summary: Surge XT is an open source hybrid synthesizer, and the synth which started the Surge Synth Team project!
order: 1
thumbnail: /screenshots/surge-xt.png
categories: [Synth]
url: https://surge-synthesizer.github.io
issue_tracker: https://github.com/surge-synthesizer/surge/issues
---
```

the title is the display name for the post, the summary is the text in the card on the main page, the thumbnail is an image for the project, and the categories are a comma-separated list of any appropriate categories (look at the other projects for categories that already exist). The order determines which position a post appears in on the main page.

The body section of a post is where you can write a description of the project in markdown. It is everything after the frontmatter section.
