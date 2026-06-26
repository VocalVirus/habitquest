import Phaser from 'phaser';
import { io } from 'socket.io-client';
import { Textbox } from '../ui/Textbox.js';

// Flavor text shown in the door textbox before entering each building.
const DOOR_FLAVOR = {
  store:    'You push open the door to the General Store. A bell jingles overhead.',
  inn:      'The door to The Sleepy Bear Inn creaks open. Warmth spills out.',
  tailor:   'You step toward the Tailor Shop. The smell of fresh cloth greets you.',
  armory:   'The heavy Armory door swings inward. You hear a hammer ringing on steel.',
  townhall: 'The grand doors of the Town Hall open before you.',
};

const BASE_SPEED = 120;
const MAX_SPEED  = 280;
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
const FRAME_W    = 64;
const FRAME_H    = 64;
const TILE       = 32;
const COLS       = 60;
const ROWS       = 45;
const WALK_DIRS   = ['up', 'left', 'down', 'right'];
const REMOTE_SPEED = 200;
const DIR_VEC      = { up: [0, -1], left: [-1, 0], down: [0, 1], right: [1, 0] };

// Buildings use composited sprites in /buildings/. W/H must match those images.
// H=224: top 128px = roof from above (north), bottom 96px = facade/door (south)
const BUILDINGS = [
  { id: 'store',    label: 'General Store',       worldX: 15 * TILE, worldY: 13 * TILE, texture: 'building_store',    W: 288, H: 224 },
  { id: 'inn',      label: 'The Sleepy Bear Inn', worldX: 37 * TILE, worldY: 13 * TILE, texture: 'building_inn',      W: 288, H: 224 },
  { id: 'tailor',   label: 'Tailor Shop',         worldX: 15 * TILE, worldY: 29 * TILE, texture: 'building_tailor',   W: 288, H: 224 },
  { id: 'armory',   label: 'Armory',              worldX: 33 * TILE, worldY: 29 * TILE, texture: 'building_armory',   W: 288, H: 224 },
  // Town Hall centred on vertical path (cols 29-30): worldX = 29.5*32 - 576/2 = 640
  { id: 'townhall', label: 'Town Hall',           worldX: 20 * TILE, worldY:  3 * TILE, texture: 'building_townhall', W: 576, H: 224 },
];

function isExcluded(col, row) {
  if (col >= 27 && col <= 32) return true;          // vertical path + buffer
  if (row >= 20 && row <= 25) return true;           // horizontal path + buffer
  // Buildings now 224px tall (7 tiles): worldY/32 → worldY/32+6
  if (col >= 15 && col <= 23 && row >= 13 && row <= 19) return true; // Store
  if (col >= 37 && col <= 45 && row >= 13 && row <= 19) return true; // Inn
  if (col >= 15 && col <= 23 && row >= 29 && row <= 35) return true; // Tailor
  if (col >= 33 && col <= 41 && row >= 29 && row <= 35) return true; // Armory
  if (col >= 20 && col <= 37 && row >=  3 && row <=  9) return true; // Town Hall
  if (col >= 43 && col <= 59 && row >= 29 && row <= 44) return true; // SE pond
  return false;
}

// Jittered scatter: start from a loose grid, then nudge each tree, drop some,
// and occasionally add a neighbour so the forest reads as natural clusters and
// clearings rather than a perfect lattice.
const TREE_POSITIONS = (() => {
  const out = [];
  const taken = new Set();
  const place = (col, row) => {
    if (col < 1 || row < 1 || col >= COLS - 1 || row >= ROWS - 1) return;
    if (isExcluded(col, row)) return;
    const key = `${col},${row}`;
    if (taken.has(key)) return;
    taken.add(key);
    out.push({ col, row });
  };
  for (let gx = 0; gx < 11; gx++) {
    for (let gy = 0; gy < 8; gy++) {
      if (Math.random() < 0.25) continue;                 // clearings
      const col = gx * 5 + 3 + (Math.floor(Math.random() * 5) - 2); // ±2 jitter
      const row = gy * 5 + 3 + (Math.floor(Math.random() * 5) - 2);
      place(col, row);
      if (Math.random() < 0.3) {                          // cluster buddy
        place(col + 1 + Math.floor(Math.random() * 2), row + Math.floor(Math.random() * 2));
      }
    }
  }
  return out;
})();

