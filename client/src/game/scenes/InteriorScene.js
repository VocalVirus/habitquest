import Phaser from 'phaser';
import axios from 'axios';

const TILE = 32;
const WALK_DIRS = ['up','left','down','right'];
const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const NPC_CONFIG = {
  store:    { name: 'Shopkeeper',  greeting: "Welcome! Check my wares.",            hasShop: true,  action: null },
  inn:      { name: 'Innkeeper',   greeting: "Rest up. VIT grows with good sleep.", hasShop: false, action: null },
  tailor:   { name: 'Tailor',      greeting: "I can change your look.",             hasShop: false, action: 'customize' },
  townhall: { name: 'Chancellor',  greeting: "Greetings. Your deeds are recorded.", hasShop: false, action: 'stats' },
  armory:   { name: 'Weaponsmith', greeting: "Finest steel in the land.",           hasShop: true,  action: null },
};

const SHOP_ITEMS = [
  { id: 'speed_potion',  name: 'Speed Potion',   price: 25,  desc: '2x speed for 60s' },
  { id: 'vitality_brew', name: 'Vitality Brew',  price: 40,  desc: '+5 VIT stat' },
  { id: 'scholar_tea',   name: "Scholar's Tea",  price: 40,  desc: '+5 INT stat' },
  { id: 'focus_candle',  name: 'Focus Candle',   price: 40,  desc: '+5 FOC stat' },
  { id: 'strength_wrap', name: "Warrior's Wrap", price: 60,  desc: '+5 STR stat' },
  { id: 'mystery_box',   name: 'Mystery Box',    price: 100, desc: '???' },
];

const WEAPON_ITEMS = [
  { id: 'wooden_sword',   name: 'Wooden Sword',   price: 50,  desc: '+8 STR' },
  { id: 'iron_axe',       name: 'Iron Axe',        price: 120, desc: '+15 STR' },
  { id: 'hunters_bow',    name: "Hunter's Bow",    price: 100, desc: '+10 AGI' },
  { id: 'battle_staff',   name: 'Battle Staff',    price: 150, desc: '+12 INT' },
  { id: 'knights_shield', name: "Knight's Shield", price: 200, desc: '+20 VIT' },
];

export class InteriorScene extends Phaser.Scene {
  constructor() {
    super('InteriorScene');
  }

  init(data) {
    this.buildingId    = data.buildingId    || 'store';
    this.buildingLabel = data.buildingLabel || 'Building';
    this.returnX       = data.returnX;
    this.returnY       = data.returnY;
    this.sessionItems  = data.sessionItems  || [];
    this.purchaseItems = [];
    this.shopOpen      = false;
    this.shopIdx       = 0;
    this.shopMenu      = null;
    this.gold          = 0;
    this.statsOpen     = false;
    this.statsPanel    = null;
  }

  preload() {
    const character = this.registry.get('context')?.character;
    if (!this.textures.exists('player_int')) {
      this.load.spritesheet('player_int', `/sprites/${character?.sprite || 'char_1'}.png`,
        { frameWidth: 64, frameHeight: 64 });
    }
    if (!this.textures.exists('npc_int')) {
      this.load.spritesheet('npc_int', '/sprites/char_2.png', { frameWidth: 64, frameHeight: 64 });
    }
    if (!this.textures.exists('inside')) {
      this.load.spritesheet('inside', '/tiles/inside.png', { frameWidth: TILE, frameHeight: TILE });
    }
  }

