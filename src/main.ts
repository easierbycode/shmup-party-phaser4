import { GameScene } from './game-scene.ts';
import { Bullet, Weapon, WeaponPlugin, consts } from './weapons/weapon-plugin/index.ts';
import DemoScene from './scenes/demo-scene';
import { initTwinStick } from './twin-stick.ts';

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
        DemoScene,  // Make DemoScene the first scene to load
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

// Create the game with the updated config
const game = new Phaser.Game(config);

// Advertise Twin-Stick mode (default ON) to a mounting cmg launcher and follow
// its Guide-OSD toggle. Streamed/standalone runs synthesize the mode in Player
// via readDpad()/faceAim(); inside the launcher's same-origin cache the pad
// arrives with the sticks already synthesized.
initTwinStick(true);
