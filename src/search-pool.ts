/*
 * Which Pagefind pool a documentation page belongs to.
 *
 * Normally a product: the OB-Xf manual should not answer a search made from
 * inside Shortcircuit XT's. A frozen manual is the exception - it covers a
 * version that shipped and moved on, so it gets a pool of its own rather than
 * diluting its product's with superseded text.
 *
 * Shared by the two components that have to agree on the value: PageTitle
 * writes it into the indexed body, Search filters on it. Deriving it twice from
 * the same id is how they silently drift apart.
 */
export const searchPool = (id: string) => {
    const product = id.split("/")[0]!;

    return id.includes("/manual/archive/") ? `${product}-archive` : product;
};
