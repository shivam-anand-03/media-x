import { readFileSync, writeFileSync } from "fs";
import path from "path";

const ICONS = ["sparkles","star","heart","zap","flame","award","crown","gift","rocket","trophy","target","bell","tag","percent","shopping-bag","shopping-cart","calendar","clock","map-pin","phone","mail","globe","users","user","check","check-circle","arrow-right","arrow-up-right","play","music","camera","video","code","cpu","database","wifi","smartphone","laptop","headphones","coffee","utensils","pizza","graduation-cap","book-open","lightbulb","megaphone","thumbs-up","quote"];

// Names lucide has since renamed; the old name is what our icon library uses.
const ALIASES = { "check-circle": "circle-check" };

const base = process.argv[2];

// Convert a lucide icon node ([tag, attrs]) into an SVG path `d` string so
// Konva (which only understands <path>) can draw it.
function toPath([tag, attrs]) {
  const n = (v) => Number(v);
  switch (tag) {
    case "path":
      return attrs.d;
    case "circle": {
      const cx = n(attrs.cx), cy = n(attrs.cy), r = n(attrs.r);
      return `M ${cx - r},${cy} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 ${-r * 2},0`;
    }
    case "ellipse": {
      const cx = n(attrs.cx), cy = n(attrs.cy), rx = n(attrs.rx), ry = n(attrs.ry);
      return `M ${cx - rx},${cy} a ${rx},${ry} 0 1,0 ${rx * 2},0 a ${rx},${ry} 0 1,0 ${-rx * 2},0`;
    }
    case "line":
      return `M ${n(attrs.x1)},${n(attrs.y1)} L ${n(attrs.x2)},${n(attrs.y2)}`;
    case "rect": {
      const x = n(attrs.x), y = n(attrs.y), w = n(attrs.width), h = n(attrs.height);
      const r = attrs.rx ? n(attrs.rx) : 0;
      if (!r) return `M ${x},${y} H ${x + w} V ${y + h} H ${x} Z`;
      return `M ${x + r},${y} H ${x + w - r} A ${r},${r} 0 0 1 ${x + w},${y + r} V ${y + h - r} A ${r},${r} 0 0 1 ${x + w - r},${y + h} H ${x + r} A ${r},${r} 0 0 1 ${x},${y + h - r} V ${y + r} A ${r},${r} 0 0 1 ${x + r},${y} Z`;
    }
    case "polyline":
    case "polygon": {
      const pts = attrs.points.trim().split(/\s+/);
      const coords = [];
      // Points may be "x,y x,y" or "x y x y".
      if (pts[0].includes(",")) coords.push(...pts);
      else for (let i = 0; i < pts.length; i += 2) coords.push(`${pts[i]},${pts[i + 1]}`);
      const d = "M " + coords.join(" L ");
      return tag === "polygon" ? d + " Z" : d;
    }
    default:
      return null;
  }
}

const out = {};
for (const name of ICONS) {
  const file = path.join(base, `${ALIASES[name] ?? name}.js`);
  const mod = await import(file);
  const node = mod.__iconNode;
  if (!node) { console.error("no iconNode for", name); continue; }
  const paths = node.map(toPath).filter(Boolean);
  if (!paths.length) console.error("no paths for", name);
  out[name] = paths;
}

const body = Object.entries(out)
  .map(([name, paths]) => `  ${JSON.stringify(name)}: [\n${paths.map((p) => `    ${JSON.stringify(p)},`).join("\n")}\n  ],`)
  .join("\n");

writeFileSync(process.argv[3], `import type { IconName } from "@workspace/motion";

/**
 * Lucide icon outlines as SVG path data, on the 24x24 grid lucide authors on.
 *
 * Konva can only draw <path>, so lucide's circles, lines and polylines are
 * pre-converted here. Generated from lucide-react v0.475.0 so the editor canvas
 * draws exactly the same glyph the DOM renderer (and therefore the exported
 * video) does.
 *
 * Regenerate with scripts/generate-icon-paths.mjs if the icon set changes.
 */
export const ICON_PATHS: Record<string, string[]> = {
${body}
};

const FALLBACK = ICON_PATHS.sparkles as string[];

/** Path data for an icon, falling back to a known glyph for unknown names. */
export function getIconPath(name: IconName | string): string[] {
  return ICON_PATHS[name] ?? FALLBACK;
}
`);
console.log("generated", Object.keys(out).length, "icons");
