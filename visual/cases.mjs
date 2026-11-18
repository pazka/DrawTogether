// Visual use cases covered by the harness (ids from TESTING.md "Visual use cases").
// Each: { id, path, widths?, steps?, ready?, mask?, settle?, keepFocus? }.
// - path: opened in a NEW browser context (a fresh visitor) on http://draw.test:<port>.
// - steps(page, ctx): what the visitor does before the shot. ctx = { base, api, open(path) }: open() starts a
//   second visitor (another browser context, closed after the shot) for the multi-user case.
// - ready: a JS expression that must become true before the shot.
// - widths: only these widths (default WIDTHS). Hover needs a mouse: there is none on a phone.
// Data is deterministic: seed() writes the board through the server's own REST API (import + background
// upload) before any shot, on a fresh container (visual/run.sh), so room ids, texts and image are fixed.
import { deflateSync, crc32 } from "node:zlib";

export const WIDTHS = [1400, 1024, 390];

const js = (v) => JSON.stringify(v);

// ---------- seeded data ----------
export const BOARD = "visualboard";
const ROOM = {
  id: BOARD,
  version: 1,
  lastUpdate: 1767225600000, // 2026-01-01T00:00:00Z
  layers: [
    {
      id: 1, name: "Plan", imgPath: "",
      texts: [
        { val: "Kitchen", pos: [140, 180], size: 2, color: "rgba(200,30,30,1)", bold: true },
        { val: "Living room", pos: [560, 330], size: 1.4, rot: -10, underline: true, color: "rgba(20,60,200,1)" },
        { val: "Garden", pos: [260, 560], size: 1, width: 2 },
      ],
    },
    {
      id: 2, name: "Notes", imgPath: "",
      texts: [{ val: "Second layer note", pos: [220, 420], size: 1.6, color: "rgba(0,120,0,1)" }],
    },
  ],
};

/** A 1200x800 "floor plan" PNG (grid + three rooms), built with zlib only: same bytes on every run. */
export function planPng(w = 1200, h = 800) {
  const rooms = [[80, 100, 420, 300, [255, 228, 196]], [480, 240, 1100, 520, [208, 232, 255]], [160, 470, 560, 740, [210, 245, 210]]];
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < w; x++) {
      let c = (x % 50 === 0 || y % 50 === 0) ? [220, 220, 220] : [250, 250, 250];
      for (const [x0, y0, x1, y1, col] of rooms) {
        if (x >= x0 && x <= x1 && y >= y0 && y <= y1) {
          c = (x - x0 < 4 || x1 - x < 4 || y - y0 < 4 || y1 - y < 4) ? [60, 60, 60] : col;
        }
      }
      raw.set(c, row + 1 + x * 3);
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

/** Writes the board through the API (as "Import a project" and "Change Background" do) and checks it. */
export async function seed(api) {
  const ok = async (r, what) => { if (!r.ok) throw new Error(`seed: ${what} -> HTTP ${r.status} ${await r.text()}`); return r; };
  // GET /<room> creates the room, as a visitor's first visit does
  await ok(await fetch(`${api}/${BOARD}`), "create room");
  await ok(await fetch(`${api}/api/room/${BOARD}/import`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ROOM),
  }), "import");
  const form = new FormData();
  form.append("layerImg", new Blob([planPng()], { type: "image/png" }), "plan.png");
  await ok(await fetch(`${api}/api/room/${BOARD}/1/upload`, { method: "POST", body: form }), "background upload");
  const room = await (await ok(await fetch(`${api}/api/room/${BOARD}`), "read back")).json();
  if (room.layers?.[0]?.imgPath !== `/uploads/${BOARD}/plan.png` || room.layers[0].texts.length !== 3 || room.layers.length !== 2) {
    throw new Error(`seed: unexpected room ${JSON.stringify(room)}`);
  }
  const img = await ok(await fetch(`${api}/uploads/${BOARD}/plan.png`), "background served");
  if (!planPng().equals(Buffer.from(await img.arrayBuffer()))) throw new Error("seed: background served differs");
}

