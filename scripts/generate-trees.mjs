/**
 * Extracts tight, single-image tree sprites from the LPC component sheets so
 * TownScene can place whole trees instead of stitching 32px tiles at runtime.
 *
 * Inputs (client/public/tiles/):
 *   treetop.png (192×224) — two round "oak" canopies on top, two "pine"
 *                           canopies on the bottom half.
 *   trunk.png   (192×96)  — trunk + ground-shadow stems (two variants).
 *
 * Outputs (client/public/tiles/):
 *   tree_oak_top.png   — oak canopy, alpha-cropped
 *   tree_pine_top.png  — pine canopy, alpha-cropped
 *   tree_stem.png      — trunk + shadow, alpha-cropped
 *
 * Canopies are drawn ABOVE the player (high depth) and the stem BELOW with a
 * collider, so the player can walk behind a tree.
 *
 * Run from project root:  node scripts/generate-trees.mjs
 */
import { Jimp } from 'jimp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TILES = path.join(__dirname, '..', 'client', 'public', 'tiles');

// Tightest opaque bounding box within [x0,x1) x [y0,y1) of img (alpha > 16).
function alphaBBox(img, x0, y0, x1, y1) {
  let minX = x1, minY = y1, maxX = x0, maxY = y0, found = false;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const a = img.bitmap.data[(y * img.bitmap.width + x) * 4 + 3];
      if (a > 16) {
        found = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!found) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

async function extract(srcFile, region, outFile) {
  const img = await Jimp.read(path.join(TILES, srcFile));
  const bb = alphaBBox(img, region.x0, region.y0, region.x1, region.y1);
  if (!bb) throw new Error(`No opaque pixels in ${srcFile} region ${JSON.stringify(region)}`);
  const out = img.clone().crop(bb);
  await out.write(path.join(TILES, outFile));
  console.log(`${outFile.padEnd(20)} ${bb.w}×${bb.h}  (from ${srcFile} @ ${bb.x},${bb.y})`);
}

// treetop.png: oak canopies fill the top half, pines the bottom half.
// Use the left-hand variant of each, searching its half-quadrant.
await extract('treetop.png', { x0: 0, y0: 0,   x1: 96, y1: 112 }, 'tree_oak_top.png');
await extract('treetop.png', { x0: 0, y0: 112, x1: 96, y1: 224 }, 'tree_pine_top.png');
// trunk.png: left stem variant.
await extract('trunk.png',   { x0: 0, y0: 0,   x1: 96, y1: 96  }, 'tree_stem.png');

console.log('Done. Trees extracted to client/public/tiles/');
