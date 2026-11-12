// Packs index.html and dist/*.js into one file, standalone.html, that runs with a double-click
// (no web server). Each module is turned into a blob URL at load time, and an import map points
// the modules at each other, so the code stays exactly as compiled.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, posix } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const full = join(dir, f);
    return statSync(full).isDirectory() ? walk(full) : f.endsWith(".js") ? [full] : [];
  });
}

const modules = {};
for (const file of walk(dist)) {
  const name = relative(dist, file).split("\\").join("/"); // e.g. "ui/menu.js"
  const src = readFileSync(file, "utf8").replace(/(from\s+|import\s*\(\s*|import\s+)(["'])(\.{1,2}\/[^"']+)\2/g, (_m, kw, q, spec) => {
    // Turn relative imports into names the import map knows: "inn:ui/menu.js"
    const target = posix.normalize(posix.join(posix.dirname(name), spec));
    return `${kw}${q}inn:${target}${q}`;
  });
  modules[name] = src;
}

const loader = `
<script>
(function () {
  var mods = ${JSON.stringify(modules).replace(/<\/script/gi, "<\\/script")};
  var imports = {};
  for (var name in mods) {
    imports["inn:" + name] = URL.createObjectURL(new Blob([mods[name]], { type: "text/javascript" }));
  }
  var map = document.createElement("script");
  map.type = "importmap";
  map.textContent = JSON.stringify({ imports: imports });
  document.head.appendChild(map);
  var main = document.createElement("script");
  main.type = "module";
  main.textContent = 'import "inn:main.js";';
  document.body.appendChild(main);
})();
</script>`;

let html = readFileSync(join(root, "index.html"), "utf8");
html = html.replace(/<script type="module" src="dist\/main\.js"><\/script>/, loader.trim());
html = html.replace("<title>", "<!-- Built from index.html + dist/ by tools/standalone.mjs. Edit those, not this. -->\n<title>");
writeFileSync(join(root, "standalone.html"), html);
console.log(`standalone.html: ${Object.keys(modules).length} modules, ${(html.length / 1024).toFixed(0)} KB`);
