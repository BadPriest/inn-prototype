// The controller crawl at three UI sizes: on every card screen, D-pad down from the first card should land
// lower each step until it stops, every card below should be reachable, up should come back, and there should be
// at most three buttons, each with its controller glyph.
//   node tools/check/crawl.mjs
// Prints NO PROBLEMS, or each problem by screen. Needs a fresh standalone.html (node tools/build.mjs --no-bump).
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
let bad = 0;
for (const ui of ["1", "1.6", "2"]) {
  const out = execFileSync(process.execPath, [join(here, "run.mjs"), join(here, "steps", "crawl.json"), "--pad", "--new-game", "--ui", ui], { encoding: "utf8" });
  const report = out.split("\n").find((l) => l.startsWith("eval: NO PROBLEMS") || l.startsWith("eval: PROBLEMS")) ?? out;
  const problems = out.slice(out.indexOf("eval: ")).split("---")[0];
  console.log(`== UI ${ui}: ${report.startsWith("eval: NO PROBLEMS") ? "no problems" : problems}`);
  if (!report.startsWith("eval: NO PROBLEMS")) bad++;
}
process.exit(bad ? 1 : 0);
