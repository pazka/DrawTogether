// Visual regression harness for DrawTogether (hosh-management AGENTS.md §3, copied from pazka/MyMurderParty
// visual/shoot.mjs, itself from pazka/plats): seeds the board through the API, then takes a screenshot of
// every use case of visual/cases.mjs at 1400, 1024 and 390 px, then compares each with its baseline in
// visual/baseline/ and writes a diff picture for every difference. Node built-ins + the machine's Chrome.
//
//   node visual/shoot.mjs <page url> <api url> [--update]
//     page url: http://draw.test:9875 (what Chrome opens; draw.test is mapped to 127.0.0.1 by visual/cdp.mjs)
//     api url: http://127.0.0.1:9875 (the same server, for the seed; a host name without "localhost")
//     OUT=visual/out (shots + diffs + report.json)   CHROME=/path/to/chrome (default google-chrome)
//     --update: copy the new shots over the baselines (QA only, in a PR that says the change is wanted).
//     VISUAL_PRINT_NEW=1: also print every failing shot in the log (visual/from-log.mjs takes them back).
//     CDP_DESKTOP / CDP_PHONE=<port>: use Chromes already running (visual/run.sh), else spawn $CHROME.
//
// Determinism: animations and transitions off, caret hidden, scrollbars hidden, sRGB, a fixed viewport
// height, random or dated content masked (cases.mjs). The baseline is only meaningful for the Chrome
// that made it: report.json records the Chrome version, and a version change is reported as such.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { launch } from "./cdp.mjs";
import { CASES, WIDTHS, seed } from "./cases.mjs";

const base = (process.argv[2] || "http://draw.test:9875").replace(/\/$/, "");
const api = (process.argv[3] || "http://127.0.0.1:9875").replace(/\/$/, "");
const update = process.argv.includes("--update");
const OUT = process.env.OUT || "visual/out";
const BASE_DIR = process.env.BASELINE || new URL("./baseline/", import.meta.url).pathname;
// per-pixel tolerance (max channel difference, anti-aliasing) and share of differing pixels allowed
const CHANNEL_TOL = Number(process.env.VISUAL_CHANNEL_TOL || 24);
const MAX_RATIO = Number(process.env.VISUAL_MAX_RATIO || 0.001);

// empty OUT (it may be a mount point: visual/run.sh mounts it into the container)
mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) rmSync(join(OUT, f), { recursive: true, force: true });
mkdirSync(join(OUT, "diff"), { recursive: true });

const FREEZE = `
  *, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
  html { scroll-behavior: auto !important; }`;

// desktop and laptop shots: a browser with a mouse; phone shots: a touch browser without one
const desktop = await launch({ mouse: true, cdpPort: Number(process.env.CDP_DESKTOP || 0) });
const phone = await launch({ mouse: false, cdpPort: Number(process.env.CDP_PHONE || 0) });
const browser = desktop; // comparisons and the version
const report = { chrome: browser.version, base, shots: [], failures: [] };
console.log(`Chrome: ${browser.version}`);
await seed(api);
console.log(`seeded the board through ${api}`);

async function shoot(c, width, dark) {
  const mobile = width < 600;
  const p = await (mobile ? phone : desktop).page();
  const others = [];
  // a second visitor (U1): another browser context of the desktop browser, closed after the shot
  const open = async (path) => {
    const o = await desktop.page();
    others.push(o);
    await o.send("Emulation.setDeviceMetricsOverride", { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
    await o.goto(base + path);
    return o;
  };
  await p.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile });
  if (mobile) await p.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  await p.send("Emulation.setEmulatedMedia", {
    features: [
      { name: "prefers-color-scheme", value: dark ? "dark" : "light" },
      { name: "prefers-reduced-motion", value: "reduce" },
    ],
  });
  await p.goto(base + c.path);
  if (c.steps) await c.steps(p, { base, api, open });
  if (c.ready && !(await p.waitFor(c.ready))) {
    const text = await p.evaluate("document.body.innerText.slice(0, 300)").catch(() => "?");
    throw new Error(`not ready: ${c.ready}\n    page text: ${JSON.stringify(text)}`);
  }
  await sleep(c.settle ?? 300); // socket.io answers and react re-renders after the last step
  const css = FREEZE + (c.mask || []).map((s) => `${s} { visibility: hidden !important; }`).join("\n");
  await p.evaluate(`(() => {
    const s = document.createElement("style"); s.textContent = ${JSON.stringify(css)}; document.head.appendChild(s);
    for (const [sel, text] of Object.entries(${JSON.stringify(c.fixText || {})})) {
      for (const e of document.querySelectorAll(sel)) { e.textContent = text; e.hidden = false; }
    }
    if (!${JSON.stringify(!!c.keepFocus)} && document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    window.scrollTo(0, 0);
    return true;
  })()`);
  if (c.fixJs) await p.evaluate(c.fixJs); // may return a promise (awaited)
  await p.evaluate("new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))");
  const { data } = await p.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, fromSurface: true });
  const errors = [...p.errors, ...others.flatMap((o) => o.errors)];
  for (const o of others) await o.close();
  await p.close();
  return { png: Buffer.from(data, "base64"), errors };
}

