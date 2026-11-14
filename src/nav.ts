import { getCollection } from "astro:content";

/*
 * One nav for the whole site.
 *
 * Every product renders the same skeleton - the product link, a Documentation
 * group holding Manual and Changelog, then About and GitHub - and a slot
 * appears only where that product has something to put in it. Products add to
 * it through `nav` in their JSON rather than by hand-writing a list, so a
 * product page and every page of that product's manual cannot drift apart.
 */

export type NavItem = { label: string; href: string };
export type NavGroup = { label: string; items: NavItem[] };

export type Nav = {
    /** The bar's middle section in render order: bare links and dropdowns mixed. */
    items: (NavItem | NavGroup)[];
    /** Flat items after that - the same two everywhere. */
    trailing: NavItem[];
};

export const isGroup = (entry: NavItem | NavGroup): entry is NavGroup => "items" in entry;

const ORG_URL = "https://github.com/surge-synthesizer";
const ABOUT_HREF = "/about";

/**
 * Render order for the bar's middle section. A product's own groups follow
 * these; LINKS is where its flat `nav.links` land, which is why a bare entry
 * like Surge's FAQ can sit between two dropdowns instead of ahead of both.
 */
const LINKS = "@links";
const GROUP_ORDER = ["Documentation", LINKS, "Extras"];

const repoUrl = (repo?: string) => (repo ? `https://github.com/${repo}` : ORG_URL);

const hasPage = async (id: string) => (await getCollection("pages")).some((page) => page.id === id);

/**
 * `/about` is an org-wide page that does not exist in this repo yet - a merge
 * of the current Open Source and Contact pages with Surge's History page. The
 * slot appears the moment its MDX lands in src/content/pages.
 *
 * Until About exists, the two pages it will replace stay linked from the org
 * homepage so they remain reachable, but they are org-level concerns and do not
 * belong in a product's nav - so a product simply has no About slot yet.
 */
async function aboutLinks(scope: "org" | "product"): Promise<NavItem[]> {
    if (await hasPage("about")) return [{ label: "About", href: ABOUT_HREF }];

    return scope === "org"
        ? [
              { label: "Open Source", href: "/open-source" },
              { label: "Contact", href: "/contact" },
          ]
        : [];
}

/**
 * Changelogs are detected the same way as manuals: from the content, not from a
 * field someone has to remember to set. A product may have a changelog/ folder
 * prepared and empty - a release whose notes are not written, or not wanted -
 * and an empty folder must not put a dead Changelog in the nav.
 *
 * Release notes are Starlight pages, so they live in the docs collection
 * alongside the manuals.
 */
async function changelogHref(slug: string) {
    const docs = await getCollection("docs");
    const hasNotes = docs.some((entry) => entry.id.startsWith(`${slug}/changelog/`));

    return hasNotes ? `/${slug}/changelog/` : undefined;
}

/**
 * Manuals are detected from the docs collection rather than from the `manual`
 * field, which is populated on only one product today and would silently go
 * stale. `/<slug>/manual/` resolves through the redirects in astro.config.ts,
 * so the entry chapter stays the sidebar's business.
 */
async function manualHref(slug: string, declared?: string) {
    const docs = await getCollection("docs");
    const hasManual = docs.some((entry) => entry.id.startsWith(`${slug}/manual/`));

    return hasManual ? `/${slug}/manual/` : declared;
}

export async function buildNav(currentProject?: string | null): Promise<Nav> {
    if (!currentProject) {
        return {
            items: [],
            trailing: [...(await aboutLinks("org")), { label: "GitHub ↗", href: ORG_URL }],
        };
    }

    const projects = await getCollection("projects");
    const project = projects.find((entry) => entry.id === currentProject);

    /*
     * A product can have a manual without a projects entry - SpectrumWorx is
     * deliberately unlisted until it is released. Its manual still deserves a
     * way back into its own documentation, so the Documentation group is built
     * from the docs collection alone.
     */
    if (!project) {
        const href = await manualHref(currentProject);

        return {
            items: href ? [{ label: "Documentation", items: [{ label: "Manual", href }] }] : [],
            trailing: await aboutLinks("product"),
        };
    }

    const { nav, repo, manual } = project.data;
    const extraGroups = nav?.groups ?? {};

    const documentation: NavItem[] = [];
    const href = await manualHref(currentProject, manual);

    const changelog = await changelogHref(currentProject);

    // What changed, then how it works: the changelog is the entry people come
    // back for, where the manual is the one they already know is there.
    if (changelog) documentation.push({ label: "Changelog", href: changelog });
    if (href) documentation.push({ label: "Manual", href });

    const skeleton: Record<string, NavItem[]> = { Documentation: documentation, Extras: [] };

    for (const [label, items] of Object.entries(extraGroups)) {
        skeleton[label] = [...(skeleton[label] ?? []), ...items];
    }

    const ordered = [
        ...GROUP_ORDER,
        ...Object.keys(skeleton).filter((label) => !GROUP_ORDER.includes(label)),
    ];

    return {
        items: ordered.flatMap((label): (NavItem | NavGroup)[] =>
            label === LINKS
                ? (nav?.links ?? [])
                : skeleton[label]?.length
                  ? [{ label, items: skeleton[label] }]
                  : [],
        ),
        trailing: [
            ...(await aboutLinks("product")),
            // Deliberately not `url`: on surge-xt-rack that field holds a manual
            // link, not a repository.
            { label: "GitHub ↗", href: repoUrl(repo) },
        ],
    };
}
