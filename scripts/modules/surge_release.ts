import { execSync } from "child_process";

type Platform = "windows" | "mac" | "linux";
type ReleaseType = "nightly" | "stable";

export default function (platform?: Platform, type: ReleaseType = "nightly") {
    const repo = type === "stable" ? "surge-synthesizer/releases-xt" : "surge-synthesizer/surge";

    try {
        // Get the latest release tag
        const listJson = execSync(`gh release list -R ${repo} --limit 1 --json tagName`, {
            encoding: "utf-8",
        });
        const [{ tagName: latestTag }] = JSON.parse(listJson);

        if (!latestTag) throw new Error("No release tag found");

        // Fetch assets for that release
        const viewJson = execSync(`gh release view ${latestTag} -R ${repo} --json assets`, {
            encoding: "utf-8",
        });
        const { assets } = JSON.parse(viewJson);

        if (!assets?.length) throw new Error("No assets found for release");

        // Match asset by platform
        const match = assets.find((asset: any) => {
            const name = asset.name.toLowerCase();

            switch (platform) {
                case "windows":
                    return name.endsWith(".exe");
                case "mac":
                    return name.endsWith(".dmg");
                case "linux":
                    return name.endsWith(".deb");
                default:
                    return true; // if no platform filter specified
            }
        });

        if (!match) throw new Error(`No matching asset found for ${platform ?? "any"} platform`);

        return match.url;
    } catch (err) {
        console.error("❌ GitHub CLI failed:", err);
        return null;
    }
}
