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

// NPC definitions
const NPCS = [
  {
    id: 'tailor',
    label: 'Tailor',
    x: 26 * TILE, y: 22 * TILE,
    sprite: 'npc_tailor',
    action: 'open-customize',
    prompt: 'Press E to change appearance',
    dialog: null, // generated based on stats
  },
  {
    id: 'oracle',
    label: 'Oracle',
    x: 33 * TILE, y: 22 * TILE,
    sprite: 'npc_oracle',
    action: 'show-dialog',
    prompt: 'Press E to consult the Oracle',
    dialog: null,
  },
];

// Tree grid positions (col, row) — avoids paths (cols 29-30, rows 22-23) and NPCs
const TREE_POSITIONS = (() => {
  const positions = [];
  for (let gx = 0; gx < 11; gx++) {
    for (let gy = 0; gy < 8; gy++) {
      const col = gx * 5 + 3;
      const row = gy * 5 + 3;
      if (col >= 27 && col <= 32) continue; // skip vertical path + buffer
      if (row >= 20 && row <= 25) continue; // skip horizontal path + buffer
      if (col >= 23 && col <= 35 && row >= 18 && row <= 27) continue; // skip NPC area
      positions.push({ col, row });
    }
  }
  return positions;
})();

export class TownScene extends Phaser.Scene {
  constructor() {
    super('TownScene');
    this.otherPlayers = {};
    this.npcObjects   = [];
    this.activeNpc    = null;
    this.dialogBox    = null;
  }

  preload() {
    const { character } = this.registry.get('context');
    const sprite = character?.sprite || 'char_1';

    this.load.spritesheet('player',      `/sprites/${sprite}.png`,  { frameWidth: FRAME_W, frameHeight: FRAME_H });
    this.load.spritesheet('other_player',`/sprites/char_1.png`,     { frameWidth: FRAME_W, frameHeight: FRAME_H });
    this.load.spritesheet('npc_tailor',  `/sprites/char_2.png`,     { frameWidth: FRAME_W, frameHeight: FRAME_H });
    this.load.spritesheet('npc_oracle',  `/sprites/char_4.png`,     { frameWidth: FRAME_W, frameHeight: FRAME_H });
    this.load.spritesheet('terrain_grass','/tiles/grass.png',       { frameWidth: TILE, frameHeight: TILE });
    this.load.spritesheet('terrain_dirt', '/tiles/dirt.png',        { frameWidth: TILE, frameHeight: TILE });
    this.load.spritesheet('tree_trunk',   '/tiles/trunk.png',       { frameWidth: TILE, frameHeight: TILE });
    this.load.spritesheet('tree_top',     '/tiles/treetop.png',     { frameWidth: TILE, frameHeight: TILE });
  }