export class TownScene extends Phaser.Scene {
  constructor() {
    super('TownScene');
    this.otherPlayers  = {};
    this.doorZones     = [];
    this.activeDoor    = null;
    this.chatActive    = false;
    this.activeBubbles = [];
    this.joystick      = { active: false, dx: 0, dy: 0, baseX: 0, baseY: 0, pointerId: null };
  }

  init(data) {
    this.returnData   = data || null;
    this.sessionItems = data?.sessionItems || [];
  }

  preload() {
    const { character } = this.registry.get('context');
    const sprite = character?.sprite || 'char_1';

    this.load.spritesheet('player', `/sprites/${sprite}.png`, { frameWidth: FRAME_W, frameHeight: FRAME_H });
    ['char_1','char_2','char_3','char_4'].forEach((k) =>
      this.load.spritesheet(k, `/sprites/${k}.png`, { frameWidth: FRAME_W, frameHeight: FRAME_H })
    );
    this.load.spritesheet('terrain_grass', '/tiles/grass.png', { frameWidth: TILE, frameHeight: TILE });
    this.load.spritesheet('terrain_dirt',  '/tiles/dirt.png',   { frameWidth: TILE, frameHeight: TILE });
    this.load.spritesheet('terrain_water', '/tiles/water.png',  { frameWidth: TILE, frameHeight: TILE });
    this.load.spritesheet('decor_rock',    '/tiles/rock.png',   { frameWidth: TILE, frameHeight: TILE });
    this.load.image('tree_oak_top',  '/tiles/tree_oak_top.png');
    this.load.image('tree_pine_top', '/tiles/tree_pine_top.png');
    this.load.image('tree_stem',     '/tiles/tree_stem.png');
    this.load.image('building_store',    '/buildings/building_store.png');
    this.load.image('building_inn',      '/buildings/building_inn.png');
    this.load.image('building_tailor',   '/buildings/building_tailor.png');
    this.load.image('building_armory',   '/buildings/building_armory.png');
    this.load.image('building_townhall', '/buildings/building_townhall.png');
  }

  create() {
    const { user, token, character } = this.registry.get('context');
    // This Scene instance is reused across building entries/exits — clear any
    // stale multiplayer state so we don't leave ghost sprites behind.
    this.otherPlayers  = {};
    this.activeBubbles = [];
    this.activeDoor    = null;
    const worldW = COLS * TILE;
    const worldH = ROWS * TILE;

    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBounds(0, 0, worldW, worldH);

    this._buildGround();
    this._buildPond();
    this._buildPaths();
    this._buildBuildings();
    this._buildTrees();
    this._buildDecorations();
    this._buildAnims();

    const startX = this.returnData?.returnX ?? 29 * TILE + 16;
    const startY = this.returnData?.returnY ?? 22 * TILE + 16;

    this.player = this.physics.add.sprite(startX, startY, 'player', 18);
    this.player.setCollideWorldBounds(true).setDepth(5);
    this.cameras.main.startFollow(this.player);
    this.lastDir = this.returnData?.returnDir || 'down';

    this.normalSpeed = Math.round(BASE_SPEED + ((character?.strength || 0) / 100) * (MAX_SPEED - BASE_SPEED));
    this.speed = this.normalSpeed;

    if (this.sessionItems.includes('speed_potion')) {
      this.speed = this.normalSpeed * 2;
      this.time.delayedCall(60000, () => { this.speed = this.normalSpeed; });
      this.sessionItems = this.sessionItems.filter(i => i !== 'speed_potion');
    }

    this.physics.add.collider(this.player, this.trunkGroup);
    this.physics.add.collider(this.player, this.buildingWalls);
    this.physics.add.collider(this.player, this.pondWall);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd    = this.input.keyboard.addKeys({ up: 'W', left: 'A', down: 'S', right: 'D' });
    this.input.keyboard.on('keydown-E', () => this._onInteract());

    this.textbox  = new Textbox(this);
    this.doorHint = this.sys.game.device.input.touch ? 'Tap here to enter' : 'Press E to enter';

    this._setupSocket(user, token, character);
    this._setupJoystick();
    this.lastEmit  = 0;
    this.wasMoving = false;

    this._onChatSend   = ({ text }) => this.socket?.emit('chat:message', { text });
    this._onChatActive = (v) => {
      this.chatActive = v;
    };
    this.game.events.on('chat:send',   this._onChatSend);
    this.game.events.on('chat:active', this._onChatActive);

    // Tear down the socket + global listeners when this scene stops (e.g. when
    // entering a building) to avoid a leaked second connection that spawns
    // duplicate "ghost" players on return.
    this.events.once('shutdown', () => this._teardown());
  }

