// Minimal Chrome DevTools Protocol client: Node built-ins only (fetch, WebSocket, child_process).
// Same approach as pazka/hosh-hub tools/interact.mjs: no package is installed for the visual harness.
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

// The page is served as http://draw.test:<port>: the front picks its server from the URL
// (front/src/services/env): a URL containing "localhost" means the DEV server http://localhost:9001, anything
// else means "same origin". Every other host name resolves to nothing, so no request can leave the runner.
export const RESOLVER_RULES = "MAP draw.test 127.0.0.1, MAP * ~NOTFOUND";

/**
 * Starts headless Chrome ($CHROME or google-chrome) and returns { page(), close(), version }.
 * cdpPort: use a Chrome already started with --remote-debugging-port=<cdpPort> (visual/run.sh starts it on
 * the runner and runs this harness with the image's own node, as scripts/browser-smoke.sh does).
 * mouse: the visitor has a mouse (hover: hover, pointer: fine); headless Chrome says "none" otherwise.
 * A setting of the whole browser (it wins over touch emulation in recent Chrome), so phone shots use
 * another browser without it.
 */
export async function launch({ mouse = false, cdpPort = 0 } = {}) {
  if (cdpPort) return connect(cdpPort, null, null);
  const profile = mkdtempSync(join(tmpdir(), "dt-visual-"));
  // port 0: Chrome picks a free port and writes it to <profile>/DevToolsActivePort (no collision)
  const chrome = spawn(process.env.CHROME || "google-chrome", [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--mute-audio", "--no-first-run",
    "--hide-scrollbars", "--force-color-profile=srgb", "--font-render-hinting=none",
    "--disable-features=Translate,MediaRouter", "--disable-background-networking",
    ...(mouse ? ["--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4"] : []),
    `--host-resolver-rules=${RESOLVER_RULES}`,
    "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  chrome.stderr.on("data", (d) => { stderr = (stderr + d).slice(-4000); });
  let url, port;
  for (let i = 0; i < 300 && !url; i++) {
    try {
      port = Number(readFileSync(join(profile, "DevToolsActivePort"), "utf8").split("\n")[0]);
      url = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl;
    } catch { await sleep(100); }
  }
  if (!url) {
    chrome.kill();
    throw new Error(`Chrome did not start in 30 s (set CHROME=/path/to/chrome)\n${stderr}`);
  }
  return connect(port, chrome, profile);
}

async function connect(port, chrome, profile) {
  let url;
  for (let i = 0; i < 300 && !url; i++) {
    try { url = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl; }
    catch { await sleep(100); }
  }
  if (!url) throw new Error(`no Chrome DevTools endpoint on 127.0.0.1:${port}`);
  const version = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).Browser;
  const ws = new WebSocket(url);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let seq = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) {
      const { res, rej } = pending.get(d.id);
      pending.delete(d.id);
      d.error ? rej(new Error(`${d.error.message}`)) : res(d.result);
    } else for (const l of listeners) l(d);
  };
  const raw = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const id = ++seq;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

  /** A new tab in its own browser context (own cookies = a fresh visitor). */
  async function page() {
    const { browserContextId } = await raw("Target.createBrowserContext", { disposeOnDetach: true });
    const { targetId } = await raw("Target.createTarget", { url: "about:blank", browserContextId });
    const { sessionId } = await raw("Target.attachToTarget", { targetId, flatten: true });
    const send = (method, params) => raw(method, params, sessionId);
    const errors = [];
    listeners.add((d) => {
      if (d.sessionId !== sessionId) return;
      if (d.method === "Runtime.exceptionThrown") {
        errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
      }
      // alert() / confirm() would block the page: the front alerts on a Socket.IO "error" (the server did
      // not save) and on a refused upload. Dismissed and counted as a page error (the shot fails).
      if (d.method === "Page.javascriptDialogOpening") {
        errors.push(`dialog ${d.params.type}: ${d.params.message}`);
        raw("Page.handleJavaScriptDialog", { accept: false }, sessionId).catch(() => {});
      }
    });
    await send("Page.enable");
    await send("Runtime.enable");
    const evaluate = async (expression) => {
      const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(`evaluate failed: ${r.exceptionDetails.text}`);
      return r.result.value;
    };
    const waitFor = async (expression, ms = 10000) => {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        try { if (await evaluate(expression)) return true; } catch { /* navigating */ }
        await sleep(50);
      }
      return false;
    };
    const goto = async (href) => {
      await send("Page.navigate", { url: href });
      await sleep(100);
      if (!(await waitFor("document.readyState === 'complete'"))) throw new Error(`page did not load: ${href}`);
      await evaluate("document.fonts ? document.fonts.ready.then(() => true) : true");
    };
    const close = () => raw("Target.closeTarget", { targetId });
    return { send, evaluate, waitFor, goto, close, errors };
  }

  function close() {
    try { ws.close(); } catch { /* closed */ }
    if (chrome) chrome.kill();
    if (profile) try { rmSync(profile, { recursive: true, force: true }); } catch { /* busy */ }
  }
  return { page, close, version };
}
