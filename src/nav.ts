import { getCollection } from "astro:content";

/*
 * One nav for the whole site.
 *
 * Every product renders the same skeleton — the product link, a Documentation
 * group holding Manual and Changelog, then About and Source Code — and a slot
 * appears only where that product has something to put in it. Products add to
 * it through `nav` in their JSON rather than by hand-writing a list, so a
 * product page and every page of that product's manual cannot drift apart.
 */

export type NavItem = { label: string; href: string };
export type NavGroup = { label: string; items: NavItem[] };

export type Nav = {
    /** Flat items before the groups. */
    links: NavItem[];
    groups: NavGroup[];
    /** Flat items after the groups — the same two everywhere. */
    trailing: NavItem[];
};

const ORG_URL = "https://github.com/surge-synthesizer";
const ABOUT_HREF = "/about";

/** Skeleton groups, in render order. A product's own groups follow these. */
const GROUP_ORDER = ["Documentation", "Extras"];

const repoUrl = (repo?: string) => (repo ? `https://github.com/${repo}` : ORG_URL);

const hasPage = async (id: string) => (await getCollection("pages")).some((page) => page.id === id);

/**
 * `/about` and `/clap` are org-wide pages that do not exist in this repo yet —
 * About is a merge of the current Open Source and Contact pages with Surge's
 * History page, and CLAP still lives on the Surge site. Each slot appears the
 * moment its MDX lands in src/content/pages.
 *
 * Until About exists, the two pages it will replace stay linked from the org
 * homepage so they remain reachable, but they are org-level concerns and do not
 * belong in a product's nav — so a product simply has no About slot yet.
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
 * prepared and empty — a release whose notes are not written, or not wanted —
 * and an empty folder must not put a dead Changelog in the nav.
 */
async function changelogHref(slug: string) {
    const changelogs = await getCollection("changelogs");
    const hasNotes = changelogs.some((entry) => entry.data.product === slug);

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
            links: [],
            groups: [],
            trailing: [
                ...(await aboutLinks("org")),
                ...((await hasPage("clap")) ? [{ label: "CLAP", href: "/clap" }] : []),
                { label: "Source Code ↗", href: ORG_URL },
            ],
        };
    }

    const projects = await getCollection("projects");
    const project = projects.find((entry) => entry.id === currentProject);

    /*
     * A product can have a manual without a projects entry — SpectrumWorx is
     * deliberately unlisted until it is released. Its manual still deserves a
     * way back into its own documentation, so the Documentation group is built
     * from the docs collection alone.
     */
    if (!project) {
        const href = await manualHref(currentProject);

        return {
            links: [],
            groups: href ? [{ label: "Documentation", items: [{ label: "Manual", href }] }] : [],
            trailing: await aboutLinks("product"),
        };
    }

    const { nav, repo, manual } = project.data;
    const extraGroups = nav?.groups ?? {};

    const documentation: NavItem[] = [];
    const href = await manualHref(currentProject, manual);

    if (href) documentation.push({ label: "Manual", href });
    const changelog = await changelogHref(currentProject);

    if (changelog) documentation.push({ label: "Changelog", href: changelog });

    const skeleton: Record<string, NavItem[]> = { Documentation: documentation, Extras: [] };

    for (const [label, items] of Object.entries(extraGroups)) {
        skeleton[label] = [...(skeleton[label] ?? []), ...items];
    }

    const ordered = [
        ...GROUP_ORDER,
        ...Object.keys(skeleton).filter((label) => !GROUP_ORDER.includes(label)),
    ];

    return {
        links: nav?.links ?? [],
        groups: ordered
            .map((label) => ({ label, items: skeleton[label] ?? [] }))
            .filter((group) => group.items.length > 0),
        trailing: [
            ...(await aboutLinks("product")),
            // Deliberately not `url`: on surge-xt-rack that field holds a manual
            // link, not a repository.
            { label: "Source Code ↗", href: repoUrl(repo) },
        ],
    };
}
