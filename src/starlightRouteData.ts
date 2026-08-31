import { defineRouteMiddleware, type StarlightRouteData } from "@astrojs/starlight/route-data";

type SidebarEntry = StarlightRouteData["sidebar"][number];

const holdsCurrentPage = (entry: SidebarEntry): boolean =>
    entry.type === "group" ? entry.entries.some(holdsCurrentPage) : entry.isCurrent;

// starlight has one global sidebar and one site title; each top-level group here is a
// separate manual, so narrow both down to whichever one this page belongs to
export const onRequest = defineRouteMiddleware((context) => {
    const route = context.locals.starlightRoute;
    const manual = route.sidebar.find(holdsCurrentPage);
    if (manual?.type !== "group") return;

    const previous = route.siteTitle;
    route.sidebar = manual.entries;
    route.siteTitle = manual.label;

    for (const tag of route.head) {
        if (tag.tag === "title" && tag.content?.endsWith(previous)) {
            tag.content = tag.content.slice(0, -previous.length) + manual.label;
        } else if (tag.attrs?.["property"] === "og:site_name") {
            tag.attrs["content"] = manual.label;
        }
    }
});