  _teardown() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.game.events.off('chat:send',   this._onChatSend);
    this.game.events.off('chat:active', this._onChatActive);
    Object.values(this.otherPlayers).forEach((op) => {
      op.sprite?.destroy();
      op.label?.destroy();
    });
    this.otherPlayers = {};
    this.activeBubbles.forEach(({ bubble }) => bubble?.destroy());
    this.activeBubbles = [];
    this.textbox?.destroy();
    this.textbox = null;
  }

  _buildGround() {
    const worldW = COLS * TILE, worldH = ROWS * TILE;
    // Frames 15-17 of grass.png are OPAQUE textured grass tiles (15=dense blades,
    // 16=medium, 17=sparse) — the actual ground fill, in the LPC art style.
    // Weight toward the sparser tiles with occasional denser ones for a natural,
    // non-repetitive lawn. (One spritesheet → Phaser batches these efficiently.)
    const pickGrass = () => { const r = Math.random(); return r < 0.45 ? 17 : r < 0.8 ? 16 : 15; };
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        this.add.image(x * TILE + 16, y * TILE + 16, 'terrain_grass', pickGrass()).setDepth(0);
      }
    }

    // Soft large-scale tone blobs for gentle colour variation across the field.
    for (let i = 0; i < 14; i++) {
      const shade = Phaser.Math.RND.pick([0x2a6e30, 0x49a64f, 0x5fb35a]);
      this.add.ellipse(
        Phaser.Math.Between(0, worldW), Phaser.Math.Between(0, worldH),
        Phaser.Math.Between(120, 230), Phaser.Math.Between(90, 170),
        shade, 0.09,
      ).setDepth(0);
    }
  }

  _buildPond() {
    const C1 = 44, C2 = 58, R1 = 30, R2 = 43;

    // Open-water animation lives in the bottom row of water.png (frames 15-17).
    if (!this.anims.exists('water_shimmer')) {
      this.anims.create({
        key: 'water_shimmer',
        frames: this.anims.generateFrameNumbers('terrain_water', { frames: [15, 16, 17] }),
        frameRate: 4, repeat: -1,
      });
    }

    // Natural rocky shoreline: frames 6-14 form a 3x3 autotile (corners/edges/
    // centre) with a dirt bank whose outer corners are transparent, so the edge
    // blends into the surrounding grass instead of a straight pool deck. The
    // interior is animated open water.
    const edgeFrame = (c, r) => {
      const top = r === R1, bot = r === R2, left = c === C1, right = c === C2;
      if (top && left)  return 6;
      if (top && right) return 8;
      if (bot && left)  return 12;
      if (bot && right) return 14;
      if (top)   return 7;
      if (bot)   return 13;
      if (left)  return 9;
      if (right) return 11;
      return null;            // interior → animated water
    };

    for (let c = C1; c <= C2; c++) {
      for (let r = R1; r <= R2; r++) {
        const x = c * TILE + 16, y = r * TILE + 16;
        const ef = edgeFrame(c, r);
        if (ef === null) {
          const w = this.add.sprite(x, y, 'terrain_water', 15).setDepth(1);
          w.play('water_shimmer');
          w.anims.setProgress(Math.random());   // stagger the shimmer
        } else {
          this.add.image(x, y, 'terrain_water', ef).setDepth(1);
        }
      }
    }

    // A few rocks dotted on the grass just outside the visible (N & W) banks.
    const shore = [];
    for (let c = C1; c <= C2; c++) shore.push([c, R1 - 1]);
    for (let r = R1; r <= R2; r++) shore.push([C1 - 1, r]);
    Phaser.Utils.Array.Shuffle(shore).slice(0, 5).forEach(([c, r]) => {
      this.add.image(c * TILE + 16, r * TILE + 16, 'decor_rock', Phaser.Math.Between(0, 1)).setDepth(2);
    });

    const pW = (C2 - C1 + 1) * TILE;
    const pH = (R2 - R1 + 1) * TILE;
    const cx = C1 * TILE + pW / 2;
    const cy = R1 * TILE + pH / 2;
    // Invisible collision wall
    this.pondWall = this.add.rectangle(cx, cy, pW, pH, 0x000000, 0);
    this.physics.add.existing(this.pondWall, true);
  }

  _buildPaths() {
    const dirt = (c, r) => this.add.image(c * TILE + 16, r * TILE + 16, 'terrain_dirt', 4).setDepth(1);
    // Main cross
    for (let x = 0; x < COLS; x++) { dirt(x, 22); dirt(x, 23); }
    for (let y = 0; y < ROWS; y++) { dirt(29, y); dirt(30, y); }
    // Store/Inn: worldY=416, H=224 → bottom edge row 20 → path rows 20-21 to horizontal
    for (let r = 20; r <= 21; r++) { dirt(19, r); dirt(20, r); }
    for (let r = 20; r <= 21; r++) { dirt(41, r); dirt(42, r); }
    // Tailor: worldY=928, H=224 → bottom edge row 36 → path rows 24-36 south from horizontal
    for (let r = 24; r <= 36; r++) { dirt(19, r); dirt(20, r); }
    // Armory: worldX=33*TILE, door at col 37-38 → path rows 24-36 south from horizontal
    for (let r = 24; r <= 36; r++) { dirt(37, r); dirt(38, r); }
  }

  _buildBuildings() {
    this.buildingWalls = this.physics.add.staticGroup();

    BUILDINGS.forEach((b) => {
      this.add.image(b.worldX, b.worldY, b.texture).setOrigin(0, 0).setDepth(3);

      this.add.text(b.worldX + b.W / 2, b.worldY - 14, b.label, {
        fontSize: '11px', color: '#ffd700', fontFamily: 'monospace',
        backgroundColor: '#000000bb', padding: { x: 6, y: 3 },
      }).setOrigin(0.5).setDepth(20);

      // Collision covers building body; leave bottom 32px open for door approach
      const wallRect = this.add.rectangle(
        b.worldX + b.W / 2,
        b.worldY + (b.H - 32) / 2,
        b.W, b.H - 32,
        0x000000, 0
      );
      this.physics.add.existing(wallRect, true);
      this.buildingWalls.add(wallRect);

      const doorX = b.worldX + b.W / 2;
      const doorY = b.worldY + b.H + 4;
      // Approach band across the building's south face — walking up to the front
      // anywhere triggers the prompt (the old tight point was easy to miss).
      this.doorZones.push({
        id: b.id, label: b.label,
        x1: b.worldX + 8, x2: b.worldX + b.W - 8,
        y1: b.worldY + b.H - 12, y2: b.worldY + b.H + 60,
        returnX: doorX, returnY: doorY + 48,
      });

      if (b.id === 'armory') {
        const baseY = b.worldY + b.H - 16;
        this._addTorch(doorX - 72, baseY);
        this._addTorch(doorX + 72, baseY);
      }
    });
  }

  _addTorch(x, y) {
    this.add.rectangle(x, y, 6, 20, 0x3b2a17).setDepth(4);
    const glow  = this.add.circle(x, y - 14, 17, 0xff7b29, 0.22).setDepth(4);
    const flame = this.add.ellipse(x, y - 14, 11, 17, 0xffad33).setDepth(4);
    this.tweens.add({
      targets: [flame, glow],
      scaleX: 1.15, scaleY: 1.28,
      duration: 360, yoyo: true, repeat: -1, ease: 'Sine.inOut',
    });
  }

  _buildTrees() {
    // Each tree = a stem (drawn below the player, with a small trunk collider)
    // and a canopy (drawn above the player, so you can walk behind it).
    this.trunkGroup = this.physics.add.staticGroup();
    TREE_POSITIONS.forEach(({ col, row }) => {
      const x     = col * TILE + 16;
      const baseY = row * TILE + TILE - 4;        // trunk sits near tile bottom
      const isPine = (col * 3 + row) % 3 === 0;
      const canopy = isPine ? 'tree_pine_top' : 'tree_oak_top';

      this.add.image(x, baseY, 'tree_stem').setOrigin(0.5, 1).setDepth(2);
      this.add.image(x, baseY - 45, canopy).setOrigin(0.5, 1).setDepth(10);

      // Collide only with the trunk, not the whole canopy footprint.
      const trunk = this.add.rectangle(x, baseY - 12, 18, 20, 0x000000, 0);
      this.physics.add.existing(trunk, true);
      this.trunkGroup.add(trunk);
    });
  }

  _buildDecorations() {
    // Larger props (bushes, grass clumps, rocks) layered over the tuft-textured
    // ground. isExcluded() keeps them off paths, buildings, and the pond.
    const TARGET = 65;
    let placed = 0, attempts = 0;
    while (placed < TARGET && attempts < TARGET * 6) {
      attempts++;
      const col = Phaser.Math.Between(0, COLS - 1);
      const row = Phaser.Math.Between(0, ROWS - 1);
      if (isExcluded(col, row)) continue;

      const x = col * TILE + 16, y = row * TILE + 16;
      const roll = Math.random();
      if      (roll < 0.5)  this.add.image(x, y, 'terrain_grass', 0).setDepth(2);            // leafy bush
      else if (roll < 0.72) this.add.image(x, y, 'terrain_grass', 8).setDepth(2);            // grass clump
      else                  this.add.image(x, y, 'decor_rock', Phaser.Math.Between(0, 1)).setDepth(2); // rock
      placed++;
    }

    // Wildflower specks in small clusters for pops of colour.
    const FLOWERS = [0xffffff, 0xffe34d, 0xff6b9d, 0xb06bff];
    for (let i = 0; i < 34; i++) {
      const col = Phaser.Math.Between(0, COLS - 1);
      const row = Phaser.Math.Between(0, ROWS - 1);
      if (isExcluded(col, row)) continue;
      const cx = col * TILE + 16, cy = row * TILE + 16;
      const color = Phaser.Math.RND.pick(FLOWERS);
      for (let k = 0, n = Phaser.Math.Between(2, 4); k < n; k++) {
        this.add.circle(cx + Phaser.Math.Between(-9, 9), cy + Phaser.Math.Between(-9, 9), 2, color).setDepth(1);
      }
    }
  }

  _buildAnims() {
    ['player','char_1','char_2','char_3','char_4'].forEach((key) => {
      WALK_DIRS.forEach((dir, row) => {
        const animKey = `${key}_walk_${dir}`;
        if (!this.anims.exists(animKey)) {
          this.anims.create({
            key: animKey,
            frames: this.anims.generateFrameNumbers(key, { start: row * 9, end: row * 9 + 8 }),
            frameRate: 9, repeat: -1,
          });
        }
      });
    });
  }

  // E key: enter the building whose door textbox is currently showing.
  _onInteract() {
    if (this.activeDoor) this._enterDoor(this.activeDoor);
  }

  _enterDoor(door) {
    this.scene.start('InteriorScene', {
      buildingId:    door.id,
      buildingLabel: door.label,
      returnX:       door.returnX,
      returnY:       door.returnY,
      sessionItems:  [...this.sessionItems],
    });
  }

  _setupSocket(user, token, character) {
    this.socket = io(SOCKET_URL, { auth: { token } });
    this.socket.on('connect', () => {
      this.socket.emit('player:join', {
        username: user.username,
        x: this.player.x, y: this.player.y,
        mapId: 'town',
        sprite: character?.sprite || 'char_1',
      });
    });
    this.socket.on('players:current', (ps) => ps.forEach((p) => this._addOtherPlayer(p)));
    this.socket.on('player:joined',   (p)  => this._addOtherPlayer(p));
    this.socket.on('player:moved',  ({ socketId, x, y, dir, vx, vy }) => {
      const op = this.otherPlayers[socketId];
      if (!op) return;
      op.targetX = x;
      op.targetY = y;
      op.lastUpdateTime = this.time.now;
      op.velX = (vx ?? (DIR_VEC[dir]?.[0] ?? 0)) * REMOTE_SPEED;
      op.velY = (vy ?? (DIR_VEC[dir]?.[1] ?? 0)) * REMOTE_SPEED;
      if (dir) op.sprite.anims.play(`${op.spriteKey}_walk_${dir}`, true);
    });
    this.socket.on('player:stopped', ({ socketId, dir }) => {
      const op = this.otherPlayers[socketId];
      if (!op) return;
      op.velX = 0;
      op.velY = 0;
      op.sprite.anims.stop();
      op.sprite.setFrame(WALK_DIRS.indexOf(dir || 'down') * 9);
    });
    this.socket.on('player:left', ({ socketId }) => {
      const op = this.otherPlayers[socketId];
      if (!op) return;
      op.sprite.destroy();
      op.label.destroy();
      delete this.otherPlayers[socketId];
    });

    this.socket.on('chat:message', (msg) => {
      this.game.events.emit('chat:received', msg);
      this._showBubble(msg);
    });
  }

  _showBubble({ username, text }) {
    const { user } = this.registry.get('context');
    let target = null;
    if (user.username === username) {
      target = this.player;
    } else {
      const entry = Object.values(this.otherPlayers).find((p) => p.label.text === username);
      if (entry) target = entry.sprite;
    }
    if (!target) return;

    const shortened = text.length > 60 ? text.slice(0, 57) + '…' : text;
    const bubble = this.add.text(target.x, target.y - 72, shortened, {
      fontSize: '10px',
      color: '#ffffff',
      fontFamily: 'monospace',
      backgroundColor: '#000000dd',
      padding: { x: 6, y: 4 },
      wordWrap: { width: 170 },
    }).setOrigin(0.5, 1).setDepth(100);

    this.activeBubbles.push({ bubble, getPos: () => target.active ? { x: target.x, y: target.y } : null });

    this.time.delayedCall(3500, () => {
      this.tweens.add({
        targets: bubble,
        alpha: 0,
        duration: 500,
        onComplete: () => bubble.destroy(),
      });
    });
  }

  _addOtherPlayer({ socketId, username, x, y, sprite: spriteKey }) {
    const key = ['char_1','char_2','char_3','char_4'].includes(spriteKey) ? spriteKey : 'char_1';
    const sprite = this.add.sprite(x, y, key, 18).setDepth(5);
    const label  = this.add.text(x, y - 36, username, {
      fontSize: '10px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(20);
    this.otherPlayers[socketId] = { sprite, label, spriteKey: key, targetX: x, targetY: y, velX: 0, velY: 0, lastUpdateTime: 0 };
  }

  update(time) {
    const LERP = 0.3;
    Object.values(this.otherPlayers).forEach((op) => {
      const dt = Math.min((this.time.now - op.lastUpdateTime) / 1000, 0.15);
      const predX = op.targetX + op.velX * dt;
      const predY = op.targetY + op.velY * dt;
      op.sprite.x = Phaser.Math.Linear(op.sprite.x, predX, LERP);
      op.sprite.y = Phaser.Math.Linear(op.sprite.y, predY, LERP);
      op.label.setPosition(op.sprite.x, op.sprite.y - 36);
    });

    // Track speech bubble positions
    this.activeBubbles = this.activeBubbles.filter(({ bubble, getPos }) => {
      if (!bubble.active) return false;
      const pos = getPos();
      if (pos) bubble.setPosition(pos.x, pos.y - 72);
      return true;
    });

    // Freeze movement while chat input is focused
    if (this.chatActive) {
      this.player.setVelocity(0, 0);
      if (this.wasMoving) {
        this.player.anims.stop();
        this.player.setFrame(WALK_DIRS.indexOf(this.lastDir) * 9);
        this.wasMoving = false;
        this.socket?.emit('player:stop', { dir: this.lastDir });
      }
      return;
    }

    const vel = { x: 0, y: 0 };
    if      (this.cursors.left.isDown  || this.wasd.left.isDown)  vel.x = -this.speed;
    else if (this.cursors.right.isDown || this.wasd.right.isDown) vel.x =  this.speed;
    if      (this.cursors.up.isDown    || this.wasd.up.isDown)    vel.y = -this.speed;
    else if (this.cursors.down.isDown  || this.wasd.down.isDown)  vel.y =  this.speed;

    if (this.joystick?.active) {
      const DEAD = 0.2;
      if (Math.abs(this.joystick.dx) > DEAD) vel.x = this.joystick.dx > 0 ? this.speed : -this.speed;
      if (Math.abs(this.joystick.dy) > DEAD) vel.y = this.joystick.dy > 0 ? this.speed : -this.speed;
    }

    const moving    = vel.x !== 0 || vel.y !== 0;
    const prevMoved = this.wasMoving;
    if (moving) {
      if      (vel.x < 0) this.lastDir = 'left';
      else if (vel.x > 0) this.lastDir = 'right';
      else if (vel.y < 0) this.lastDir = 'up';
      else                this.lastDir = 'down';
      this.player.anims.play(`player_walk_${this.lastDir}`, true);
    } else if (prevMoved) {
      this.player.anims.stop();
      this.player.setFrame(WALK_DIRS.indexOf(this.lastDir) * 9);
    }
    this.wasMoving = moving;
    this.player.setVelocity(vel.x, vel.y);

    // Door proximity — inside any building's south-face approach band
    let nearDoor = null;
    const px = this.player.x, py = this.player.y;
    this.doorZones.forEach((door) => {
      if (px >= door.x1 && px <= door.x2 && py >= door.y1 && py <= door.y2) nearDoor = door;
    });
    if (nearDoor !== this.activeDoor) {
      this.activeDoor = nearDoor;
      if (nearDoor) {
        this.textbox.show(DOOR_FLAVOR[nearDoor.id] || `You reach the ${nearDoor.label}.`, {
          speaker: nearDoor.label,
          hint:    this.doorHint,
        });
      } else {
        this.textbox.hide();
      }
    }

    if (time - this.lastEmit > 100) {
      if (moving) {
        this.socket?.emit('player:move', { x: this.player.x, y: this.player.y, dir: this.lastDir, vx: vel.x / this.speed, vy: vel.y / this.speed });
      } else if (prevMoved) {
        this.socket?.emit('player:stop', { dir: this.lastDir });
      }
      this.lastEmit = time;
    }
  }

  _setupJoystick() {
    if (!this.sys.game.device.input.touch) return;

    const gfx   = this.add.graphics().setScrollFactor(0).setDepth(55);
    const thumb  = this.add.circle(0, 0, 22, 0xffffff, 0.85).setScrollFactor(0).setDepth(56).setVisible(false);
    this._joyGfx = { gfx, thumb };

    const drawBase = (x, y) => {
      gfx.clear();
      gfx.fillStyle(0x000000, 0.35);
      gfx.fillCircle(x, y, 55);
      gfx.lineStyle(2, 0xffffff, 0.4);
      gfx.strokeCircle(x, y, 55);
    };

    this.input.on('pointerdown', (p) => {
      // A tap on the door textbox enters the building instead of moving.
      if (this.activeDoor && this.textbox?.containsPointer(p)) { this._enterDoor(this.activeDoor); return; }
      if (this.joystick.active) return;
      if (p.x < this.cameras.main.width / 2) return; // right half only
      this.joystick.active    = true;
      this.joystick.pointerId = p.id;
      this.joystick.baseX     = p.x;
      this.joystick.baseY     = p.y;
      drawBase(p.x, p.y);
      thumb.setPosition(p.x, p.y).setVisible(true);
    });

    this.input.on('pointermove', (p) => {
      if (!this.joystick.active || p.id !== this.joystick.pointerId) return;
      const dx   = p.x - this.joystick.baseX;
      const dy   = p.y - this.joystick.baseY;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const cap  = Math.min(dist, 55);
      const ang  = Math.atan2(dy, dx);
      thumb.setPosition(
        this.joystick.baseX + Math.cos(ang) * cap,
        this.joystick.baseY + Math.sin(ang) * cap,
      );
      const dead = 8;
      this.joystick.dx = dist > dead ? dx / dist : 0;
      this.joystick.dy = dist > dead ? dy / dist : 0;
    });

    this.input.on('pointerup', (p) => {
      if (p.id !== this.joystick.pointerId) return;
      this.joystick.active = false;
      this.joystick.dx     = 0;
      this.joystick.dy     = 0;
      gfx.clear();
      thumb.setVisible(false);
    });
  }

  shutdown() {
    this.socket?.disconnect();
    this.game.events.off('chat:send',   this._onChatSend);
    this.game.events.off('chat:active', this._onChatActive);
    this._joyGfx?.gfx.destroy();
    this._joyGfx?.thumb.destroy();
  }
}
