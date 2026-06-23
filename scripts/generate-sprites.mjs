import { Jimp } from 'jimp';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '../client/src/assets/sprites');
const BASE = 'https://raw.githubusercontent.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator/master/spritesheets';

const CHARACTERS = [
  {
    name: 'char_1',
    label: 'Warrior',
    layers: [
      `${BASE}/body/bodies/male/walk.png`,
      `${BASE}/head/heads/human/male/walk.png`,
      `${BASE}/hair/long/adult/walk.png`,
      `${BASE}/torso/clothes/longsleeve/longsleeve/male/walk.png`,
    ],
  },
  {
    name: 'char_2',
    label: 'Rogue',
    layers: [
      `${BASE}/body/bodies/female/walk.png`,
      `${BASE}/head/heads/human/female/walk.png`,
      `${BASE}/hair/pixie/adult/walk.png`,
      `${BASE}/torso/armour/leather/female/walk.png`,
    ],
  },
  {
    name: 'char_3',
    label: 'Brute',
    layers: [
      `${BASE}/body/bodies/muscular/walk.png`,
      `${BASE}/head/heads/human/male/walk.png`,
      `${BASE}/hair/buzzcut/adult/walk.png`,
      `${BASE}/torso/armour/leather/male/walk.png`,
    ],
  },
  {
    name: 'char_4',
    label: 'Mage',
    layers: [
      `${BASE}/body/bodies/female/walk.png`,
      `${BASE}/head/heads/human/female/walk.png`,
      `${BASE}/hair/ponytail/adult/fg/walk.png`,
      `${BASE}/torso/clothes/longsleeve/longsleeve/female/walk.png`,
    ],
  },
];

function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        return download(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function buildCharacter({ name, label, layers }) {
  console.log(`\nBuilding ${name} (${label})...`);
  let base = null;

  for (const url of layers) {
    const shortPath = url.split('/').slice(-4).join('/');
    let buf;
    try {
      buf = await download(url);
    } catch (e) {
      console.warn(`  SKIP ${shortPath} — ${e.message}`);
      continue;
    }
    try {
      const img = await Jimp.fromBuffer(buf);
      if (!base) {
        base = img;
      } else {
        base.composite(img, 0, 0);
      }
      console.log(`  OK   ${shortPath}`);
    } catch (e) {
      console.warn(`  ERR  ${shortPath} — ${e.message}`);
    }
  }

  if (!base) throw new Error(`No layers loaded for ${name}`);
  const outPath = path.join(OUT_DIR, `${name}.png`);
  await base.write(outPath);
  console.log(`  => ${outPath}`);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const char of CHARACTERS) {
  try {
    await buildCharacter(char);
  } catch (e) {
    console.error(`FAILED ${char.name}: ${e.message}`);
  }
}

console.log('\nAll done!');
