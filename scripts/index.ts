import { mkdirSync, writeFileSync } from "fs";
import surge_release from "./modules/surge_release.ts";

const stable = {
    windows: surge_release("windows", "stable"),
    mac: surge_release("mac", "stable"),
    linux: surge_release("linux", "stable"),
};

const nightly = {
    windows: surge_release("windows", "nightly"),
    mac: surge_release("mac", "nightly"),
    linux: surge_release("linux", "nightly"),
};

const output = {
    surge_xt: {
        stable,
        nightly,
    },
};

mkdirSync("src/content/generated", { recursive: true });
writeFileSync("src/content/generated/releases.json", JSON.stringify(output, null, 4));
