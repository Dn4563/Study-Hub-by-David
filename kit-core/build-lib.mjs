// Builds one self-contained index.html from content/course.json, each unit's data.json and kit-core.
// Called by each kit's scripts/build.mjs. No dependencies.
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join, extname, dirname } from "node:path";

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml", ".webp": "image/webp" };
const FONTS =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,600&family=Public+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">';

// Images listed in data.images can be a file path (relative to the unit folder) or an existing data: URI.
function inlineImages(data, unitDir) {
  for (const [key, val] of Object.entries(data.images || {})) {
    if (typeof val !== "string" || val.startsWith("data:")) continue;
    const file = join(unitDir, val);
    if (!existsSync(file)) throw new Error(`Image "${key}" not found: ${file}`);
    const mime = MIME[extname(file).toLowerCase()];
    if (!mime) throw new Error(`Unsupported image type: ${file}`);
    data.images[key] = `data:${mime};base64,${readFileSync(file).toString("base64")}`;
  }
}

// Fail the build early on content mistakes the page would otherwise hit at runtime.
function check(data, unitId) {
  const errs = [];
  const deckIds = new Set(data.decks.map((d) => d.id));
  data.sq.forEach((s, i) => !deckIds.has(s.deck) && errs.push(`scenario ${i + 1} uses unknown deck ${s.deck}`));
  data.practice.sections.forEach((sec) =>
    sec.questions.forEach((q) => {
      const where = `${sec.name} ${q.id}`;
      if (q.type === "mcq" && !(q.ans >= 0 && q.ans < q.options.length)) errs.push(`${where}: answer index out of range`);
      if (q.src && !(sec.sources || {})[q.src]) errs.push(`${where}: source ${q.src} missing`);
      if (q.type === "diagram") {
        if (!(data.images || {})[q.img]) errs.push(`${where}: image ${q.img} missing`);
        if (!q.credit) errs.push(`${where}: diagram needs a credit line`);
        q.pins.forEach((p, i) => (p.x < 0 || p.x > 100 || p.y < 0 || p.y > 100) && errs.push(`${where}: pin ${i + 1} outside 0-100%`));
      }
    }),
  );
  if (errs.length) throw new Error(`Unit ${unitId}:\n  ` + errs.join("\n  "));
}

export function buildKit({ root, coreDir, out = join(root, "index.html") }) {
  const course = JSON.parse(readFileSync(join(root, "content/course.json"), "utf8"));
  const unitData = {};
  for (const u of course.units) {
    const dir = join(root, "content", u.dir);
    const data = JSON.parse(readFileSync(join(dir, "data.json"), "utf8"));
    inlineImages(data, dir);
    check(data, u.id);
    unitData[u.id] = data;
    delete u.dir;
  }
  const css = ["tokens.css", "kit.css"].map((f) => readFileSync(join(coreDir, f), "utf8")).join("\n");
  const jsDir = join(coreDir, "js");
  const js = readdirSync(jsDir)
    .filter((f) => f.endsWith(".js"))
    .sort()
    .map((f) => `/* ${f} */\n` + readFileSync(join(jsDir, f), "utf8"))
    .join("\n");
  const json = (v) => JSON.stringify(v).replace(/</g, "\\u003c").replace(/[\u2028\u2029]/g, (c) => "\\u" + c.charCodeAt(0).toString(16));
  const html =
    `<!doctype html>\n<html lang="en" data-theme="auto"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${course.name} Study Kit</title>${FONTS}<style>\n${css}\n</style></head>\n<body><div id="app"></div>\n` +
    `<noscript>This study kit needs JavaScript.</noscript>\n<script>\nconst COURSE = ${json(course)};\nconst UNITDATA = ${json(unitData)};\n${js}\n</script>\n</body></html>\n`;
  writeFileSync(out, html);
  return { out, bytes: Buffer.byteLength(html), units: course.units.map((u) => u.id) };
}

// Run directly: node build-lib.mjs <kit-folder>
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const root = process.argv[2] || process.cwd();
  const r = buildKit({ root, coreDir: dirname(new URL(import.meta.url).pathname) });
  console.log(`Built ${r.out} (${Math.round(r.bytes / 1024)} KB): units ${r.units.join(", ")}`);
}
