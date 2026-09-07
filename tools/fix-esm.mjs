import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (p.endsWith(".js")) acc.push(p);
  }
  return acc;
}
const root = resolve(new URL("../dist", import.meta.url).pathname);
const re = /from\s+["'](\.[^"']+)["']/g;
let n = 0;
for (const f of walk(root)) {
  const s = readFileSync(f, "utf8");
  const next = s.replace(re, (_m, spec) => {
    let spec2 = spec.endsWith(".js") ? spec : spec + ".js";
    if (!existsSync(resolve(dirname(f), spec2))) {
      if (existsSync(join(resolve(dirname(f), spec), "index.js"))) spec2 = spec + "/index.js";
    }
    return `from "${spec2}"`;
  });
  if (next !== s) { writeFileSync(f, next); n++; }
}
console.log("esm-patched", n, "files");
