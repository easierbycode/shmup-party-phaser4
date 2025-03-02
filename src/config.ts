
import { WIDTH, HEIGHT } from './constants.ts';
import { WeaponPlugin } from './weapons/weapon-plugin/index.ts';


// Game Configuration
let config = {
    scale: {
        mode: Phaser.Scale.ENVELOP
    },
    backgroundColor: "#000000",
    width: WIDTH,
    height: HEIGHT,
    physics: {
        default: "arcade",
        arcade: {
            debug: new URL(window.location.href).searchParams.get('debug') == 1,
            gravity: { x: 0, y: 0 }
        }
    },
    input: {
        gamepad: true
    },
    render: {
        pixelArt: true
    },
    plugins: {
        scene: [
            { key: 'WeaponPlugin', plugin: WeaponPlugin, mapping: 'weapons' }
        ]
    }
};


export default config;