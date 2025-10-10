import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const build_dir = path.join(import.meta.dirname, "..", "generated");

if (!fs.existsSync(build_dir)) {
    fs.mkdirSync(build_dir, { recursive: true });
}

const recent_five = {
    json: path.join(build_dir, "git_nightly_xt_recent_five.json"),
    mdx: path.join(build_dir, "git_nightly_xt_recent_five.mdx"),
};

try {
    const result = execSync("gh api repos/surge-synthesizer/surge/commits?per_page=5", {
        encoding: "utf8",
    });
    fs.writeFileSync(recent_five.json, result, "utf8");
} catch (err) {
    console.error("Error running gh api:", err);
}

const rawData = fs.readFileSync(recent_five.json, "utf8");
const commits = JSON.parse(rawData) as any[];
const lines = commits.map((c) => {
    const shortSha = c.sha.slice(0, 7);
    const message = c.commit.message.split("\n")[0];
    const author = c.commit.author.name;
    return `- ${shortSha} ${message} - ${author}`;
});
fs.writeFileSync(recent_five.mdx, lines.join("\n"), "utf8");