/** Compares two PNGs in Chrome (canvas): differing pixels, and a diff picture (red where they differ). */
async function compare(a, b) {
  const p = await browser.page();
  const r = await p.evaluate(`(async () => {
    const load = (b64) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = "data:image/png;base64," + b64; });
    const [x, y] = await Promise.all([load(${JSON.stringify(a.toString("base64"))}), load(${JSON.stringify(b.toString("base64"))})]);
    if (x.width !== y.width || x.height !== y.height) return { size: [x.width, x.height, y.width, y.height] };
    const w = x.width, h = x.height;
    const get = (img) => { const c = new OffscreenCanvas(w, h); const g = c.getContext("2d"); g.drawImage(img, 0, 0); return g.getImageData(0, 0, w, h).data; };
    const da = get(x), db = get(y);
    const out = new OffscreenCanvas(w, h); const g = out.getContext("2d"); const od = g.createImageData(w, h);
    let diff = 0;
    for (let i = 0; i < da.length; i += 4) {
      const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
      if (d > ${CHANNEL_TOL}) { diff++; od.data[i] = 255; od.data[i + 1] = 0; od.data[i + 2] = 0; od.data[i + 3] = 255; }
      else { const v = (da[i] + da[i + 1] + da[i + 2]) / 3; od.data[i] = od.data[i + 1] = od.data[i + 2] = 255 - (255 - v) * 0.25; od.data[i + 3] = 255; }
    }
    g.putImageData(od, 0, 0);
    const blob = await out.convertToBlob({ type: "image/png" });
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = ""; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { diff, total: w * h, png: btoa(s) };
  })()`);
  await p.close();
  return r;
}

function printShot(name, png) {
  const b64 = png.toString("base64");
  const n = Math.ceil(b64.length / 8000);
  const sum = createHash("sha256").update(png).digest("hex");
  for (let i = 0; i < n; i++) console.log(`VISUAL-PNG ${name} ${i + 1}/${n} ${sum} ${b64.slice(i * 8000, (i + 1) * 8000)}`);
}

for (const c of CASES.filter((x) => !process.env.ONLY || x.id.startsWith(process.env.ONLY))) {
  for (const width of c.widths || WIDTHS) {
    for (const dark of c.dark ? [false, true] : [false]) {
      const name = `${c.id}-${width}${dark ? "-dark" : ""}.png`;
      let shot;
      try {
        shot = await shoot(c, width, dark);
      } catch (e) {
        report.failures.push({ name, reason: `could not take the shot: ${e.message}` });
        console.log(`FAIL  ${name}  (${e.message})`);
        continue;
      }
      writeFileSync(join(OUT, name), shot.png);
      const entry = { name, errors: shot.errors };
      if (shot.errors.length) {
        report.failures.push({ name, reason: `page error: ${shot.errors[0]}` });
      }
      const basePath = join(BASE_DIR, name);
      if (update) {
        copyFileSync(join(OUT, name), basePath);
        entry.result = "baseline updated";
      } else if (!existsSync(basePath)) {
        entry.result = "no baseline";
        report.failures.push({ name, reason: "no baseline (visual/baseline/" + name + ")" });
      } else {
        const r = await compare(readFileSync(basePath), shot.png);
        if (r.size) {
          entry.result = `size ${r.size[0]}x${r.size[1]} -> ${r.size[2]}x${r.size[3]}`;
          report.failures.push({ name, reason: `page size changed: ${entry.result}` });
        } else {
          entry.ratio = r.diff / r.total;
          entry.result = r.diff ? `${r.diff} px differ (${(entry.ratio * 100).toFixed(3)} %)` : "identical";
          if (r.diff) writeFileSync(join(OUT, "diff", name), Buffer.from(r.png, "base64"));
          if (entry.ratio > MAX_RATIO) report.failures.push({ name, reason: entry.result });
        }
      }
      report.shots.push(entry);
      // VISUAL_PRINT_NEW=1 (CI): a shot without a matching baseline is also printed in the log, so an agent
      // that cannot download artifacts can take it as the new baseline (visual/from-log.mjs).
      if (process.env.VISUAL_PRINT_NEW && report.failures.some((f) => f.name === name)) printShot(name, shot.png);
      console.log(`${report.failures.some((f) => f.name === name) ? "FAIL" : "ok  "}  ${name}  ${entry.result}`);
    }
  }
}

if (!update) {
  // a baseline nobody shoots any more is a use case that silently left the harness
  const shot = new Set(report.shots.map((s) => s.name));
  for (const f of readdirSync(BASE_DIR).filter((f) => f.endsWith(".png"))) {
    if (!shot.has(f)) report.failures.push({ name: f, reason: "baseline without a use case (removed from cases.mjs?)" });
  }
  const prev = existsSync(join(BASE_DIR, "chrome.txt")) ? readFileSync(join(BASE_DIR, "chrome.txt"), "utf8").trim() : "";
  if (prev && prev !== browser.version) {
    console.log(`note: baselines were made with ${prev}, this run uses ${browser.version}`);
    report.baselineChrome = prev;
  }
} else {
  writeFileSync(join(BASE_DIR, "chrome.txt"), browser.version + "\n");
}

desktop.close();
phone.close();
writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(`\n${report.shots.length} shots, ${report.failures.length} failure(s)`);
for (const f of report.failures) console.log(`  - ${f.name}: ${f.reason}`);
process.exit(report.failures.length ? 1 : 0);
