import fs from "fs";
import path from "path";

const ASSETS_DIR = path.join(process.cwd(), "public", "assets");
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm"]);
// Matches "POA-17-02-" style prefixes: the project number, then an optional
// sub-number for projects with several assets. The older "17 - " style still
// matches too.
const NUMBER_PREFIX = /^(?:POA-)?(\d+)(?:-(\d{2}))?\s*-\s*/i;

// Where to anchor the crop for full-screen assets, keyed by project number.
// Anything not listed crops from the centre.
const CROP_POSITIONS = {
  // The floor is the focus, so crop the top rather than the bottom.
  5: "center bottom",
};

// Reads public/assets and orders the images/videos by the numeric prefix in
// each filename (matching the sequence in SEQUENCING_TRANSITION_Oct26.pdf).
// Drop new numbered files straight into that folder — no code changes needed
// here. Odd positions show full screen and even positions show small, so a
// missing or extra file shifts every asset after it.
// A .gif sharing its number with another file (e.g. POA-17-02 alongside
// POA-17-01) isn't a step of its own: it's layered over that file instead.
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

    const label = base.replace(NUMBER_PREFIX, "").replace(/-/g, " ").trim();
    const asset = {
      src: `/assets/${encodeURIComponent(file)}`,
      alt: label,
      label,
      type: VIDEO_EXTENSIONS.has(ext) ? "video" : "image",
      isGif: ext === ".gif",
    };

    if (match) {
      const number = parseInt(match[1], 10);
      numbered.push({
        ...asset,
        number,
        position: CROP_POSITIONS[number] ?? null,
      });
    } else {
      unnumbered.push(asset);
    }
  }

  numbered.sort((a, b) => a.number - b.number || a.src.localeCompare(b.src));

  const sequence = [];
  for (const asset of numbered) {
    const previous = sequence[sequence.length - 1];
    if (asset.isGif && previous?.number === asset.number) {
      previous.layers.push(asset);
    } else {
      sequence.push({ ...asset, layers: [] });
    }
  }

  return [...sequence, ...unnumbered.map((asset) => ({ ...asset, layers: [] }))];
}
