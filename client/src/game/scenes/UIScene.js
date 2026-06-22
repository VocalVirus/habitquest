import Phaser from 'phaser';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene', active: true });
  }

  async create() {
    try {
      const { data: char } = await axios.get(`${API}/characters/me`);
      this._drawStats(char);
    } catch {
      // Not authenticated yet — skip
    }
  }

  _drawStats(char) {
    const pad = 12;
    const panel = this.add.rectangle(pad, pad, 160, 120, 0x000000, 0.6).setOrigin(0);
    const stats = [
      `Lv.${char.level}  ${this.registry.get('context').user.username}`,
      `STR ${char.strength}`,
      `INT ${char.intelligence}`,
      `AGI ${char.agility}`,
      `VIT ${char.vitality}`,
    ];
    stats.forEach((line, i) => {
      this.add.text(pad + 8, pad + 8 + i * 20, line, {
        fontSize: '12px',
        color: '#ffffff',
        fontFamily: 'monospace',
      });
    });
  }
}
