// Build the prototype: stamp the build number, compile TypeScript, then make standalone.html.
// Usage: node tools/build.mjs [--no-bump]     (or: npm run build [-- --no-bump])
//   --no-bump  keep the current build number and date
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const p = (...x) => join(root, ...x);
const bump = !process.argv.includes("--no-bump");

// 1. Build number, shown at the bottom of the map
const current = existsSync(p("BUILD_NUMBER")) ? Number(readFileSync(p("BUILD_NUMBER"), "utf8")) : 0;
const n = bump ? current + 1 : current;
if (bump) {
  writeFileSync(p("BUILD_NUMBER"), `${n}\n`);
  const date = new Date().toISOString().slice(0, 10);
  writeFileSync(p("src/version.ts"), `export const BUILD = "build ${n} · ${date}";\n`);
}

// 2. Compile (uses the local TypeScript if installed, else npx)
execSync("npx --yes tsc -p .", { cwd: root, stdio: "inherit" });

// 3. standalone.html
execSync(`node ${JSON.stringify(p("tools/standalone.mjs"))}`, { cwd: root, stdio: "inherit" });
console.log(`Built: build ${n}`);
