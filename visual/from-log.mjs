// Takes the shots printed by `VISUAL_PRINT_NEW=1 node visual/shoot.mjs` out of a CI log and writes them
// into a directory (default visual/baseline/), checking each file's sha256. For agents whose sandbox cannot
// download Actions artifacts. Look at every picture before committing it as a baseline.
//
//   node visual/from-log.mjs <job log file> [dir] [--chrome "Chrome/x.y"]
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const [log, dir = new URL("./baseline/", import.meta.url).pathname] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const parts = new Map();
let chrome = "";
for (const line of readFileSync(log, "utf8").split("\n")) {
  const c = /Chrome: (Chrome\/\S+)/.exec(line);
  if (c) chrome = c[1];
  const m = /VISUAL-PNG (\S+\.png) (\d+)\/(\d+) ([0-9a-f]{64}) ([A-Za-z0-9+/=]+)\s*$/.exec(line);
  if (!m || !/^[\w.-]+$/.test(m[1])) continue;
  const [, name, i, n, sum, data] = m;
  const p = parts.get(name) || { n: Number(n), sum, chunks: [] };
  p.chunks[Number(i) - 1] = data;
  parts.set(name, p);
}
let bad = 0;
for (const [name, p] of parts) {
  const ok = p.chunks.length === p.n && !p.chunks.includes(undefined);
  const png = ok ? Buffer.from(p.chunks.join(""), "base64") : null;
  if (!png || createHash("sha256").update(png).digest("hex") !== p.sum) {
    console.log(`BAD   ${name} (incomplete or checksum mismatch)`);
    bad++;
    continue;
  }
  writeFileSync(join(dir, name), png);
  console.log(`wrote ${join(dir, name)} (${png.length} B)`);
}
if (chrome && process.argv.includes("--chrome")) writeFileSync(join(dir, "chrome.txt"), chrome + "\n");
console.log(`${parts.size - bad} shot(s) written, ${bad} bad; made by ${chrome || "unknown Chrome"}`);
process.exit(bad ? 1 : 0);
