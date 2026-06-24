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

console.log('Generating building sprites…');
await buildSprite('house.png',          'building_store.png');
await buildSprite('housealternate.png', 'building_inn.png');
await buildSprite('housealternate.png', 'building_tailor.png');
await buildTownHall('house.png',        'building_townhall.png');
console.log('Done.');
