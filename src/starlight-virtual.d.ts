/*
 * Starlight builds these modules at runtime through a Vite plugin and types
 * them only inside its own package, so a component vendored out of it (see
 * src/components/starlight/Search.astro) resolves the imports at build time but
 * not under `astro check`. Shapes mirror dist/integrations/vite-virtual-modules.js
 * in 0.42.0 — only the fields we actually read are declared.
 */

declare module "virtual:starlight/project-context" {
    const project: {
        build: { format: "file" | "directory" | "preserve" };
        root: string;
        srcDir: string;
        trailingSlash: "always" | "never" | "ignore";
    };
    export default project;
}

declare module "virtual:starlight/pagefind-config" {
    export const pagefindUserConfig: Record<string, unknown>;
}