  create() {
    const { user, token, character } = this.registry.get('context');
    const worldW = COLS * TILE;
    const worldH = ROWS * TILE;

    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBounds(0, 0, worldW, worldH);

    this._buildWorld();
    this._buildTrees();
    this._buildNPCs(character);

    // Animations
    ['player', 'other_player', 'npc_tailor', 'npc_oracle'].forEach((key) => {
      WALK_DIRS.forEach((dir, row) => {
        const animKey = `${key}_walk_${dir}`;
        if (!this.anims.exists(animKey)) {
          this.anims.create({
            key: animKey,
            frames: this.anims.generateFrameNumbers(key, { start: row * 9, end: row * 9 + 8 }),
            frameRate: 9,
            repeat: -1,
          });
        }
      });
    });

    // Player
    this.player = this.physics.add.sprite(29 * TILE + 16, 22 * TILE + 16, 'player', 18);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(2);
    this.cameras.main.startFollow(this.player);
    this.lastDir = 'down';

    const str = character?.strength || 0;
    this.speed = Math.round(BASE_SPEED + (str / 100) * (MAX_SPEED - BASE_SPEED));

    // Tree trunk collision
    this.physics.add.collider(this.player, this.trunkGroup);

    // Input
    this.cursors  = this.input.keyboard.createCursorKeys();
    this.wasd     = this.input.keyboard.addKeys({ up: 'W', left: 'A', down: 'S', right: 'D' });
    this.eKey     = this.input.keyboard.addKey('E');

    // E key interaction
    this.input.keyboard.on('keydown-E', () => this._tryInteract(character));

    // Prompt text (shown near bottom of screen, fixed to camera)
    this.promptText = this.add.text(worldW / 2, worldH - 60, '', {
      fontSize: '14px', color: '#ffd700', fontFamily: 'monospace',
      backgroundColor: '#000000cc', padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(20).setVisible(false);

    this._setupSocket(user, token, character);
    this.lastEmit  = 0;
    this.wasMoving = false;
  }

  _buildWorld() {
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        const frame = (x + y) % 7 === 0 ? 3 : (x * y) % 11 === 0 ? 5 : 4;
        this.add.image(x * TILE + 16, y * TILE + 16, 'terrain_grass', frame).setDepth(0);
      }
    }
    // Horizontal dirt path
    for (let x = 0; x < COLS; x++) {
      this.add.image(x * TILE + 16, 22 * TILE + 16, 'terrain_dirt', 4).setDepth(0);
      this.add.image(x * TILE + 16, 23 * TILE + 16, 'terrain_dirt', 4).setDepth(0);
    }
    // Vertical dirt path
    for (let y = 0; y < ROWS; y++) {
      this.add.image(29 * TILE + 16, y * TILE + 16, 'terrain_dirt', 4).setDepth(0);
      this.add.image(30 * TILE + 16, y * TILE + 16, 'terrain_dirt', 4).setDepth(0);
    }
  }

  _buildTrees() {
    this.trunkGroup = this.physics.add.staticGroup();

    TREE_POSITIONS.forEach(({ col, row }) => {
      const x = col * TILE + 16;
      const y = row * TILE + 16;
      // Trunk (with collision)
      const trunk = this.trunkGroup.create(x, y, 'tree_trunk', 0);
      trunk.setDepth(1).refreshBody();
      // Treetop (decorative, above everything)
      this.add.image(x, y - TILE, 'tree_top', 0).setDepth(10);
    });
  }

  _buildNPCs(character) {
    NPCS.forEach((npc) => {
      const sprite = this.add.sprite(npc.x, npc.y, npc.sprite, 18).setDepth(2);
      const label  = this.add.text(npc.x, npc.y - 40, npc.label, {
        fontSize: '11px', color: '#ffd700', fontFamily: 'monospace',
        backgroundColor: '#000000aa', padding: { x: 6, y: 3 },
      }).setOrigin(0.5).setDepth(20);

      this.npcObjects.push({ ...npc, sprite, label });
    });
  }

  _tryInteract(character) {
    if (!this.activeNpc) return;

    if (this.activeNpc.action === 'open-customize') {
      this.game.events.emit('open-customize');
      return;
    }

    if (this.activeNpc.action === 'show-dialog') {
      if (this.dialogBox) { this._hideDialog(); return; }
      this._showOracleDialog(character);
    }
  }

  _showOracleDialog(character) {
    const str = character?.strength     || 0;
    const int = character?.intelligence || 0;
    const wis = character?.wisdom       || 0;
    const foc = character?.focus        || 0;
    const vit = character?.vitality     || 0;
    const gold = character?.gold        || 0;

    const lines = ['The Oracle speaks...', ''];
    if (str >= 50)  lines.push(`⚔️  Your body grows strong. STR ${str}.`);
    else            lines.push(`⚔️  Visit the gym more. STR ${str}.`);
    if (int >= 50)  lines.push(`📚  Your mind is sharp. INT ${int}.`);
    else            lines.push(`📚  Study harder, young one. INT ${int}.`);
    if (wis >= 30)  lines.push(`📖  Wisdom flows through you. WIS ${wis}.`);
    if (foc >= 30)  lines.push(`🧘  Your focus is remarkable. FOC ${foc}.`);
    if (vit < 30)   lines.push(`😴  You need more sleep. VIT ${vit}.`);
    if (gold > 0)   lines.push(`💰  ${gold} gold saved. Keep it up!`);
    lines.push('', '[Press E to close]');

    const cam = this.cameras.main;
    const x = cam.scrollX + cam.width  / 2;
    const y = cam.scrollY + cam.height / 2;

    const bg   = this.add.rectangle(x, y, 400, lines.length * 22 + 24, 0x000000, 0.85).setDepth(30);
    const text = this.add.text(x, y, lines.join('\n'), {
      fontSize: '12px', color: '#ffffff', fontFamily: 'monospace', align: 'center',
    }).setOrigin(0.5).setDepth(31);

    this.dialogBox = { bg, text };
  }