  create() {
    const character = this.registry.get('context')?.character;
    this.gold = character?.gold || 0;
    const isArmory = this.buildingId === 'armory';

    const W = this.sys.game.config.width;
    const H = this.sys.game.config.height;

    // Fixed cozy room, centered in the canvas. The canvas tracks the browser
    // window, so sizing the room to it produced a huge empty hall — don't.
    const RCOLS = 26, RROWS = 17;
    const ROOM_W = RCOLS * TILE;          // 832
    const ROOM_H = RROWS * TILE;          // 544
    const ox = Math.max(0, Math.round((W - ROOM_W) / 2));
    const oy = Math.max(0, Math.round((H - ROOM_H) / 2));
    const cx = ox + ROOM_W / 2;
    const cy = oy + ROOM_H / 2;

    this._RW = W; this._RH = H;           // canvas dims — used to centre modals
    this._ox = ox; this._oy = oy;
    this._roomW = ROOM_W; this._roomH = ROOM_H;

    this.cameras.main.setBackgroundColor(isArmory ? '#0e0907' : '#120a02');
    this.physics.world.setBounds(ox, oy, ROOM_W, ROOM_H);

    // Floor
    for (let c = 0; c < RCOLS; c++) {
      for (let r = 0; r < RROWS; r++) {
        const frame = (c + r) % 2 === 0 ? 10 : 11;
        this.add.image(ox + c * TILE + 16, oy + r * TILE + 16, 'inside', frame).setDepth(0);
      }
    }

    // Room frame + top wall strip
    this.add.rectangle(cx, cy, ROOM_W, ROOM_H, 0x000000, 0)
      .setStrokeStyle(6, isArmory ? 0x2a2a30 : 0x3a2a1a).setDepth(1);
    this.add.rectangle(cx, oy + 16, ROOM_W, 48, isArmory ? 0x14100e : 0x1a0d00).setDepth(1);

    // Counter / shelf row
    const counterY = oy + Math.round(ROOM_H * 0.28);
    this.add.rectangle(cx, counterY, ROOM_W - 80, 16, isArmory ? 0x4a4a52 : 0x6B3A1F).setDepth(2);
    this.add.rectangle(cx, counterY + 8, ROOM_W - 80, 4, isArmory ? 0x26262b : 0x3d1f08).setDepth(2);

    // Building label (top of room)
    this.add.text(cx, oy + 6, this.buildingLabel, {
      fontSize: '14px', color: '#ffd700', fontFamily: 'monospace',
      backgroundColor: '#000000cc', padding: { x: 12, y: 4 },
    }).setOrigin(0.5, 0).setDepth(10);

    // NPC
    const npc = NPC_CONFIG[this.buildingId] || NPC_CONFIG.store;
    this.npcSprite = this.add.sprite(cx, oy + 50, 'npc_int', 18).setDepth(5);
    this.npcName   = this.add.text(cx, oy + 70, npc.name, {
      fontSize: '10px', color: '#ffd700', fontFamily: 'monospace',
      backgroundColor: '#000000aa', padding: { x: 5, y: 2 },
    }).setOrigin(0.5).setDepth(10);
    this.npcGreeting = this.add.text(cx, counterY - 28, npc.greeting, {
      fontSize: '11px', color: '#cccccc', fontFamily: 'monospace',
      backgroundColor: '#000000bb', padding: { x: 8, y: 4 },
    }).setOrigin(0.5, 1).setDepth(10).setVisible(false);

    // Exit marker at room bottom
    this.add.rectangle(cx, oy + ROOM_H - 4, 72, 8, 0x8B5E3C).setDepth(3);
    this.add.text(cx, oy + ROOM_H - 22, '[exit]', {
      fontSize: '10px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(10);

    // Collision walls
    this.walls = this.physics.add.staticGroup();
    const addWall = (x, y, w, h) => {
      const r = this.add.rectangle(x, y, w, h, 0x000000, 0);
      this.physics.add.existing(r, true);
      this.walls.add(r);
    };
    addWall(cx, oy + 16, ROOM_W, 32);                   // top wall
    addWall(cx, counterY, ROOM_W - 80, 16);             // counter
    addWall(ox + 16, cy, 32, ROOM_H);                   // left wall
    addWall(ox + ROOM_W - 16, cy, 32, ROOM_H);          // right wall

    // Animations
    WALK_DIRS.forEach((dir, row) => {
      const k = `player_int_${dir}`;
      if (!this.anims.exists(k)) {
        this.anims.create({
          key: k,
          frames: this.anims.generateFrameNumbers('player_int', { start: row*9, end: row*9+8 }),
          frameRate: 9, repeat: -1,
        });
      }
    });

    // Player spawns near the exit (bottom-centre of room)
    this.player = this.physics.add.sprite(cx, oy + ROOM_H - 56, 'player_int', 18);
    this.player.setCollideWorldBounds(true).setDepth(5);
    this.lastDir   = 'up';
    this.wasMoving = false;
    this.speed     = 120;

    this.physics.add.collider(this.player, this.walls);

    this.npcZoneY = counterY;
    this.exitY    = oy + ROOM_H;
    this.npcDef   = npc;

    // Input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd    = this.input.keyboard.addKeys({ up: 'W', left: 'A', down: 'S', right: 'D' });
    this.upKey   = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.downKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.input.keyboard.on('keydown-E',   () => this._onE());
    this.input.keyboard.on('keydown-ESC', () => {
      if (this.shopOpen)  this._closeShop();
      if (this.statsOpen) this._closeStats();
    });

    // Prompt text near room bottom
    this.promptText = this.add.text(cx, oy + ROOM_H - 44, '', {
      fontSize: '13px', color: '#ffd700', fontFamily: 'monospace',
      backgroundColor: '#000000cc', padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setDepth(30).setVisible(false);

    // Gold display (top-left of canvas)
    this.goldText = this.add.text(12, 12, `Gold: ${this.gold}`, {
      fontSize: '12px', color: '#ffd700', fontFamily: 'monospace',
      backgroundColor: '#000000bb', padding: { x: 6, y: 3 },
    }).setDepth(30);

    if (isArmory) this._buildArmoryDecor(ox, oy, ROOM_W, ROOM_H);
  }

  _buildArmoryDecor(ox, oy, RW, RH) {
    const cx = ox + RW / 2;

    // Warm forge ambiance over the floor
    this.add.rectangle(cx, oy + RH / 2, RW, RH, 0x551500, 0.08).setDepth(1);

    // Back-wall trophies flanking the smith — crossed swords (left), shield (right)
    const wy = oy + 30;
    this.add.rectangle(cx - 150, wy, 4, 44, 0xc9c9d2).setDepth(2).setAngle(34);
    this.add.rectangle(cx - 150, wy, 4, 44, 0xc9c9d2).setDepth(2).setAngle(-34);
    this.add.ellipse(cx + 150, wy, 30, 38, 0x6b4a2a).setDepth(2);
    this.add.ellipse(cx + 150, wy, 17, 23, 0x8a3030).setDepth(2);

    // Forge (bottom-left) with flickering embers
    const fx = ox + 66, fy = oy + Math.round(RH * 0.62);
    this.add.rectangle(fx, fy - 50, 24, 36, 0x2a2a30).setDepth(2);   // chimney
    this.add.rectangle(fx, fy, 80, 72, 0x33333a).setDepth(2);        // stone body
    this.add.rectangle(fx, fy + 28, 80, 12, 0x202024).setDepth(2);   // base
    this.add.rectangle(fx, fy - 4, 44, 32, 0x120a06).setDepth(2);    // mouth
    const glow   = this.add.circle(fx, fy - 2, 27, 0xff6a1a, 0.32).setDepth(2);
    const embers = this.add.ellipse(fx, fy + 4, 36, 20, 0xff5412).setDepth(3);
    const emHot  = this.add.ellipse(fx, fy + 6, 22, 12, 0xffb028).setDepth(3);
    this.tweens.add({
      targets: [glow, embers, emHot],
      scaleX: 1.12, scaleY: 1.26,
      duration: 540, yoyo: true, repeat: -1, ease: 'Sine.inOut',
    });

    // Anvil (right of forge)
    const ax = ox + 150, ay = fy + 14;
    this.add.rectangle(ax, ay + 16, 30, 9, 0x4a3322).setDepth(2);    // wood stump
    this.add.rectangle(ax, ay + 5,  16, 13, 0x26262b).setDepth(3);   // waist
    this.add.rectangle(ax, ay - 4,  38, 11, 0x303036).setDepth(3);   // top
    this.add.rectangle(ax + 24, ay - 4, 11, 6, 0x303036).setDepth(3);// horn

    // Weapon rack (right wall) — three blades hanging
    const rx = ox + RW - 60, rackY = oy + Math.round(RH * 0.52);
    this.add.rectangle(rx, rackY, 58, 8, 0x5a3d22).setDepth(2);      // mount bar
    [-20, 0, 20].forEach((dx) => {
      const sx = rx + dx;
      this.add.rectangle(sx, rackY + 4,  11, 4, 0x6b4a2a).setDepth(3); // crossguard
      this.add.rectangle(sx, rackY + 24, 4, 36, 0xc9c9d2).setDepth(3); // blade
      this.add.circle(sx, rackY - 2, 3, 0x8a6a30).setDepth(3);         // pommel
    });

    // Barrel of spears (bottom-right corner)
    const by = oy + RH - 64, bx = ox + RW - 60;
    this.add.ellipse(bx, by, 34, 44, 0x6b4a2a).setDepth(3);
    this.add.rectangle(bx, by - 11, 34, 4, 0x4a3218).setDepth(3);
    this.add.rectangle(bx, by + 9,  34, 4, 0x4a3218).setDepth(3);
    [-7, 0, 7].forEach((dx) => {
      this.add.rectangle(bx + dx, by - 32, 3, 42, 0x6b4a2a).setDepth(4); // shaft
      this.add.rectangle(bx + dx, by - 54, 4, 10, 0xc9c9d2).setDepth(4); // tip
    });
  }

  _onE() {
    if (this.shopOpen)  { this._buySelected(); return; }
    if (this.statsOpen) { this._closeStats();  return; }

    const nearExit = this.player.y > this.exitY - 64;
    const nearNpc  = this.player.y < this.npcZoneY + 80;

    if (nearExit) { this._exitToTown(); return; }
    if (!nearNpc) return;

    if (this.npcDef.action === 'customize') { this.game.events.emit('open-customize'); return; }
    if (this.npcDef.action === 'stats')     { this._openStats(); return; }
    if (this.npcDef.hasShop)                { this._openShop();  return; }

    this.npcGreeting.setVisible(!this.npcGreeting.visible);
  }

  _openShop() {
    this.shopOpen    = true;
    this.shopIdx     = 0;
    this.activeItems = this.buildingId === 'armory' ? WEAPON_ITEMS : SHOP_ITEMS;
    this._renderShop();
  }

  _renderShop() {
    this._destroyShopMenu();
    const RW    = this._RW;
    const RH    = this._RH;
    const items = this.activeItems;
    const panelW = Math.min(500, RW - 40);
    const panelH = items.length * 38 + 90;
    const shopTitle = this.buildingId === 'armory' ? 'Armory' : 'General Store';

    const bg    = this.add.rectangle(RW/2, RH/2, panelW, panelH, 0x0d0d0d, 0.95).setDepth(50);
    const title = this.add.text(RW/2, RH/2 - panelH/2 + 18,
      `${shopTitle}   [Gold: ${this.gold}]`,
      { fontSize: '13px', color: '#ffd700', fontFamily: 'monospace' }
    ).setOrigin(0.5).setDepth(51);

    const rows = items.map((item, i) => {
      const sel   = i === this.shopIdx;
      const color = sel ? '#ffd700' : (this.gold >= item.price ? '#dddddd' : '#666666');
      const pfx   = sel ? '> ' : '  ';
      return this.add.text(
        RW/2 - panelW/2 + 18,
        RH/2 - panelH/2 + 46 + i * 38,
        `${pfx}${item.name.padEnd(18)} ${String(item.price).padStart(3)}g  ${item.desc}`,
        { fontSize: '12px', color, fontFamily: 'monospace' }
      ).setDepth(51);
    });

    const hint = this.add.text(RW/2, RH/2 + panelH/2 - 18,
      '↑↓ Navigate   E Buy   ESC Close',
      { fontSize: '10px', color: '#888888', fontFamily: 'monospace' }
    ).setOrigin(0.5).setDepth(51);

    this.shopMenu = { bg, title, rows, hint };

    this.upKey.removeAllListeners('down');
    this.downKey.removeAllListeners('down');
    this.upKey.on('down', () => {
      if (!this.shopOpen) return;
      this.shopIdx = (this.shopIdx - 1 + items.length) % items.length;
      this._renderShop();
    });
    this.downKey.on('down', () => {
      if (!this.shopOpen) return;
      this.shopIdx = (this.shopIdx + 1) % items.length;
      this._renderShop();
    });
  }

  _destroyShopMenu() {
    if (!this.shopMenu) return;
    this.shopMenu.bg.destroy();
    this.shopMenu.title.destroy();
    this.shopMenu.rows.forEach(r => r.destroy());
    this.shopMenu.hint.destroy();
    this.shopMenu = null;
  }

  _closeShop() {
    this.shopOpen = false;
    this._destroyShopMenu();
  }

  async _buySelected() {
    const item = this.activeItems[this.shopIdx];
    if (!item) return;
    if (this.gold < item.price) {
      this._flash('Not enough gold!', '#ff5555');
      return;
    }
    try {
      const { token } = this.registry.get('context');
      const { data }  = await axios.post(
        `${API}/shop/buy/${item.id}`, {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      this.gold = data.character.gold;
      // Sync updated gold back into registry so UIScene reflects it
      const ctx = this.registry.get('context');
      if (ctx?.character) { ctx.character.gold = data.character.gold; this.registry.set('context', ctx); }

      this.goldText.setText(`Gold: ${this.gold}`);
      this.purchaseItems.push(item.id);
      this._flash(`Bought ${item.name}!`, '#00ff88');
      this._renderShop();
    } catch (err) {
      this._flash(err.response?.data?.error || 'Purchase failed', '#ff5555');
    }
  }

  _flash(msg, color = '#ffffff') {
    const t = this.add.text(this._RW/2, this._RH - 90, msg, {
      fontSize: '13px', color, fontFamily: 'monospace',
      backgroundColor: '#000000ee', padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setDepth(60);
    this.time.delayedCall(2200, () => t.destroy());
  }

  async _openStats() {
    this.statsOpen = true;
    this.player.setVelocity(0, 0);

    let char;
    try {
      const { token } = this.registry.get('context');
      const { data }  = await axios.get(`${API}/characters/me`, { headers: { Authorization: `Bearer ${token}` } });
      char = data;
    } catch {
      char = this.registry.get('context').character || {};
    }

    const RW = this._RW;
    const RH = this._RH;
    const PW = Math.min(520, RW - 40);
    const ROWS_DATA = [
      { label: 'STRENGTH',      val: char.strength,     hint: 'gym hours × 5' },
      { label: 'AGILITY',       val: char.agility,      hint: 'walk km × 2' },
      { label: 'VITALITY',      val: char.vitality,     hint: 'sleep hrs ÷ 56 × 100' },
      { label: 'CONSTITUTION',  val: char.constitution, hint: 'water glasses' },
      { label: 'INTELLIGENCE',  val: char.intelligence, hint: 'study hours × 3' },
      { label: 'WISDOM',        val: char.wisdom,       hint: 'reading hours × 4' },
      { label: 'FOCUS',         val: char.focus,        hint: 'meditation minutes' },
    ];
    const PH = ROWS_DATA.length * 30 + 120;
    const px = RW / 2;
    const py = RH / 2;

    const bg    = this.add.rectangle(px, py, PW, PH, 0x0a0a0a, 0.96).setDepth(50);
    const title = this.add.text(px, py - PH / 2 + 18,
      `YOUR DEEDS  —  Lv.${char.level || 1}`,
      { fontSize: '13px', color: '#ffd700', fontFamily: 'monospace', fontStyle: 'bold' }
    ).setOrigin(0.5).setDepth(51);

    const statObjs = ROWS_DATA.map((r, i) => {
      const y  = py - PH / 2 + 52 + i * 30;
      const lx = px - PW / 2 + 18;
      const bar = Math.round((r.val || 0) / 100 * (PW - 220));
      const filled = Math.max(0, bar);

      const label = this.add.text(lx, y, r.label.padEnd(13), {
        fontSize: '11px', color: '#aaaaaa', fontFamily: 'monospace',
      }).setDepth(51);

      const valText = this.add.text(lx + 160, y,
        String(Math.round(r.val || 0)).padStart(3),
        { fontSize: '11px', color: '#ffffff', fontFamily: 'monospace' }
      ).setDepth(51);

      const barBg  = this.add.rectangle(lx + 200, y + 6, PW - 220, 8, 0x333333).setOrigin(0, 0.5).setDepth(51);
      const barFg  = this.add.rectangle(lx + 200, y + 6, filled, 8, 0x4caf50).setOrigin(0, 0.5).setDepth(51);

      const hint = this.add.text(lx + 200 + (PW - 220) + 8, y,
        `← ${r.hint}`,
        { fontSize: '9px', color: '#555555', fontFamily: 'monospace' }
      ).setDepth(51);

      return [label, valText, barBg, barFg, hint];
    }).flat();

    const gold = this.add.text(px, py + PH / 2 - 38,
      `Gold: ${char.gold || 0}g`,
      { fontSize: '12px', color: '#ffd700', fontFamily: 'monospace' }
    ).setOrigin(0.5).setDepth(51);

    const hint = this.add.text(px, py + PH / 2 - 18,
      'E or ESC to close',
      { fontSize: '9px', color: '#555555', fontFamily: 'monospace' }
    ).setOrigin(0.5).setDepth(51);

    this.statsPanel = [bg, title, gold, hint, ...statObjs];
  }

  _closeStats() {
    this.statsOpen = false;
    if (this.statsPanel) {
      this.statsPanel.forEach((o) => o.destroy());
      this.statsPanel = null;
    }
  }

  _exitToTown() {
    this.scene.start('TownScene', {
      returnX:      this.returnX,
      returnY:      this.returnY,
      returnDir:    'down',
      sessionItems: [...this.sessionItems, ...this.purchaseItems],
    });
  }

  update() {
    if (this.shopOpen || this.statsOpen) { this.player.setVelocity(0, 0); return; }

    const vel = { x: 0, y: 0 };
    if      (this.cursors.left.isDown  || this.wasd.left.isDown)  vel.x = -this.speed;
    else if (this.cursors.right.isDown || this.wasd.right.isDown) vel.x =  this.speed;
    if      (this.cursors.up.isDown    || this.wasd.up.isDown)    vel.y = -this.speed;
    else if (this.cursors.down.isDown  || this.wasd.down.isDown)  vel.y =  this.speed;

    const moving = vel.x !== 0 || vel.y !== 0;
    if (moving) {
      if      (vel.x < 0) this.lastDir = 'left';
      else if (vel.x > 0) this.lastDir = 'right';
      else if (vel.y < 0) this.lastDir = 'up';
      else                this.lastDir = 'down';
      this.player.anims.play(`player_int_${this.lastDir}`, true);
    } else if (this.wasMoving) {
      this.player.anims.stop();
      this.player.setFrame(WALK_DIRS.indexOf(this.lastDir) * 9);
    }
    this.wasMoving = moving;
    this.player.setVelocity(vel.x, vel.y);

    const nearExit = this.player.y > this.exitY - 64;
    const nearNpc  = this.player.y < this.npcZoneY + 80;

    if (nearExit) {
      this.promptText.setText('Press E to exit').setVisible(true);
    } else if (nearNpc) {
      const label = this.npcDef.hasShop ? 'Press E to open shop' :
                    this.npcDef.action === 'customize' ? 'Press E to customize appearance' :
                    'Press E to talk';
      this.promptText.setText(label).setVisible(true);
    } else {
      this.promptText.setVisible(false);
    }
  }
}
