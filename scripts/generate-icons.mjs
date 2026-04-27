// Generate Printswipe PWA icons via @napi-rs/canvas.
//
// Output:
//   public/icons/icon-192.png
//   public/icons/icon-512.png
//   public/icons/icon-maskable.png        (512x512, design within ~60% safe zone)
//   public/icons/apple-touch-icon-152.png
//   public/icons/apple-touch-icon-167.png
//   public/icons/apple-touch-icon-180.png
//
// Run: pnpm gen:icons

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas } from "@napi-rs/canvas";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

const PAPER = "#FAFAF7";
const INK = "#0A0A0A";
const ACCENT = "#EF3340";

/**
 * Render the Printswipe mark.
 * @param {number} size       Canvas size (px).
 * @param {number} safeRatio  Fraction of canvas reserved for the design (1 = edge-to-edge).
 *                            Maskable icons should keep design within ~0.6 (40% safe-zone padding).
 */
function renderIcon(size, safeRatio = 1) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  // Background — paper-white edge-to-edge so maskable cropping never reveals transparency.
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, size, size);

  // Compute design bounds inside the safe-zone.
  const inset = (size * (1 - safeRatio)) / 2;
  const designSize = size - inset * 2;
  const cx = size / 2;
  const cy = size / 2;

  // Bold black "PS" monogram, centered.
  // Use a chunky monospace stack so it reads at small sizes.
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const fontSize = Math.round(designSize * 0.62);
  ctx.font = `900 ${fontSize}px "JetBrains Mono", ui-monospace, "Menlo", monospace`;
  // Nudge baseline up a hair to optically center the cap height.
  ctx.fillText("PS", cx, cy - designSize * 0.04);

  // Accent red registration bar to the right of the monogram.
  // Width: 8% of design, height: 32% of design.
  const barW = Math.max(2, Math.round(designSize * 0.08));
  const barH = Math.round(designSize * 0.32);
  const barX = cx + designSize * 0.32 - barW / 2;
  const barY = cy - barH / 2;
  ctx.fillStyle = ACCENT;
  ctx.fillRect(barX, barY, barW, barH);

  // Hairline frame — subtle 1px ink rule near the safe-zone edge for the non-maskable variants.
  if (safeRatio === 1) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, Math.round(size / 192));
    const pad = Math.round(size * 0.06);
    ctx.strokeRect(pad + 0.5, pad + 0.5, size - pad * 2 - 1, size - pad * 2 - 1);
  }

  return canvas.toBuffer("image/png");
}

function write(name, buf) {
  const path = resolve(outDir, name);
  writeFileSync(path, buf);
  // eslint-disable-next-line no-console
  console.log(`wrote ${path} (${buf.length} bytes)`);
}

write("icon-192.png", renderIcon(192, 1));
write("icon-512.png", renderIcon(512, 1));
// Maskable: design contained within 60% of the canvas (40% total safe-zone padding).
write("icon-maskable.png", renderIcon(512, 0.6));
write("apple-touch-icon-152.png", renderIcon(152, 1));
write("apple-touch-icon-167.png", renderIcon(167, 1));
write("apple-touch-icon-180.png", renderIcon(180, 1));

// eslint-disable-next-line no-console
console.log("done.");
