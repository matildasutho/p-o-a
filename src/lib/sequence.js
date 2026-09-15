import fs from "fs";
import path from "path";

const ASSETS_DIR = path.join(process.cwd(), "public", "assets");
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm"]);
const NUMBER_PREFIX = /^(\d+)\s*-\s*/;

// Reads public/assets and orders the images/videos by the numeric prefix in
// each filename (matching the sequence in POA_ImageSequencev3.pdf). Drop new
// numbered files straight into that folder — no code changes needed here.
// Files without a numeric prefix (still awaiting a number from the client)
// are appended to the end so nothing gets silently skipped.
export function getSequenceAssets() {
  const files = fs
    .readdirSync(ASSETS_DIR)
    .filter((file) => !file.startsWith("."));

  const numbered = [];
  const unnumbered = [];

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const base = path.basename(file, ext);
    const match = base.match(NUMBER_PREFIX);

    const asset = {
      src: `/assets/${encodeURIComponent(file)}`,
      alt: base.replace(NUMBER_PREFIX, "").trim(),
      type: VIDEO_EXTENSIONS.has(ext) ? "video" : "image",
    };

    if (match) {
      numbered.push({ ...asset, number: parseInt(match[1], 10) });
    } else {
      unnumbered.push(asset);
    }
  }

  numbered.sort((a, b) => a.number - b.number || a.src.localeCompare(b.src));

  return [...numbered, ...unnumbered];
}
