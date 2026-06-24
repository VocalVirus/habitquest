import { Jimp } from 'jimp';

const src = 'C:/Users/tribu/OneDrive/Desktop/Productivity Video Game/client/public/tiles/house.png';
const out = 'C:/Users/tribu/AppData/Local/Temp/claude/C--Users-tribu-OneDrive-Desktop-Productivity-Video-Game/d1973040-5f2a-4f8e-b801-23decefc9825/scratchpad';

const img = await Jimp.read(src);
console.log(`house.png: ${img.width}x${img.height}`);

// Try 3 columns of 96px (3 building variants side by side?)
for (let i = 0; i < 3; i++) {
  const crop = img.clone().crop({ x: i * 96, y: 0, w: 96, h: 224 });
  await crop.write(`${out}/house_col${i}.png`);
}
// Try rows: top half vs bottom half
const topHalf = img.clone().crop({ x: 0, y: 0, w: 288, h: 112 });
await topHalf.write(`${out}/house_tophalf.png`);
const botHalf = img.clone().crop({ x: 0, y: 112, w: 288, h: 112 });
await botHalf.write(`${out}/house_bothalf.png`);

// housealternate
const alt = await Jimp.read('C:/Users/tribu/OneDrive/Desktop/Productivity Video Game/client/public/tiles/housealternate.png');
console.log(`housealternate.png: ${alt.width}x${alt.height}`);
for (let i = 0; i < 3; i++) {
  const crop = alt.clone().crop({ x: i * 96, y: 0, w: 96, h: 224 });
  await crop.write(`${out}/housealternate_col${i}.png`);
}

console.log('Done - crops saved');
