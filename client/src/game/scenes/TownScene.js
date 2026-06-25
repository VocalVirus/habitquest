import Phaser from 'phaser';
import { io } from 'socket.io-client';

const BASE_SPEED = 120;
const MAX_SPEED  = 280;
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
const FRAME_W    = 64;
const FRAME_H    = 64;
const TILE       = 32;
const COLS       = 60;
const ROWS       = 45;
const WALK_DIRS  = ['up', 'left', 'down', 'right'];

// Buildings use composited sprites in /buildings/. W/H must match those images.
// H=224: top 128px = roof from above (north), bottom 96px = facade/door (south)
const BUILDINGS = [
  { id: 'store',    label: 'General Store',       worldX: 15 * TILE, worldY: 13 * TILE, texture: 'building_store',    W: 288, H: 224 },
  { id: 'inn',      label: 'The Sleepy Bear Inn', worldX: 37 * TILE, worldY: 13 * TILE, texture: 'building_inn',      W: 288, H: 224 },
  { id: 'tailor',   label: 'Tailor Shop',         worldX: 15 * TILE, worldY: 29 * TILE, texture: 'building_tailor',   W: 288, H: 224 },
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
  if (col >= 20 && col <= 37 && row >=  3 && row <=  9) return true; // Town Hall
  if (col >= 43 && col <= 59 && row >= 29 && row <= 44) return true; // SE pond
  return false;
}

const TREE_POSITIONS = (() => {
  const out = [];
  for (let gx = 0; gx < 11; gx++) {
    for (let gy = 0; gy < 8; gy++) {
      const col = gx * 5 + 3;
      const row = gy * 5 + 3;
      if (!isExcluded(col, row)) out.push({ col, row });
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
    this.load.spritesheet('terrain_grass', '/tiles/grass.png',  { frameWidth: TILE, frameHeight: TILE });
    this.load.spritesheet('terrain_dirt',  '/tiles/dirt.png',   { frameWidth: TILE, frameHeight: TILE });
    this.load.spritesheet('tree_trunk',    '/tiles/trunk.png',  { frameWidth: TILE, frameHeight: TILE });
    this.load.spritesheet('tree_top',      '/tiles/treetop.png',{ frameWidth: TILE, frameHeight: TILE });
    this.load.image('building_store',    '/buildings/building_store.png');
    this.load.image('building_inn',      '/buildings/building_inn.png');
    this.load.image('building_tailor',   '/buildings/building_tailor.png');
    this.load.image('building_townhall', '/buildings/building_townhall.png');
  }

  create() {
    const { user, token, character } = this.registry.get('context');
    const worldW = COLS * TILE;
    const worldH = ROWS * TILE;

    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBounds(0, 0, worldW, worldH);

    this._buildGround();
    this._buildPond();
    this._buildPaths();
    this._buildBuildings();
    this._buildTrees();
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
    this.input.keyboard.on('keydown-E', () => this._tryEnterDoor());

    this.promptText = this.add.text(worldW / 2, worldH - 60, '', {
      fontSize: '14px', color: '#ffd700', fontFamily: 'monospace',
      backgroundColor: '#000000cc', padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(30).setVisible(false)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this._tryEnterDoor());

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
  }

  _buildGround() {
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        const frame = (x + y) % 7 === 0 ? 3 : (x * y) % 11 === 0 ? 5 : 4;
        this.add.image(x * TILE + 16, y * TILE + 16, 'terrain_grass', frame).setDepth(0);
      }
    }
  }

  _buildPond() {
    const C1 = 44, C2 = 58, R1 = 30, R2 = 43;
    const pW = (C2 - C1 + 1) * TILE;
    const pH = (R2 - R1 + 1) * TILE;
    const cx = C1 * TILE + pW / 2;
    const cy = R1 * TILE + pH / 2;
    // Solid water body (dark blue base + lighter inner fill)
    this.add.rectangle(cx, cy, pW,      pH,      0x0d3d5e).setDepth(1);
    this.add.rectangle(cx, cy, pW - 32, pH - 32, 0x1a6b9a).setDepth(1);
    this.add.rectangle(cx, cy, pW - 64, pH - 64, 0x2882b8).setDepth(1);
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
      this.doorZones.push({
        x: doorX, y: doorY, radius: 48,
        id: b.id, label: b.label,
        returnX: doorX, returnY: doorY + 48,
      });
    });
  }

  _buildTrees() {
    this.trunkGroup = this.physics.add.staticGroup();
    TREE_POSITIONS.forEach(({ col, row }) => {
      const x = col * TILE + 16;
      const y = row * TILE + 16;
      const trunk = this.trunkGroup.create(x, y, 'tree_trunk', 0);
      trunk.setDepth(2).refreshBody();
      this.add.image(x, y - TILE, 'tree_top', 0).setDepth(10);
    });
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

  _tryEnterDoor() {
    if (!this.activeDoor) return;
    this.scene.start('InteriorScene', {
      buildingId:    this.activeDoor.id,
      buildingLabel: this.activeDoor.label,
      returnX:       this.activeDoor.returnX,
      returnY:       this.activeDoor.returnY,
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
    this.socket.on('player:moved',  ({ socketId, x, y, dir }) => {
      const op = this.otherPlayers[socketId];
      if (!op) return;
      op.targetX = x;
      op.targetY = y;
      if (dir) op.sprite.anims.play(`${op.spriteKey}_walk_${dir}`, true);
    });
    this.socket.on('player:stopped', ({ socketId, dir }) => {
      const op = this.otherPlayers[socketId];
      if (!op) return;
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
    this.otherPlayers[socketId] = { sprite, label, spriteKey: key, targetX: x, targetY: y };
  }

  update(time) {
    const LERP = 0.3;
    Object.values(this.otherPlayers).forEach((op) => {
      op.sprite.x = Phaser.Math.Linear(op.sprite.x, op.targetX, LERP);
      op.sprite.y = Phaser.Math.Linear(op.sprite.y, op.targetY, LERP);
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

    // Door proximity check
    let nearDoor = null;
    let nearDist = 999;
    this.doorZones.forEach((door) => {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, door.x, door.y);
      if (d < door.radius && d < nearDist) { nearDist = d; nearDoor = door; }
    });
    if (nearDoor !== this.activeDoor) {
      this.activeDoor = nearDoor;
      if (nearDoor) {
        this.promptText.setText(`Press E to enter ${nearDoor.label}`).setVisible(true);
      } else {
        this.promptText.setVisible(false);
      }
    }

    if (time - this.lastEmit > 100) {
      if (moving) {
        this.socket?.emit('player:move', { x: this.player.x, y: this.player.y, dir: this.lastDir });
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
