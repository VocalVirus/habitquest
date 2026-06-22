import Phaser from 'phaser';
import { io } from 'socket.io-client';

const SPEED = 160;
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export class TownScene extends Phaser.Scene {
  constructor() {
    super('TownScene');
    this.otherPlayers = {};
  }

  preload() {
    // Placeholder colored rectangle sprites — replace with real pixel art sprites
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x4fc3f7);
    g.fillRect(0, 0, 32, 48);
    g.generateTexture('player', 32, 48);

    g.clear();
    g.fillStyle(0xef9a9a);
    g.fillRect(0, 0, 32, 48);
    g.generateTexture('other_player', 32, 48);

    g.clear();
    g.fillStyle(0x2e7d32);
    g.fillRect(0, 0, 16, 16);
    g.generateTexture('tile_grass', 16, 16);
    g.destroy();
  }

  create() {
    const { user, token } = this.registry.get('context');

    // Simple tiled ground
    for (let x = 0; x < 50; x++) {
      for (let y = 0; y < 38; y++) {
        this.add.image(x * 16 + 8, y * 16 + 8, 'tile_grass');
      }
    }

    this.player = this.physics.add.sprite(400, 300, 'player');
    this.player.setCollideWorldBounds(true);
    this.cameras.main.startFollow(this.player);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({ up: 'W', left: 'A', down: 'S', right: 'D' });

    // Socket.io multiplayer
    this.socket = io(SOCKET_URL, { auth: { token } });
    this.socket.on('connect', () => {
      this.socket.emit('player:join', {
        username: user.username,
        x: this.player.x,
        y: this.player.y,
        mapId: 'town',
        sprite: 'hero_default',
      });
    });

    this.socket.on('players:current', (players) => {
      players.forEach((p) => this._addOtherPlayer(p));
    });

    this.socket.on('player:joined', (p) => this._addOtherPlayer(p));

    this.socket.on('player:moved', ({ socketId, x, y }) => {
      if (this.otherPlayers[socketId]) {
        this.otherPlayers[socketId].sprite.setPosition(x, y);
      }
    });

    this.socket.on('player:left', ({ socketId }) => {
      if (this.otherPlayers[socketId]) {
        this.otherPlayers[socketId].sprite.destroy();
        this.otherPlayers[socketId].label.destroy();
        delete this.otherPlayers[socketId];
      }
    });

    this.lastEmit = 0;
  }

  _addOtherPlayer({ socketId, username, x, y }) {
    const sprite = this.add.sprite(x, y, 'other_player');
    const label = this.add.text(x, y - 30, username, {
      fontSize: '10px',
      color: '#ffffff',
    }).setOrigin(0.5);
    this.otherPlayers[socketId] = { sprite, label };
  }

  update(time) {
    const vel = { x: 0, y: 0 };
    if (this.cursors.left.isDown || this.wasd.left.isDown) vel.x = -SPEED;
    else if (this.cursors.right.isDown || this.wasd.right.isDown) vel.x = SPEED;
    if (this.cursors.up.isDown || this.wasd.up.isDown) vel.y = -SPEED;
    else if (this.cursors.down.isDown || this.wasd.down.isDown) vel.y = SPEED;

    this.player.setVelocity(vel.x, vel.y);

    // Emit position ~10 times/sec
    if (time - this.lastEmit > 100 && (vel.x !== 0 || vel.y !== 0)) {
      this.socket.emit('player:move', { x: this.player.x, y: this.player.y });
      this.lastEmit = time;
    }
  }

  shutdown() {
    this.socket?.disconnect();
  }
}
