export type Platform = "mac" | "windows" | "bsd" | "ios" | "android" | "linux" | "unknown";

export default function (): Platform {
    let platforms = {
        mac: ["Macintosh", "MacIntel", "MacPPC", "Mac68K"],
        windows: ["Win32", "Win64", "Windows", "WinCE"],
        ios: ["iPhone", "iPad", "iPod"],
        bsd: ["FreeBSD", "FreeBSD amd64"],
    };

    let userAgent = window.navigator.userAgent;
    let platform = window.navigator.platform;

    if (platforms.mac.includes(platform)) return "mac";
    if (platforms.windows.includes(platform)) return "windows";
    if (platforms.bsd.includes(platform)) return "bsd";
    if (platforms.ios.includes(platform)) return "ios";
    if (/Android/.test(userAgent)) return "android";
    if (/Linux/.test(platform)) return "linux";

    return "unknown";
}
