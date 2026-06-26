/**
 * Assembles complete top-down building sprites from LPC house component tiles.
 *
 * house.png (288×224) has two visual layers:
 *   TOP half    (y 0-96):   facade pieces — brick gable, door, window/barrel
 *   BOTTOM half (y 96-224): roof-from-above — peaked arch, stone wall, colonnade
 *
 * In a top-down RPG, the roof is NORTH (appears above the facade on screen).
 * So the correct stack is:  [roof section]
 *                           [facade section]
 *
 * Final sprite: 288×224 px (9×7 tiles at 32px)
 *   y   0-128  : roof/arch section (from house.png y 96-224)
 *   y 128-224  : facade section    (from house.png y  0-96)
 */
import { Jimp } from 'jimp';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TILES = path.resolve(__dirname, '../client/public/tiles');
const OUT   = path.resolve(__dirname, '../client/public/buildings');

fs.mkdirSync(OUT, { recursive: true });

// Column layout in house.png (each 96px wide):
//   col0 (x 0-96):   peaked arch + chimney — left side / gable
//   col1 (x 96-192): stone wall + wooden door/steps — center
//   col2 (x 192-288): white colonnade + misc — discarded (wrong style)
//
// Composite: col0 | col1 | col1-wall-extension
//   Left:   arch gable roof / brick chimney
//   Center: stone wall / door entry
//   Right:  extra stone wall width (col1 without door details)
//
// For the right third we re-use the upper (wall) portion of col1 on top
// and a simple stone-brick tile fill below, so the building reads as wider
// without the jarring white colonnade.

// Column layout in house.png (each 96px wide):
//   col0 (x 0-96):   peaked arch gable + brick chimney — left wing
//   col1 (x 96-192): stone wall (roof) + wooden door/steps (facade) — center entry
//
// Composite: col0-gable | col1-door | col1-wall-only
//   Right column facade uses the stone brick wall from the roof section
//   (no door) so the building reads as wider without doubling the door.

async function buildSprite(srcFile, outName) {
  const src = await Jimp.read(path.join(TILES, srcFile));

  // col0: arch gable (left)
  const col0Roof = src.clone().crop({ x: 0,  y: 96, w: 96, h: 128 });
  const col0Face = src.clone().crop({ x: 0,  y: 0,  w: 96, h: 96  });

  // col1: center entry
  const col1Roof = src.clone().crop({ x: 96, y: 96, w: 96, h: 128 });
  const col1Face = src.clone().crop({ x: 96, y: 0,  w: 96, h: 96  });

  // Right column: stone wall bricks only — crop the top 96px of col1's roof section
  // (solid brickwork, no door) to use as the right-side wall facade fill
  const rightFaceWall = col1Roof.clone().crop({ x: 0, y: 0, w: 96, h: 96 });

  const canvas = new Jimp({ width: 288, height: 224, color: 0x00000000 });
  canvas.composite(col0Roof,      0,   0);
  canvas.composite(col1Roof,      96,  0);
  canvas.composite(col1Roof.clone(), 192, 0);
  canvas.composite(col0Face,      0,   128);
  canvas.composite(col1Face,      96,  128);
  canvas.composite(rightFaceWall, 192, 128);  // wall only, no door

  await canvas.write(path.join(OUT, outName));
  console.log(`  ${outName}`);
}

