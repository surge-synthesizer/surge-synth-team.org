/*
 * Release JSON carries whatever tag the product cuts, and they disagree: Surge
 * XT reports "1.3.4" where OB-Xf reports "v1.0.3". Printed after the word
 * Version, the second reads "Version v1.0.3".
 *
 * Stripped at the point of display rather than in the data, which belongs to
 * the repo that publishes it.
 */
export const version = (tag: string) => tag.replace(/^v(?=\d)/, "");
