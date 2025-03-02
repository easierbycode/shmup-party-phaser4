import { GameScene } from './game-scene.ts';
import { Bullet, Weapon, WeaponPlugin, consts } from './weapons/weapon-plugin/index.ts';
import DemoScene from './scenes/demo-scene';

const config = {
    type: Phaser.AUTO,
    title: 'shmup-party-phaser4',
    parent: 'game-container',
    width: 1680,
    height: 1050,
    // width: 1920,
    // height: 1080,
    pixelArt: true,
    scene: [
        GameScene
    ],
    scale: {
        // mode: Phaser.Scale.FIT,
        // autoCenter: Phaser.Scale.CENTER_BOTH

        mode: Phaser.Scale.ENVELOP
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            // debug: true
        }
    },
    input: {
        gamepad: true
    },
    plugins: {
        scene: [
            { key: 'WeaponPlugin', plugin: WeaponPlugin, mapping: 'weapons' }
        ]
    }
}

// Add the DemoScene to the game configuration
if (config.scene) {
    config.scene.push(DemoScene);
} else {
    config.scene = [DemoScene];
}

// Create the game with the updated config
const game = new Phaser.Game(config);
