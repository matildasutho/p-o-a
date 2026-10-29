import fs from "fs";
import path from "path";

const ASSETS_DIR = path.join(process.cwd(), "public", "assets");
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm"]);
const NUMBER_PREFIX = /^(?:POA-)?(\d+)(?:-(\d{2}))?\s*-\s*/i;

const CROP_POSITIONS = {
  5: "center bottom",
};

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