async function buildTownHall(srcFile, outName) {
  const src = await Jimp.read(path.join(TILES, srcFile));

  const col0Roof = src.clone().crop({ x: 0,  y: 96, w: 96, h: 128 });
  const col0Face = src.clone().crop({ x: 0,  y: 0,  w: 96, h: 96  });
  const col1Roof = src.clone().crop({ x: 96, y: 96, w: 96, h: 128 });
  const col1Face = src.clone().crop({ x: 96, y: 0,  w: 96, h: 96  });
  const wallFill = col1Roof.clone().crop({ x: 0, y: 0, w: 96, h: 96 });

  // Town Hall 576×224: left wing (gable+door+wall) | right wing (wall+door+gable)
  const canvas = new Jimp({ width: 576, height: 224, color: 0x00000000 });
  // Left wing
  canvas.composite(col0Roof.clone(), 0,   0);
  canvas.composite(col1Roof.clone(), 96,  0);
  canvas.composite(col1Roof.clone(), 192, 0);
  canvas.composite(col0Face.clone(), 0,   128);
  canvas.composite(col1Face.clone(), 96,  128);
  canvas.composite(wallFill.clone(), 192, 128);
  // Right wing (mirrored: wall+door+gable)
  canvas.composite(col1Roof.clone(), 288, 0);
  canvas.composite(col1Roof.clone(), 384, 0);
  canvas.composite(col0Roof.clone(), 480, 0);
  canvas.composite(wallFill.clone(), 288, 128);
  canvas.composite(col1Face.clone(), 384, 128);
  canvas.composite(col0Face.clone(), 480, 128);

  await canvas.write(path.join(OUT, outName));
  console.log(`  ${outName}`);
}

