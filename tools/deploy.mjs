// Build, then deploy to Vercel production.
// Usage: npm run deploy [-- --no-bump]
//   --no-bump  keep the current build number (passed through to build.mjs)
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const flags = process.argv.includes("--no-bump") ? " --no-bump" : "";

execSync(`node ${JSON.stringify(join(root, "tools/build.mjs"))}${flags}`, { cwd: root, stdio: "inherit" });
execSync("npx --yes vercel --prod", { cwd: root, stdio: "inherit" });