// ---------- steps ----------
async function must(p, expression, what, ms) {
  if (!(await p.waitFor(expression, ms))) throw new Error(`step failed: ${what}`);
}
async function click(p, sel, label = "") {
  await must(p, `(() => {
    const e = [...document.querySelectorAll(${js(sel)})].find((x) => x.innerText.includes(${js(label)}) && !x.disabled);
    if (!e) return false;
    e.click();
    return true;
  })()`, `click ${sel} "${label}"`);
}
/** Center of the first element matching sel whose text includes label, in viewport coordinates. */
async function center(p, sel, label = "") {
  await must(p, `[...document.querySelectorAll(${js(sel)})].some((x) => x.innerText.includes(${js(label)}))`, `find ${sel} "${label}"`);
  return p.evaluate(`(() => {
    const e = [...document.querySelectorAll(${js(sel)})].find((x) => x.innerText.includes(${js(label)}));
    e.scrollIntoView({ block: "center", inline: "center" });
    const r = e.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
}
const mouse = (p, type, x, y, extra = {}) => p.send("Input.dispatchMouseEvent", { type, x, y, button: "none", ...extra });

// the room is on screen: the socket delivered loadRoom (layer names listed) and the info box shows the room
const loaded = (room, layer) => `document.body.innerText.includes(${js("Room name : " + room)}) &&
  [...document.querySelectorAll(".layer-item p")].some((e) => e.innerText === ${js(layer)})`;
const boardReady = `${loaded(BOARD, "Plan")} && [...document.querySelectorAll(".name-item p")].some((e) => e.innerText === "Kitchen")
  && (() => { const i = document.querySelector(".layer-img img"); return !!i && i.complete && i.naturalWidth === 1200; })()`;

export const CASES = [
  // ---------- a new room (GET /<name> creates it with one empty layer) ----------
  {
    id: "E1-new-room", path: "/visualempty",
    ready: `${loaded("visualempty", "Layer")} && document.body.innerText.includes("1 users in this room.")
      && !!document.querySelector(".layer-controls") && !document.querySelector(".layer-img img")`,
  },
  // ---------- the seeded board ----------
  { id: "B1-board", path: `/${BOARD}`, ready: boardReady },
  {
    id: "B2-board-second-layer", path: `/${BOARD}`,
    steps: async (p) => {
      await must(p, boardReady, "board");
      await click(p, ".layer-item", "Notes");
    },
    ready: `document.querySelector(".layer-item-selected")?.innerText.includes("Notes")
      && [...document.querySelectorAll(".name-item p")].map((e) => e.innerText).join("|") === "Second layer note"
      && !document.querySelector(".layer-img img")`,
  },
  {
    // hover a text: its edit toolbar (size, width, rotation, bold, underline, color, delete) appears
    id: "B3-text-hover-toolbar", path: `/${BOARD}`, widths: [1400, 1024],
    steps: async (p) => {
      await must(p, boardReady, "board");
      const c = await center(p, ".name-item p", "Kitchen");
      await mouse(p, "mouseMoved", c.x, c.y);
    },
    ready: `[...document.querySelectorAll(".name-item")].some((e) => e.matches(":hover") && e.innerText.includes("Kitchen")
      && getComputedStyle(e.querySelector(".edit-name-container")).display !== "none")`,
  },
  {
    // double-click a text: it becomes an input (nothing is saved until the visitor types)
    id: "B4-text-editing", path: `/${BOARD}`,
    steps: async (p) => {
      await must(p, boardReady, "board");
      await p.evaluate(`(() => {
        const e = [...document.querySelectorAll(".name-item p")].find((x) => x.innerText === "Garden");
        e.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
        return true;
      })()`);
    },
    ready: `document.querySelector(".name-item input")?.value === "Garden"`,
    keepFocus: true, // a blur closes the input (onBlur)
  },
  {
    // "Change Background" and "Import a project" open their file forms
    id: "B5-forms-open", path: `/${BOARD}`,
    steps: async (p) => {
      await must(p, boardReady, "board");
      await click(p, ".layer-controls button", "Change Background");
      await click(p, ".layer-controls button", "Import a project");
    },
    ready: `!!document.querySelector(".layer-controls input[name=layerImg]") && !!document.querySelector(".layer-controls input[name=projectFile]")
      && document.querySelector(".layer-controls").innerText.includes("Close background upload")
      && document.querySelector(".layer-controls").innerText.includes("Close Upload")`,
  },
  {
    // a second visitor named "Visual Bob" moves their mouse: the first one sees 2 users and Bob's pointer
    id: "U1-two-users", path: `/${BOARD}`,
    steps: async (p, ctx) => {
      await must(p, boardReady, "board");
      const bob = await ctx.open(`/${BOARD}`);
      await must(bob, boardReady, "Bob's board");
      await must(bob, `(() => { const e = document.querySelector(".mouse-container .info input"); if (!e) return false; e.focus(); e.select(); return true; })()`, "Bob's name field");
      await bob.send("Input.insertText", { text: "Visual Bob" });
      await must(bob, `document.querySelector(".mouse-container .info input").value === "Visual Bob"`, "Bob's name typed");
      await new Promise((r) => setTimeout(r, 300)); // the mousemove listener is re-bound with the new name
      await mouse(bob, "mouseMoved", 700, 160);
    },
    ready: `document.body.innerText.includes("2 users in this room.")
      && [...document.querySelectorAll(".mice p")].some((e) => e.innerText === "Visual Bob")`,
  },
  {
    // presentation mode (?displayOnly=true): no info box, no controls, layers without delete buttons
    id: "D1-presentation", path: `/${BOARD}?displayOnly=true`,
    ready: `[...document.querySelectorAll(".layer-item p")].some((e) => e.innerText === "Plan")
      && [...document.querySelectorAll(".name-item p")].some((e) => e.innerText === "Kitchen")
      && !document.querySelector(".layer-controls") && !document.querySelector(".mouse-container .info")
      && (() => { const i = document.querySelector(".layer-img img"); return !i || (i.complete && i.naturalWidth === 1200); })()`,
  },
  {
    // "New Text": the "New Text" label follows the pointer until the visitor clicks. Own room: nothing is
    // saved by this case (checked: no text is created), but no other case can be affected if it ever is.
    id: "N1-new-text-mode", path: "/visualnewtext",
    steps: async (p) => {
      await must(p, loaded("visualnewtext", "Layer"), "room");
      await click(p, ".layer-controls button", "New Text");
      await mouse(p, "mouseMoved", 300, 420);
    },
    ready: `[...document.querySelectorAll(".name-container > .name-item")].some((e) => e.innerText.trim() === "New Text")
      && !document.querySelector(".name-item p")`,
  },
];
// Not covered (TESTING.md): drag and drop of a text, the colour picker, a layer renamed / added / deleted,
// "Save project" (a download) and "New project" (a prompt), a real file chosen in the forms (they write).