// Smithy drawn in 3/4 top-down projection (light from upper-left). The roof is a
// real hipped volume with three differently-lit planes (lit left, medium front,
// shadowed right) that you look DOWN onto — that faceting, plus a deep overhang
// shadow, is what reads as 3D in a top-down game (vs. a flat front elevation).
async function buildArmoryArt(outName) {
  const W = 288, H = 224;
  const img  = new Jimp({ width: W, height: H, color: 0x00000000 });
  const rgba = (r, g, b, a = 255) => (((r * 16777216) + (g * 65536) + (b * 256) + a) >>> 0);
  const set  = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) img.setPixelColor(c, x, y); };
  const fill = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c); };
  const disc = (cx, cy, r, c) => { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x*x + y*y <= r*r) set(cx + x, cy + y, c); };
  const ring = (cx, cy, ro, ri, c) => { for (let y = -ro; y <= ro; y++) for (let x = -ro; x <= ro; x++) { const d = x*x + y*y; if (d <= ro*ro && d >= ri*ri) set(cx + x, cy + y, c); } };
  const shade = (c, f) => rgba(Math.round(((c>>>24)&255)*f), Math.round(((c>>>16)&255)*f), Math.round(((c>>>8)&255)*f), c&255);
  const line = (x1, y1, x2, y2, c) => { const n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)); if (n === 0) { set(x1, y1, c); return; } for (let i = 0; i <= n; i++) set(x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n, c); };
  const bevel = (x, y, w, h, base, lo, hi) => {
    fill(x, y, w, h, base);
    for (let i = 0; i < w; i++) { set(x + i, y, lo); set(x + i, y + h - 1, hi); }
    for (let j = 0; j < h; j++) { set(x, y + j, lo); set(x + w - 1, y + j, hi); }
  };
  const tri = (pts, fn) => {                                  // scanline triangle fill
    const ys = pts.map(p => p[1]); const y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y <= y1; y++) {
      const xs = [];
      for (let i = 0; i < 3; i++) { const a = pts[i], b = pts[(i + 1) % 3]; if ((y >= Math.min(a[1], b[1])) && (y < Math.max(a[1], b[1]))) xs.push(a[0] + (b[0] - a[0]) * ((y - a[1]) / (b[1] - a[1]))); }
      if (xs.length >= 2) { const xl = Math.round(Math.min(...xs)), xr = Math.round(Math.max(...xs)); for (let x = xl; x <= xr; x++) set(x, y, fn(x, y)); }
    }
  };
  const quad = (p, fn) => { tri([p[0], p[1], p[2]], fn); tri([p[0], p[2], p[3]], fn); };

  // Palette
  const STONE = rgba(0x6e,0x64,0x58), STONEl = rgba(0x8a,0x7e,0x6f), STONEd = rgba(0x3c,0x36,0x2e), STONEv = rgba(0x5a,0x52,0x47);
  const RF = rgba(0x4a,0x55,0x63), RL = rgba(0x66,0x73,0x84), RR = rgba(0x30,0x38,0x43), RDK = rgba(0x20,0x26,0x2f), RLT = rgba(0x7e,0x8c,0x9e), RIDGE = rgba(0x92,0xa0,0xb2), EAVE = rgba(0x12,0x15,0x1a);
  const WOOD = rgba(0x4a,0x3a,0x28), WOODl = rgba(0x5f,0x4c,0x36), WOODd = rgba(0x2c,0x22,0x16);
  const DOOR = rgba(0x4a,0x33,0x20), DOORl = rgba(0x5f,0x44,0x2b), DOORd = rgba(0x29,0x1b,0x10);
  const IRON = rgba(0x6b,0x6b,0x73), IRONl = rgba(0x93,0x93,0x9c);
  const WIN  = rgba(0x12,0x0e,0x0a), GLOW = rgba(0xff,0x8a,0x3a), GLOWb = rgba(0xff,0xc8,0x6a);
  const CHIM = rgba(0x4e,0x4e,0x57), CHIMl = rgba(0x64,0x64,0x6e), CHIMd = rgba(0x2c,0x2c,0x33);
  const BLADE = rgba(0xcf,0xcf,0xd8);

  // ===== Front wall (stone blocks) =====
  const wallL = 40, wallR = 248, wallTop = 120, wallBot = 212;
  for (let y = wallTop; y < wallBot; y += 15) {
    const ri = Math.floor((y - wallTop) / 15), off = (ri % 2) * 12;
    for (let x = wallL - off; x < wallR; x += 24) {
      const bx = Math.max(wallL, x), bxe = Math.min(wallR, x + 22), bye = Math.min(wallBot, y + 13);
      if (bxe - bx <= 1 || bye - y <= 1) continue;
      const v = (Math.abs(Math.round(x) * 7 + ri * 13)) % 5;
      bevel(bx, y, bxe - bx, bye - y, v === 0 ? STONEl : (v === 1 ? STONEv : STONE), STONEl, STONEd);
    }
  }

  // ===== Hipped roof: three lit/shadowed planes you look down onto =====
  const A = [8, 86], B = [92, 26], C = [196, 26], D = [280, 86], E = [244, 128], F = [44, 128];
  quad([B, C, E, F], (x, y) => {                        // FRONT plane — horizontal shingle courses
    const k = (y - 26) % 6;
    let c = k === 0 ? RDK : (k === 1 ? RLT : RF);
    if (((x + Math.floor((y - 26) / 6) * 5) % 14) === 0) c = RDK;
    return c;
  });
  tri([A, B, F], (x, y) => (((x * 2 - y) % 9 + 9) % 9) < 1 ? shade(RL, 0.82) : RL);   // LEFT plane (lit)
  tri([C, D, E], (x, y) => (((x * 2 + y) % 9 + 9) % 9) < 1 ? shade(RR, 0.82) : RR);   // RIGHT plane (shadow)
  line(B[0], B[1], C[0], C[1], RIDGE);                 // ridge
  line(A[0], A[1], B[0], B[1], RLT);                   // lit left hip
  line(C[0], C[1], D[0], D[1], RDK);                   // shadow right hip
  line(B[0], B[1], F[0], F[1], shade(RF, 0.7));        // left crease
  line(C[0], C[1], E[0], E[1], shade(RF, 0.7));        // right crease
  line(A[0], A[1], F[0], F[1], RDK);                   // left eave
  line(D[0], D[1], E[0], E[1], RDK);                   // right eave
  line(F[0], F[1], E[0], E[1], RLT);                   // bright front eave (cut shingles)

  // ===== Chimney poking through the right slope =====
  bevel(206, 6, 22, 64, CHIM, CHIMl, CHIMd);
  fill(203, 6, 28, 7, CHIMd);
  disc(217, 12, 6, GLOW); disc(217, 12, 3, GLOWb);

  // ===== Depth pass: overhang shadow + corner AO + ground contact =====
  const mul = (x, y, f) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const c = img.getPixelColor(x, y); if ((c & 255) === 0) return; img.setPixelColor(shade(c, f), x, y); };
  for (let x = wallL; x < wallR; x++) for (let d = 0; d < 22; d++) mul(x, 129 + d, 0.46 + 0.54 * (d / 22));         // roof shadow down the wall
  for (let y = wallTop + 2; y < wallBot; y++) { for (let d = 0; d < 10; d++) { const f = 0.68 + 0.032 * d; mul(wallL + d, y, f); mul(wallR - 1 - d, y, f); } }
  for (let x = wallL - 4; x < wallR + 4; x++) for (let d = 0; d < 6; d++) mul(x, wallBot - 1 - d, 0.72 + 0.046 * d); // ground contact

  // ===== Forge-lit windows =====
  const winW = 30, winH = 26, winY = 140;
  [wallL + 18, wallR - 18 - winW].forEach((wx) => {
    bevel(wx - 4, winY - 4, winW + 8, winH + 8, WOOD, WOODl, WOODd);
    fill(wx, winY, winW, winH, WIN);
    fill(wx, winY + winH / 2, winW, winH / 2, GLOW);
    fill(wx + 3, winY + winH / 2 + 3, winW - 6, winH / 2 - 6, GLOWb);
    fill(wx + winW / 2 - 1, winY, 2, winH, WOODd);
    fill(wx, winY + winH / 2 - 1, winW, 2, WOODd);
  });

  // ===== Raised stone base =====
  fill(wallL - 2, wallBot - 1, wallR - wallL + 4, 3, STONEl);
  for (let x = wallL - 2; x < wallR; x += 22) bevel(x, wallBot + 2, 20, 10, STONEd, STONE, shade(STONEd, 0.6));

  // ===== Studded plank door =====
  const dw = 50, dh = 54, dx = Math.round(W / 2 - dw / 2), dy = wallBot - dh;
  bevel(dx - 5, dy - 5, dw + 10, dh + 10, WOOD, WOODl, WOODd);
  fill(dx, dy, dw, dh, DOOR);
  for (let x = dx + 9; x < dx + dw - 2; x += 12) fill(x, dy, 2, dh, DOORd);
  for (let x = dx + 5; x < dx + dw - 4; x += 12) fill(x, dy + 3, 1, dh - 5, DOORl);
  fill(dx, dy, dw, 3, shade(DOOR, 0.4));                // lintel recess shadow
  fill(dx, dy + 13, dw, 4, IRON); fill(dx, dy + dh - 14, dw, 4, IRON);
  for (let x = dx + 8; x < dx + dw - 5; x += 12) { fill(x, dy + 14, 3, 2, IRONl); fill(x, dy + dh - 13, 3, 2, IRONl); }
  ring(dx + dw - 10, dy + dh / 2, 4, 2, IRON);

  // ===== Hanging sword sign (between window and door) =====
  const sgx = 92, sgy = 150;
  fill(sgx + 10, sgy - 4, 2, 5, IRON); fill(sgx, sgy - 4, 22, 2, IRON);
  bevel(sgx, sgy, 22, 16, WOOD, WOODl, WOODd);
  fill(sgx + 10, sgy + 3, 2, 9, BLADE); fill(sgx + 6, sgy + 10, 10, 2, IRON);

  await img.write(path.join(OUT, outName));
  console.log(`  ${outName}`);
}

console.log('Generating building sprites…');
await buildSprite('house.png',          'building_store.png');
await buildSprite('housealternate.png', 'building_inn.png');
await buildSprite('housealternate.png', 'building_tailor.png');
await buildTownHall('house.png',        'building_townhall.png');
await buildArmoryArt('building_armory.png');
console.log('Done.');
