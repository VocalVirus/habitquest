import Phaser from 'phaser';
import { TownScene } from './scenes/TownScene.js';
import { UIScene } from './scenes/UIScene.js';
import { InteriorScene } from './scenes/InteriorScene.js';

export function createGame(parent, context) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: window.innerWidth,
    height: window.innerHeight,
    pixelArt: true,
    backgroundColor: '#1a1a2e',
    physics: {
      default: 'arcade',
      arcade: { gravity: { y: 0 }, debug: false },
    },
    scene: [TownScene, InteriorScene, UIScene],
    callbacks: {
      preBoot: (game) => {
        game.registry.set('context', context);
      },
    },
  });
}