  _hideDialog() {
    this.dialogBox?.bg.destroy();
    this.dialogBox?.text.destroy();
    this.dialogBox = null;
  }

  _setupSocket(user, token, character) {
    this.socket = io(SOCKET_URL, { auth: { token } });
    this.socket.on('connect', () => {
      this.socket.emit('player:join', {
        username: user.username,
        x: this.player.x,
        y: this.player.y,
        mapId: 'town',
        sprite: character?.sprite || 'char_1',
      });
    });

    this.socket.on('players:current', (players) => players.forEach((p) => this._addOtherPlayer(p)));
    this.socket.on('player:joined',   (p) => this._addOtherPlayer(p));

    this.socket.on('player:moved', ({ socketId, x, y, dir }) => {
      const op = this.otherPlayers[socketId];
      if (!op) return;
      op.sprite.setPosition(x, y);
      op.label.setPosition(x, y - 36);
      if (dir) op.sprite.anims.play(`other_player_walk_${dir}`, true);
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
  }

  _addOtherPlayer({ socketId, username, x, y }) {
    const sprite = this.add.sprite(x, y, 'other_player', 18).setDepth(2);
    const label  = this.add.text(x, y - 36, username, {
      fontSize: '10px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(20);
    this.otherPlayers[socketId] = { sprite, label };
  }

  update(time) {
    // Movement
    const vel = { x: 0, y: 0 };
    if (this.cursors.left.isDown  || this.wasd.left.isDown)  vel.x = -this.speed;
    else if (this.cursors.right.isDown || this.wasd.right.isDown) vel.x = this.speed;
    if (this.cursors.up.isDown    || this.wasd.up.isDown)    vel.y = -this.speed;
    else if (this.cursors.down.isDown  || this.wasd.down.isDown)  vel.y = this.speed;

    const moving = vel.x !== 0 || vel.y !== 0;
    if (moving) {
      if (vel.x < 0)      this.lastDir = 'left';
      else if (vel.x > 0) this.lastDir = 'right';
      else if (vel.y < 0) this.lastDir = 'up';
      else                this.lastDir = 'down';
      this.player.anims.play(`player_walk_${this.lastDir}`, true);
    } else if (this.wasMoving) {
      this.player.anims.stop();
      this.player.setFrame(WALK_DIRS.indexOf(this.lastDir) * 9);
    }
    this.wasMoving = moving;
    this.player.setVelocity(vel.x, vel.y);

    // NPC proximity
    let nearestNpc  = null;
    let nearestDist = 80;
    this.npcObjects.forEach((npc) => {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.x, npc.y);
      if (dist < nearestDist) { nearestDist = dist; nearestNpc = npc; }
    });

    if (nearestNpc !== this.activeNpc) {
      this.activeNpc = nearestNpc;
      if (nearestNpc) {
        this.promptText.setText(nearestNpc.prompt).setVisible(true);
      } else {
        this.promptText.setVisible(false);
        this._hideDialog();
      }
    }

    // Socket emit
    if (time - this.lastEmit > 100) {
      if (moving) {
        this.socket.emit('player:move', { x: this.player.x, y: this.player.y, dir: this.lastDir });
      } else if (this.wasMoving) {
        this.socket.emit('player:stop', { dir: this.lastDir });
      }
      this.lastEmit = time;
    }
  }

  shutdown() {
    this.socket?.disconnect();
  }
}
