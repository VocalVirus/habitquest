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
    const col1 = [
      `Lv.${char.level}  ${this.registry.get('context').user.username}`,
      `STR  ${char.strength}`,
      `AGI  ${char.agility}`,
      `VIT  ${char.vitality}`,
      `CON  ${char.constitution}`,
    ];
    const col2 = [
      `💰 ${char.gold}g`,
      `INT  ${char.intelligence}`,
      `WIS  ${char.wisdom}`,
      `FOC  ${char.focus}`,
    ];

    this.add.rectangle(pad, pad, 260, 110, 0x000000, 0.65).setOrigin(0);

    col1.forEach((line, i) => {
      this.add.text(pad + 8, pad + 8 + i * 20, line, {
        fontSize: '11px', color: i === 0 ? '#ffd700' : '#ffffff', fontFamily: 'monospace',
      });
    });

    col2.forEach((line, i) => {
      this.add.text(pad + 138, pad + 8 + i * 20, line, {
        fontSize: '11px', color: i === 0 ? '#ffd700' : '#ffffff', fontFamily: 'monospace',
      });
    });
  }
}
