import BaseEntity from './game-objects/base-entity.ts';
import Zombie from './game-objects/zombie.ts';
import Alien from './game-objects/alien.ts';
import Player from './game-objects/player.ts'; // Import the Player class
import { Bullet, Weapon, WeaponPlugin, consts } from './weapons/weapon-plugin/index.ts';
import BloodSplatter from './game-objects/blood-splatter.ts';
import EvilBrain from './game-objects/evil-brain.ts';
import config from './config.ts';

import { FOLLOW_LERP_X, FOLLOW_LERP_Y, HEIGHT, WIDTH, ZOOM_LERP, ZOOM_MAX, ZOOM_MIN } from './constants.ts';


// Wave and level management
class WaveManager {
    constructor(scene) {
        this.scene = scene;
        this.currentWave = 0;
        this.enemiesRemaining = 0;
        this.enemyList = []; // Array of enemy wave arrays
        this.waveSpawned = false;
        this.bossSpawned = false;
    }
    
    loadLevel(levelData) {
        this.enemyList = levelData.enemyList;
        this.currentWave = 0;
        this.waveSpawned = false;
        this.bossSpawned = false;
        
        // Start the first wave
        this.startNextWave();
    }
    
    startNextWave() {
        if (this.currentWave >= this.enemyList.length) {
            if (!this.bossSpawned) {
                this.spawnBoss();
                this.bossSpawned = true;
            }
            return;
        }
        
        const wave = this.enemyList[this.currentWave];
        this.enemiesRemaining = wave.length;
        this.waveSpawned = true;
        
        // Display wave number
        this.scene.showWaveText(`Wave ${this.currentWave + 1}`);
        
        // Spawn enemies
        for (const enemyData of wave) {
            this.spawnEnemy(enemyData);
        }
        
        this.currentWave++;
    }
    
    spawnEnemy(enemyData) {
        const { type, x, y, health, speed } = enemyData;
        
        // Create the enemy based on type
        let enemy;
        switch (type) {
            case 'zombie':
                enemy = new Zombie(this.scene, x, y);
                break;
            case 'alien':
                enemy = new Alien(this.scene, x, y, 'enemy-fast');
                enemy.moveSpeed = speed || 150;
                break;
            // Add more enemy types as needed
        }
        
        if (enemy) {
            if (health) enemy.health = health;
            this.scene.baddies.add(enemy);
            
            // Listen for enemy destruction
            enemy.on('destroy', () => {
                this.enemiesRemaining--;
                
                // Check if wave is complete (90% killed)
                if (this.enemiesRemaining <= this.enemyList[this.currentWave - 1].length * 0.1) {
                    this.waveComplete();
                }
            });
        }
    }
    
    waveComplete() {
        if (this.currentWave < this.enemyList.length) {
            // Brief delay before next wave
            this.scene.time.addEvent({
                delay: 2000,
                callback: () => this.startNextWave()
            });
        } else if (!this.bossSpawned) {
            this.spawnBoss();
            this.bossSpawned = true;
        }
    }
    
    spawnBoss() {
        // Display boss warning
        this.scene.showWaveText('BOSS INCOMING!', 0xff0000);
        
        // Spawn boss after delay
        this.scene.time.addEvent({
            delay: 3000,
            callback: () => {
                new EvilBrain(
                    this.scene, 
                    (config.width / 2) - (48 * 4), 
                    (config.height / 2) - (57 * 4) - 100
                );
            }
        });
    }
}

// Game Scenes
class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }
    
    preload() {
        // Load loading screen assets
        this.load.image('logo', 'assets/logo.png');
    }
    
    create() {
        this.scene.start('PreloadScene');
    }
}

class PreloadScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PreloadScene' });
    }
    
    preload() {
        // Display loading progress
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Add logo
        this.add.image(width / 2, height / 2 - 100, 'logo');
        
        // Create loading bar
        let progressBar = this.add.graphics();
        let progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(width / 2 - 160, height / 2, 320, 50);
        
        // Loading text
        let loadingText = this.add.text(width / 2, height / 2 - 20, 'Loading...', {
            fontFamily: 'Arial',
            fontSize: '20px',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        // Percent text
        let percentText = this.add.text(width / 2, height / 2 + 25, '0%', {
            fontFamily: 'Arial',
            fontSize: '18px',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        // Update loading bar
        this.load.on('progress', (value) => {
            progressBar.clear();
            progressBar.fillStyle(0x00ff00, 1);
            progressBar.fillRect(width / 2 - 150, height / 2 + 10, 300 * value, 30);
            percentText.setText(parseInt(value * 100) + '%');
        });
        
        this.load.on('complete', () => {
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();
            percentText.destroy();
        });
        
        // Load all game assets
        this.loadAssets();
    }
    
    loadAssets() {
        // Set base URL for assets
        // this.load.baseURL = "https://raw.githubusercontent.com/easierbycode/shmup-party-phaser3/master/src/assets/images/";
        this.load.baseURL = "/assets/";
        
        // Load atlases
        this.load.atlas(
            'alien',
            'alien.png',
            'alien.json'
        );
        
        this.load.atlas(
            'zombie',
            'zombie.png',
            'zombie.json'
        );
        
        // Load images
        this.load.image("bg", "scorched-earth.png");
        this.load.image("player", "player.png");
        // this.load.image("enemy", "monster-1.png");
        // this.load.image("enemy-fast", "monster-2.png");
        this.load.image("healthpack", "powerup-medikit.png");
        
        // Load powerup images
        this.load.image("giantMode", "powerup-weapon-boost.png");
        this.load.image("fireblast", "powerup-fireblast.png");
        this.load.image("explosion-0", "explosion-0.png");
        this.load.image("explosion-1", "explosion-1.png");
        this.load.image("explosion-circle", "explosion-circle.png");
        this.load.image("explosion-skull", "explosion-skull.png");
        this.load.image("nuke", "powerup-nuke.png");
        this.load.image("speed", "powerup-speed.png");
        
        // Load spritesheets
        this.load.spritesheet(
            'barrier',
            'barrier.png',
            { frameWidth: 80, frameHeight: 41 }
        );

        this.load.spritesheet(
            'blood-splat',
            'blood-splat.png',
            { frameWidth: 137, frameHeight: 136 }
        );
        
        this.load.spritesheet("bullet", "bullet.png", {
            frameHeight: 11,
            frameWidth: 12
        });

        this.load.spritesheet(
            'ciga-bullet',
            'ciga-bullet.png',
            { frameWidth: 9, frameHeight: 12 }
        );
        this.load.spritesheet(
            'ciga-bullet.death',
            'ciga-bullet-death.png',
            { frameWidth: 9, frameHeight: 11 }
        );

        this.load.spritesheet(
            'ion-bullet',
            'ion.png',
            { frameWidth: 48, frameHeight: 30 }
        );
        this.load.spritesheet(
            'ion-bullet-impact',
            'ion-impact.png',
            { frameWidth: 18, frameHeight: 22 }
        );

        this.load.spritesheet(
            'pacman-bullet',
            'pacman-spritesheet.png',
            { frameWidth: 32, frameHeight: 32 }
        );
        this.load.spritesheet(
            'pac-ghost',
            'pac-ghost.png',
            { frameWidth: 13, frameHeight: 14 }
        );

        this.load.spritesheet(
            'smoke',
            'smoke.png',
            { frameWidth: 26, frameHeight: 33 }
        );
        
        this.load.spritesheet("wreckingBall", "chomp-ball.png", {
            frameHeight: 32,
            frameWidth: 32
        });
        
        // Load boss assets
        this.load.spritesheet("evil-brain-bottom", "evil-brain-bottom.png", {
            frameHeight: 56,
            frameWidth: 80
        });
        
        this.load.spritesheet("evil-brain-bullet", "evil-brain-bullet.png", {
            frameHeight: 16,
            frameWidth: 16
        });
        
        this.load.spritesheet("evil-brain-bullet-prefire", "evil-brain-bullet-prefire.png", {
            frameHeight: 16,
            frameWidth: 16
        });
        
        this.load.spritesheet("evil-brain-eye", "evil-brain-eye.png", {
            frameHeight: 10,
            frameWidth: 22
        });
        
        this.load.spritesheet("evil-brain-eye-explode", "eye-explode.png", {
            frameHeight: 67,
            frameWidth: 61
        });
        
        this.load.spritesheet("evil-brain-top", "evil-brain-top.png", {
            frameHeight: 58,
            frameWidth: 96
        });
        
        this.load.spritesheet("ion-bullet-impact", "ion-impact.png", {
            frameHeight: 22,
            frameWidth: 18
        });
        
        // UI elements
        this.load.image("comp-button", "gfx/comp-button.png");
        this.load.image("listbox-panel", "gfx/listbox-panel.png");
        this.load.image("listbox-line-selector", "gfx/listbox-line-selector.png");
        this.load.image("selector-square", "gfx/selector-square.png");
        this.load.image("perk-icon-speed", "perk-speed.png");
        this.load.image("perk-icon-fireRate", "perk-fire-rate.png");
        this.load.image("perk-icon-damage", "perk-damage.png");
    }
    
    create() {
        this.scene.start('MenuScene');
    }
}

const PERK_OPTIONS = [
    { type: 'speed', name: 'Speed Boost', description: '20% movement speed increase' },
    { type: 'fireRate', name: 'Rapid Fire', description: '20% faster firing rate' },
    { type: 'damage', name: 'Heavy Hitter', description: '50% damage increase' }
];

function createPerkSelectionCard(scene, perk, x, y, onSelect) {
    const cardWidth = 279;
    const container = scene.add.container(x, y);
    let selected = false;

    const panel = scene.add.image(0, 0, 'listbox-panel').setOrigin(0.5);
    const iconFrame = scene.add.image(0, -76, 'selector-square').setScale(0.62);
    const icon = scene.add.image(0, -76, `perk-icon-${perk.type}`).setScale(1.18);
    const lineSelector = scene.add.image(0, 38, 'listbox-line-selector')
        .setOrigin(0.5)
        .setAlpha(0.18);

    const nameText = scene.add.text(0, 38, perk.name.toUpperCase(), {
        fontFamily: 'Arial Black, Impact, sans-serif',
        fontSize: '22px',
        color: '#d8fbff',
        stroke: '#041820',
        strokeThickness: 2
    }).setOrigin(0.5);

    if (nameText.width > cardWidth * 0.76) {
        nameText.setScale((cardWidth * 0.76) / nameText.width);
    }

    const descText = scene.add.text(0, 78, perk.description, {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#9bcbd7',
        align: 'center',
        wordWrap: { width: cardWidth - 54 }
    }).setOrigin(0.5, 0);

    panel.setInteractive({ useHandCursor: true });

    const setActiveState = (isActive) => {
        lineSelector.setAlpha(isActive ? 1 : 0.18);
        panel.setTint(isActive ? 0x9fefff : 0xffffff);
        iconFrame.setTint(isActive ? 0xffe17a : 0xffffff);
        nameText.setColor(isActive ? '#ffffff' : '#d8fbff');
    };

    container.setSelected = (value) => {
        selected = value;
        setActiveState(selected);
        return container;
    };

    panel
        .on('pointerover', () => setActiveState(true))
        .on('pointerout', () => setActiveState(selected))
        .on('pointerdown', () => {
            container.setSelected(true);
            onSelect(perk, container);
        });

    // Exposed so keyboard/gamepad nav can keep its cursor in sync with mouse hover.
    container.focusTarget = panel;

    container.add([panel, iconFrame, icon, lineSelector, nameText, descText]);

    return container;
}

// Adds gamepad + keyboard navigation to a horizontal row of perk cards.
// `padIndex` restricts gamepad input to a single physical pad (the player who
// levelled up); pass `null` to accept any connected pad. `onConfirm(index)` is
// invoked once with the chosen card index. Returns an idempotent cleanup().
function setupPerkGamepadNav(scene, padIndex, cards, onConfirm) {
    let index = 0;
    let confirmed = false;
    // Require the stick to return to neutral once before the first analog nav step,
    // so a movement stick still held from gameplay doesn't scrub the selection on open.
    let stickReady = false;

    const focus = (i) => {
        index = Phaser.Math.Wrap(i, 0, cards.length);
        cards.forEach((card, j) => card.setSelected(j === index));
    };

    const confirm = () => {
        if (confirmed) return;
        confirmed = true;
        cleanup();
        onConfirm(index);
    };

    const onPadDown = (pad, button) => {
        if (padIndex != null && pad.index !== padIndex) return;
        switch (button.index) {
            case 14: focus(index - 1); break; // d-pad left
            case 15: focus(index + 1); break; // d-pad right
            case 0:  confirm(); break;        // A / cross
        }
    };

    const onKeyLeft = () => focus(index - 1);
    const onKeyRight = () => focus(index + 1);
    const onKeyConfirm = () => confirm();

    const onUpdate = () => {
        // Analog left-stick (horizontal) navigation with a release debounce.
        const pad = padIndex != null
            ? scene.input.gamepad.getPad(padIndex)
            : scene.input.gamepad.pad1;
        const x = pad ? pad.leftStick.x : 0;
        if (stickReady && Math.abs(x) > 0.5) {
            focus(index + (x > 0 ? 1 : -1));
            stickReady = false;
        } else if (Math.abs(x) < 0.3) {
            stickReady = true;
        }
    };

    const cleanup = () => {
        scene.input.gamepad.off('down', onPadDown);
        scene.input.keyboard.off('keydown-LEFT', onKeyLeft);
        scene.input.keyboard.off('keydown-RIGHT', onKeyRight);
        scene.input.keyboard.off('keydown-ENTER', onKeyConfirm);
        scene.input.keyboard.off('keydown-SPACE', onKeyConfirm);
        scene.events.off('update', onUpdate);
    };

    scene.input.gamepad.on('down', onPadDown);
    scene.input.keyboard.on('keydown-LEFT', onKeyLeft);
    scene.input.keyboard.on('keydown-RIGHT', onKeyRight);
    scene.input.keyboard.on('keydown-ENTER', onKeyConfirm);
    scene.input.keyboard.on('keydown-SPACE', onKeyConfirm);
    scene.events.on('update', onUpdate);

    // Keep the nav cursor in sync with mouse hover so confirming always targets the
    // highlighted card (these listeners die with the cards when the overlay closes).
    cards.forEach((card, i) => {
        if (card.focusTarget) card.focusTarget.on('pointerover', () => focus(i));
    });

    focus(0);
    return cleanup;
}

class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }
    
    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Background
        this.add.tileSprite(0, 0, width, height, "bg").setOrigin(0);
        
        // Initialize attract mode (before UI elements so it stays in background)
        this.setupAttractMode();
        
        // Game title
        this.add.image(width / 2, height * 0.12, 'logo')
            .setOrigin(0.5)
            .setDepth(20);
        
        // Menu buttons (navigable by mouse, keyboard, and gamepad)
        const buttonLeft = 0;
        const firstButtonY = height * 0.42;
        const buttonGap = 180;

        this.menuButtons = [];
        this.menuIndex = 0;

        this.menuButtons.push(this.createButton(buttonLeft, firstButtonY, 'Campaign Mode', () => {
            this.scene.start('CampaignScene');
        }));

        this.menuButtons.push(this.createButton(buttonLeft, firstButtonY + buttonGap, 'Survival Mode', () => {
            this.scene.start('SurvivalScene');
        }));

        this.menuButtons.push(this.createButton(buttonLeft, firstButtonY + buttonGap * 2, 'Options', () => {
            // Options scene would go here
        }));

        // Highlight the first entry and wire up keyboard + gamepad navigation
        this.focusMenuButton(0);
        this.setupMenuInput();
    }
    
    setupAttractMode() {
        // Create game groups that enemies might need
        this.baddies = this.add.group();
        this.bullets = this.physics.add.group();
        this.enemyBullets = this.physics.add.group(); // Enemy bullets group
        this.players = this.add.group(); // Group for players (targets)
        this.powerups = this.physics.add.group(); // Add missing powerups group
        
        // Add any other collections/properties that enemies might be looking for
        this.targets = this.add.group(); // Target group that aliens might be searching
        
        // Create plugins if needed
        if (!this.weapons) {
            this.plugins.installScenePlugin('WeaponPlugin', WeaponPlugin, 'weapons', this);
        }
        
        // Create animations needed for the attract mode
        this.createAttractModeAnimations();
        
        // Create automated demo player
        this.createDemoPlayer();
        
        // Add player to players/targets group
        this.players.add(this.demoPlayer);
        this.targets.add(this.demoPlayer);
        
        // Start spawning enemies
        this.spawnAttractModeEnemies();
        
        // Set up collisions between enemy bullets and player
        this.physics.add.overlap(this.enemyBullets, this.players, (bullet, player) => {
            // In attract mode, let's make the player invincible
            bullet.setVisible(false);
            bullet.setActive(false);
        });
    }
    
    // Add a new method to create animations
    createAttractModeAnimations() {
        // Check if animations already exist
        if (!this.anims.exists('blood-splat.default')) {
            this.anims.create({
                key: 'blood-splat.default',
                frames: this.anims.generateFrameNumbers('blood-splat', { start: 0, end: 4 }),
                frameRate: 12,
                repeat: 0
            });
        }
        
        // Wrecking ball animation
        if (!this.anims.exists('wreckingBall.default')) {
            this.anims.create({
                key: 'wreckingBall.default',
                frames: this.anims.generateFrameNumbers('wreckingBall', { start: 0, end: 5 }),
                frameRate: 12,
                repeat: -1
            });
        }
    }
    
    createDemoPlayer() {
        // Create a fake gamepad object with basic functionality
        const fakeGamepad = {
            vibration: null,
            left: false,
            right: false,
            up: false,
            down: false,
            leftStick: { x: 0, y: 0 },
            rightStick: { x: 0, y: 0 },
            buttons: [{ pressed: false }, { pressed: false }],
            // Add missing event emitter methods
            on: () => {}, // No-op function to prevent errors
            off: () => {},
            once: () => {},
            emit: () => {}
        };
        
        // Create the demo player with slightly lower depth so UI appears above it
        this.demoPlayer = new Player(fakeGamepad, this, 
                                    this.cameras.main.width / 2,
                                    this.cameras.main.height / 2 + 200);
        this.demoPlayer.setDepth(5);
        
        // Make the demo player automatically move and shoot
        this.time.addEvent({
            delay: 100,
            callback: this.updateDemoPlayerInput,
            callbackScope: this,
            loop: true
        });
    }
    
    updateDemoPlayerInput() {
        // Simulate joystick movement for demo player
        const gamepad = this.demoPlayer.gamepad;
        
        // Random movement patterns
        if (Math.random() < 0.1) {
            gamepad.leftStick.x = Phaser.Math.FloatBetween(-0.8, 0.8);
            gamepad.leftStick.y = Phaser.Math.FloatBetween(-0.8, 0.8);
        }
        
        // Always aim toward nearest enemy
        const nearestEnemy = this.findNearestEnemy();
        if (nearestEnemy) {
            // Calculate angle to enemy
            const angle = Phaser.Math.Angle.Between(
                this.demoPlayer.x, this.demoPlayer.y,
                nearestEnemy.x, nearestEnemy.y
            );
            
            // Set right stick direction (for aiming and shooting)
            gamepad.rightStick.x = Math.cos(angle);
            gamepad.rightStick.y = Math.sin(angle);
        } else {
            // No enemies, aim in different directions
            const time = this.time.now / 1000;
            gamepad.rightStick.x = Math.cos(time);
            gamepad.rightStick.y = Math.sin(time);
        }
    }
    
    findNearestEnemy() {
        let nearestEnemy = null;
        let minDistance = Number.MAX_VALUE;
        
        this.baddies.getChildren().forEach(baddie => {
            if (baddie.active) {
                const distance = Phaser.Math.Distance.Between(
                    this.demoPlayer.x, this.demoPlayer.y,
                    baddie.x, baddie.y
                );
                
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestEnemy = baddie;
                }
            }
        });
        
        return nearestEnemy;
    }
    
    spawnAttractModeEnemies() {
        // Periodically spawn waves of enemies
        this.time.addEvent({
            delay: 5000,
            callback: this.spawnEnemyWave,
            callbackScope: this,
            loop: true
        });
        
        // Initial spawn
        this.spawnEnemyWave();
    }
    
    spawnEnemyWave() {
        // Spawn a small wave of enemies
        const count = Phaser.Math.Between(3, 8);
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        for (let i = 0; i < count; i++) {
            // Determine spawn position (off-screen)
            let x, y;
            const side = Phaser.Math.Between(0, 3);
            
            switch(side) {
                case 0: // top
                    x = Phaser.Math.Between(0, width);
                    y = -50;
                    break;
                case 1: // right
                    x = width + 50;
                    y = Phaser.Math.Between(0, height);
                    break;
                case 2: // bottom
                    x = Phaser.Math.Between(0, width);
                    y = height + 50;
                    break;
                case 3: // left
                    x = -50;
                    y = Phaser.Math.Between(0, height);
                    break;
            }
            
            // Create either zombie or alien
            if (Math.random() < 0.5) {
                const zombie = new Zombie(this, x, y);
                zombie.setDepth(3);
                this.baddies.add(zombie);
            } else {
                const alien = new Alien(this, x, y);
                alien.target = this.demoPlayer; // Ensure alien has a target
                alien.moveSpeed = 80; // Slower for attract mode
                alien.setDepth(3);
                this.baddies.add(alien);
            }
        }
    }
    
    createButton(x, y, text, callback) {
        const scale = 0.74;
        const panelCenterX = x + 1050.5 * scale;
        const panelWidth = 509 * scale;
        const panelHeight = 86 * scale;

        const button = this.add.image(x, y, 'comp-button')
            .setOrigin(0, 0.5)
            .setScale(scale)
            .setDepth(20);

        const label = this.add.text(panelCenterX, y, text.toUpperCase(), {
            fontFamily: 'Arial Black, Impact, sans-serif',
            fontSize: '34px',
            fontStyle: 'bold',
            color: '#145a70',
            stroke: '#061c28',
            strokeThickness: 2
        }).setOrigin(0.5).setDepth(21);

        if (label.width > panelWidth * 0.82) {
            label.setScale((panelWidth * 0.82) / label.width);
        }

        const hitArea = this.add.zone(panelCenterX, y, panelWidth, panelHeight)
            .setOrigin(0.5)
            .setDepth(22)
            .setInteractive({ useHandCursor: true });

        const setFocused = (isFocused) => {
            if (isFocused) {
                button.setTint(0xbfffff);
                label.setColor('#1a7690');
            } else {
                button.clearTint();
                label.setColor('#145a70');
            }
        };

        const control = { button, label, hitArea, setFocused, activate: callback };

        hitArea
            .on('pointerover', () => this.focusMenuButton(this.menuButtons.indexOf(control)))
            .on('pointerdown', callback);

        return control;
    }

    focusMenuButton(index) {
        if (!this.menuButtons || this.menuButtons.length === 0) return;
        this.menuIndex = Phaser.Math.Wrap(index, 0, this.menuButtons.length);
        this.menuButtons.forEach((btn, i) => btn.setFocused(i === this.menuIndex));
    }

    activateMenuSelection() {
        const btn = this.menuButtons && this.menuButtons[this.menuIndex];
        if (btn && typeof btn.activate === 'function') btn.activate();
    }

    setupMenuInput() {
        // Gamepads that have joined the demo as players are tracked here so their
        // movement doesn't also scrub the menu cursor.
        this.joinedPads = new Set();
        // Require the stick to reach neutral once before the first analog nav step.
        this.menuStickReady = false;

        // Keyboard navigation
        this.input.keyboard.on('keydown-UP', () => this.focusMenuButton(this.menuIndex - 1));
        this.input.keyboard.on('keydown-DOWN', () => this.focusMenuButton(this.menuIndex + 1));
        this.input.keyboard.on('keydown-ENTER', () => this.activateMenuSelection());
        this.input.keyboard.on('keydown-SPACE', () => this.activateMenuSelection());

        // Gamepad navigation + "press L1 + R1 to join" handling
        this.input.gamepad.on('down', this.onMenuPadDown, this);
    }

    onMenuPadDown(pad, button) {
        const idx = button.index;

        // L1 (4) + R1 (5) chord during the demo adds another player to the party.
        if ((idx === 4 || idx === 5) &&
            pad.buttons[4] && pad.buttons[4].pressed &&
            pad.buttons[5] && pad.buttons[5].pressed) {
            this.tryAddPlayer(pad);
            return;
        }

        // Pads already controlling a player drive their character, not the menu —
        // so an in-demo player tapping A won't accidentally launch a game mode.
        if (this.joinedPads.has(pad.index)) return;

        // South / A button confirms the highlighted menu entry.
        if (idx === 0) {
            this.activateMenuSelection();
            return;
        }

        // D-pad up / down move the menu cursor.
        if (idx === 12) this.focusMenuButton(this.menuIndex - 1);
        else if (idx === 13) this.focusMenuButton(this.menuIndex + 1);
    }

    tryAddPlayer(pad) {
        // One player per physical gamepad, capped so the attract screen stays sane.
        const MAX_DEMO_PLAYERS = 4;
        if (this.joinedPads.has(pad.index)) return;
        if (this.players.getLength() >= MAX_DEMO_PLAYERS) return;

        this.joinedPads.add(pad.index);
        this.addSecondPlayer(pad);
    }

    addSecondPlayer(pad) {
        // Spawn a real, gamepad-controlled player next to the demo player.
        const offset = this.players.getLength() * 90;
        const newPlayer = new Player(
            pad,
            this,
            Phaser.Math.Clamp(this.demoPlayer.x + 120 + offset, 80, this.cameras.main.width - 80),
            this.demoPlayer.y
        );
        newPlayer.setDepth(5);

        this.players.add(newPlayer);
        this.targets.add(newPlayer);

        // The joined human gets keyboard control + auto-aim too (arrows for the first
        // to join, WASD for the next), so they can play the demo via the cabinet shim.
        newPlayer.enableKeyboardControl(Math.max(0, this.joinedPads.size - 1));

        // Rumble + on-screen confirmation that a player joined.
        if (pad.vibration && typeof pad.vibration.playEffect === 'function') {
            pad.vibration.playEffect('dual-rumble', {
                startDelay: 0,
                duration: 200,
                weakMagnitude: 0.6,
                strongMagnitude: 0.4
            });
        }

        const playerNumber = this.players.getLength();
        const joinText = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height * 0.78,
            `PLAYER ${playerNumber} JOINED`,
            {
                fontFamily: 'Arial Black, Impact, sans-serif',
                fontSize: '40px',
                color: '#9fefff',
                stroke: '#041820',
                strokeThickness: 4
            }
        ).setOrigin(0.5).setDepth(30);

        this.tweens.add({
            targets: joinText,
            alpha: 0,
            y: joinText.y - 60,
            duration: 1800,
            ease: 'Power2',
            onComplete: () => joinText.destroy()
        });
    }
    
    update() {
        // Update enemy targeting toward player
        this.baddies.getChildren().forEach(enemy => {
            if (enemy.active && this.demoPlayer.active) {
                const angle = Phaser.Math.Angle.Between(
                    enemy.x, enemy.y,
                    this.demoPlayer.x, this.demoPlayer.y
                );
                
                // Move toward player
                const speed = enemy.moveSpeed || 100;
                enemy.body.velocity.x = Math.cos(angle) * speed;
                enemy.body.velocity.y = Math.sin(angle) * speed;
                
                // Set rotation to face player
                enemy.rotation = angle;
                
                // Clean up off-screen enemies
                if (enemy.x < -100 || enemy.x > this.cameras.main.width + 100 ||
                    enemy.y < -100 || enemy.y > this.cameras.main.height + 100) {
                    enemy.destroy();
                }
            }
        });
        
        // Process every player's bullet collisions with enemies (demo player plus
        // any humans who joined via L1 + R1)
        this.players.getChildren().forEach(player => {
            if (!player.active) return;

            // Loop through all the player's weapons to check their bullets
            player.weapons.forEach(weapon => {
                if (weapon.bullets) {
                    const activeBullets = weapon.bullets.getChildren().filter(bullet =>
                        bullet.active && bullet.visible);

                    if (activeBullets.length > 0) {
                        this.physics.overlap(activeBullets, this.baddies, (bullet, baddie) => {
                            if (!baddie.visible || baddie.blinking) return;

                            // Handle bullet behavior
                            if (typeof bullet.damage === 'function') {
                                bullet.damage(bullet, baddie);
                            } else {
                                bullet.setVisible(false);
                                bullet.setActive(false);
                            }

                            // Create blood splat effect
                            const bloodSplat = this.add.sprite(baddie.x, baddie.y, 'blood-splat');
                            bloodSplat.setDepth(baddie.depth - 1);
                            bloodSplat.play('blood-splat.default');
                            bloodSplat.once('animationcomplete', () => {
                                bloodSplat.destroy();
                            });

                            // FORCE DESTROY enemy - don't rely on damage method
                            // for attract mode, we just want visual effect
                            baddie.onDestroy();
                            baddie.destroy();
                        });
                    }
                }
            });

            // Collect powerups with a one-shot per-frame test of this player sprite
            // against the powerups physics group, rather than a per-spawn persistent
            // collider (which would leak one collider per spawned powerup).
            if (this.powerups.getLength() > 0) {
                this.physics.overlap(player, this.powerups, (pl, powerup) => {
                    if (typeof pl.playerVsPowerup === 'function') {
                        pl.playerVsPowerup(pl, powerup);
                    }
                });
            }
        });
        
        // Create occasional powerups for visual interest
        if (Math.random() < 0.001) {
            const powerupTypes = ["giantMode", "fireblast", "speed"];
            const randomType = Phaser.Utils.Array.GetRandom(powerupTypes);
            
            const x = Phaser.Math.Between(100, this.cameras.main.width - 100);
            const y = Phaser.Math.Between(100, this.cameras.main.height - 100);
            
            const powerup = this.physics.add.image(x, y, randomType);
            powerup.setDepth(2);
            // Collected via the one-shot per-player overlap in the players loop above.
            this.powerups.add(powerup);
        }

        // Analog left-stick (vertical) menu navigation with a release debounce.
        // Uses the first connected pad that hasn't joined the demo as a player.
        const navPad = this.input.gamepad.getAll().find(p => p && !this.joinedPads.has(p.index));
        const stickY = navPad ? navPad.leftStick.y : 0;
        if (this.menuStickReady && Math.abs(stickY) > 0.5) {
            this.focusMenuButton(this.menuIndex + (stickY > 0 ? 1 : -1));
            this.menuStickReady = false;
        } else if (Math.abs(stickY) < 0.3) {
            this.menuStickReady = true;
        }
    }

    // This method would normally show a UI for perk selection
    // In demo mode, it just selects a random perk after a delay
    showPerkSelection(player) {
        console.log('MENU: Showing perk selection UI');
        
        // Pause player input during perk selection
        player.inputEnabled = false;
        
        // Create a semi-transparent backdrop (full screen overlay)
        const backdrop = this.add.rectangle(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2,
            this.cameras.main.width,
            this.cameras.main.height,
            0x000000, 0.7
        );
        
        // Title
        const title = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height / 3,
            'LEVEL UP! Choose a perk:',
            {
                fontFamily: 'Arial',
                fontSize: '36px',
                color: '#ffffff'
            }
        ).setOrigin(0.5);
        
        // Create perk selection buttons
        const buttons = [];
        let selectionFinalized = false;
        PERK_OPTIONS.forEach((perk, index) => {
            const x = this.cameras.main.width / 2 + (index - 1) * 320;
            const y = this.cameras.main.height / 2 + 40;

            const container = createPerkSelectionCard(this, perk, x, y, (selectedPerk) => {
                if (selectionFinalized) return;
                selectionFinalized = true;
                player.applyPerk(selectedPerk.type);
                this.tweens.add({
                    targets: uiElements,
                    alpha: 0,
                    duration: 500,
                    onComplete: cleanupUI
                });
            });

            buttons.push(container);
            container.setDepth(25); // Make sure it appears above the attract mode
        });
        
        // Set high depths for UI elements to ensure they appear above attract mode
        backdrop.setDepth(24);
        title.setDepth(25);
        
        // Group all UI elements for easy cleanup
        const uiElements = [backdrop, title, ...buttons];
        
        // Define cleanup function
        const cleanupUI = () => {
            uiElements.forEach(element => element.destroy());
            player.inputEnabled = true;
        };
        
        // In demo mode, auto-select a perk after delay
        if (player.isDemoMode) {
            const randomDelay = Phaser.Math.Between(800, 1500);
            this.time.delayedCall(randomDelay, () => {
                if (selectionFinalized) return;
                selectionFinalized = true;

                // Pick a random perk
                const selectedPerk = PERK_OPTIONS[Phaser.Math.Between(0, PERK_OPTIONS.length - 1)];
                
                // Highlight the selected perk
                const selectedContainer = buttons[PERK_OPTIONS.indexOf(selectedPerk)];
                selectedContainer.setSelected(true);
                
                // Apply the perk and close the menu after a short delay
                this.time.delayedCall(500, () => {
                    player.applyPerk(selectedPerk.type);
                    
                    // Fade out and destroy the UI
                    this.tweens.add({
                        targets: uiElements,
                        alpha: 0,
                        duration: 500,
                        onComplete: cleanupUI
                    });
                });
            });
        }
    }
}

class GameHUD extends Phaser.Scene {
    constructor() {
        super({ key: 'GameHUD' });
        this.activeGameScene = null;
    }
    
    create() {
        this.waveText = this.add.text(this.cameras.main.width / 2, 100, '', {
            fontFamily: 'Arial',
            fontSize: '48px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);
        this.waveText.setAlpha(0);
        
        // Create player health displays
        this.healthDisplays = [];
        
        // Events from main scene. Remove first so a game-scene restart (which
        // re-launches this HUD on the same persistent emitter) doesn't stack handlers.
        this.events.off('showWaveText', this.showWaveText, this);
        this.events.off('updatePlayerHealth', this.updatePlayerHealth, this);
        this.events.off('showPerkSelection', this.showPerkSelection, this);
        this.events.on('showWaveText', this.showWaveText, this);
        this.events.on('updatePlayerHealth', this.updatePlayerHealth, this);
        this.events.on('showPerkSelection', this.showPerkSelection, this);
        
        // Store reference to the active game scene
        if (this.scene.isActive('CampaignScene')) {
            this.activeGameScene = 'CampaignScene';
        } else if (this.scene.isActive('SurvivalScene')) {
            this.activeGameScene = 'SurvivalScene';
        } else {
            this.activeGameScene = 'GameScene';
        }
    }
    
    showWaveText(text, color = 0xffffff) {
        this.waveText.setText(text);
        this.waveText.setColor(color ? color : '#ffffff');
        this.waveText.setAlpha(1);
        
        // Animation to fade out
        this.tweens.add({
            targets: this.waveText,
            alpha: 0,
            duration: 2000,
            ease: 'Power2',
            delay: 1500
        });
    }
    
    updatePlayerHealth(playerIndex, health, maxHealth) {
        // Make sure we have a health display for this player
        if (!this.healthDisplays[playerIndex]) {
            this.createHealthDisplay(playerIndex);
        }
        
        // Update the health display
        const display = this.healthDisplays[playerIndex];
        display.clear();
        
        // Background
        display.fillStyle(0x000000, 0.5);
        display.fillRect(0, 0, 200, 30);
        
        // Health bar
        display.fillStyle(0x00ff00, 1);
        const healthWidth = (health / maxHealth) * 190;
        display.fillRect(5, 5, healthWidth, 20);
    }
    
    createHealthDisplay(playerIndex) {
        const x = 20;
        const y = 20 + (playerIndex * 40);
        
        // Player indicator
        this.add.text(x, y, `P${playerIndex + 1}:`, {
            fontFamily: 'Arial',
            fontSize: '20px',
            color: '#ffffff'
        });
        
        // Health bar graphic
        this.healthDisplays[playerIndex] = this.add.graphics();
        this.healthDisplays[playerIndex].x = x + 50;
        this.healthDisplays[playerIndex].y = y;
    }
    
    showPerkSelection(player) {
        // Serialize selections: if two players level up at once, queue them and show
        // one overlay at a time so they don't stack overlays / nav listeners and so
        // the game scene stays paused until every pending selection is resolved.
        if (!this._perkQueue) this._perkQueue = [];
        this._perkQueue.push(player);
        if (!this._perkOpen) this._openNextPerkSelection();
    }

    _openNextPerkSelection() {
        if (this._perkQueue.length === 0) {
            if (this._perkOpen) {
                this._perkOpen = false;
                this.scene.resume(this.activeGameScene);
            }
            return;
        }

        const player = this._perkQueue.shift();

        // Pause the game scene once, on the first selection in the batch.
        if (!this._perkOpen) {
            this._perkOpen = true;
            this.scene.pause(this.activeGameScene);
        }

        // Create a semi-transparent backdrop
        const backdrop = this.add.rectangle(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2,
            this.cameras.main.width,
            this.cameras.main.height,
            0x000000, 0.7
        );

        // Title
        const title = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height / 3,
            'LEVEL UP! Choose a perk:',
            {
                fontFamily: 'Arial',
                fontSize: '36px',
                color: '#ffffff'
            }
        ).setOrigin(0.5);

        // Create perk selection buttons
        const buttons = [];
        let finalized = false;
        let cleanupNav = () => {};

        const finalize = (perkType) => {
            if (finalized) return;
            finalized = true;
            cleanupNav();

            player.applyPerk(perkType);

            backdrop.destroy();
            title.destroy();
            buttons.forEach(b => b.destroy());

            // Show the next queued selection, or resume the game once the queue drains.
            this._openNextPerkSelection();
        };

        PERK_OPTIONS.forEach((perk, index) => {
            const x = this.cameras.main.width / 2 + (index - 1) * 320;
            const y = this.cameras.main.height / 2 + 40;

            const container = createPerkSelectionCard(this, perk, x, y, (selectedPerk) => {
                finalize(selectedPerk.type);
            });

            buttons.push(container);
        });

        // Gamepad + keyboard navigation. The level-up player's pad drives it; if we
        // can't resolve a specific pad we accept any connected pad. This runs on the
        // (still-active) HUD scene, since the paused game scene won't poll input.
        const padIndex = player.gamepad && typeof player.gamepad.index === 'number'
            ? player.gamepad.index
            : null;
        cleanupNav = setupPerkGamepadNav(this, padIndex, buttons, (selectedIndex) => {
            finalize(PERK_OPTIONS[selectedIndex].type);
        });
    }
}

class GameScene extends Phaser.Scene {
    constructor(key = 'GameScene') {
        super(key);
    }
    
    preload() {
        // Additional runtime assets could be loaded here if needed
    }
    
    create() {
        // Initialize plugins
        if (!this.weapons) {
            this.plugins.installScenePlugin('WeaponPlugin', WeaponPlugin, 'weapons', this);
        }
        
        // Set up the level
        this.createBackground();
        
        // Create game groups
        this.baddies = this.add.group();
        this.players = this.physics.add.group();
        this.powerups = this.physics.add.group(); // physics group so player-vs-powerup overlap can collide
        this.bloodSplatters = this.add.group({ classType: BloodSplatter });

        // Level-restart bookkeeping. Players don't respawn individually; once every
        // player that joined is dead, the level restarts (see update()). These reset
        // on every (re)start because create() runs again on scene.restart().
        this.playersHaveSpawned = false;
        this.restarting = false;
        this._padPlayers = new Set();
        
        // Camera setup
        this.mid = new Phaser.Math.Vector2();
        this.cam = this.cameras.main.setBounds(0, 0, WIDTH, HEIGHT);
        this.physics.world.setBounds(0, 0, WIDTH, HEIGHT);
        
        // Start following the midpoint between players
        this.cam.startFollow(this.mid, true, FOLLOW_LERP_X, FOLLOW_LERP_Y);
        
        // Set up collision detection
        this.setupCollisions();
        
        // Create animations
        this.createAnimations();
        
        // Initialize wave manager
        this.waveManager = new WaveManager(this);
        
        // Launch HUD scene
        this.scene.launch('GameHUD');
        this.hud = this.scene.get('GameHUD');
        
        // Handle gamepad connections
        this.setupGamepadListeners();
        
        // Debug mode toggle. `debugGraphic` only exists when physics debug is enabled
        // (e.g. ?debug=1), so guard against it being undefined — otherwise a stray 'D'
        // keypress (a gamepad button can be mapped to it) reads .visible of undefined
        // and throws, breaking input dispatch.
        this.input.keyboard.on('keydown-D', () => {
            const debugGraphic = this.physics.world.debugGraphic;
            if (debugGraphic) debugGraphic.visible = !debugGraphic.visible;
        });
    }
    
    createBackground() {
        // Scrolling background with parallax effect
        this.bg = this.add.tileSprite(0, 0, WIDTH, HEIGHT, "bg").setOrigin(0);
    }
    
    setupCollisions() {
        // Player vs enemies.
        // Don't rely on positional callback args here: `this.players` is a physics
        // group but `this.baddies` is a plain group, so Arcade flattens baddies to
        // sprites and actually invokes the callback as (enemy, player) — the reverse
        // of the (players, baddies) argument order. Resolve the player explicitly via
        // the group so the damage/knockback land on the player, not the enemy.
        this.physics.add.collider(this.players, this.baddies, (objA, objB) => {
            const player = this.players.contains(objA) ? objA : objB;
            const enemy = player === objA ? objB : objA;

            const playerIndex = this.players.getChildren().indexOf(player);

            player.damage(player, { damagePoints: 1 });

            // Update HUD (index captured before damage; the player may now be gone).
            this.hud.events.emit('updatePlayerHealth', playerIndex, player.health, 3);

            // damage() may have killed and destroyed the player — bail before
            // touching its now-null body.
            if (!player.active || !player.body) return;

            // Knockback effect (push the player away from the enemy)
            const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, player.x, player.y);
            player.body.velocity.x = Math.cos(angle) * 400;
            player.body.velocity.y = Math.sin(angle) * 400;

            // Briefly make the player invulnerable
            player.setTint(0xff0000);
            player.invulnerable = true;
            this.time.addEvent({
                delay: 1000,
                callback: () => {
                    if (!player.active) return;
                    player.clearTint();
                    player.invulnerable = false;
                }
            });
        }, (objA, objB) => {
            // Process callback: skip the collision while the player is invulnerable.
            const player = this.players.contains(objA) ? objA : objB;
            return !player.invulnerable;
        });
        
        // Player vs powerups
        // Phaser passes (object1Member, object2Member): players is object1, powerups is object2.
        this.physics.add.overlap(this.players, this.powerups, (player, powerup) => {
            player.playerVsPowerup(player, powerup);
        });
        
        // Bullets vs enemies will be handled in update
    }
    
    createAnimations() {
        // Animation for wrecking ball powerup. Animations are global, so guard against
        // re-creating it — the attract scene also defines it, and create() re-runs on a
        // level restart; Phaser warns "key already exists" otherwise.
        if (!this.anims.exists('wreckingBall.default')) {
            this.anims.create({
                key: 'wreckingBall.default',
                frames: this.anims.generateFrameNames('wreckingBall'),
                repeat: -1,
                frameRate: 12
            });
        }
    }
    
    setupGamepadListeners() {
        // Spawn a player whenever a new pad connects.
        this.input.gamepad.on('connected', (gamepad) => this.spawnPlayerForPad(gamepad));

        // After a scene restart the gamepad plugin keeps its pads (shutdown doesn't
        // clear them), so 'connected' won't re-fire — spawn for any pad already
        // present. Deferred one tick so the HUD has booted to receive the health
        // events. spawnPlayerForPad dedupes per pad, so this never double-spawns.
        this.time.delayedCall(0, () => {
            this.input.gamepad.getAll().forEach((pad) => {
                if (pad) this.spawnPlayerForPad(pad);
            });
        });
    }

    spawnPlayerForPad(gamepad) {
        // One player per physical pad (guards against 'connected' + getAll() races
        // and against any duplicate 'connected' events).
        if (this._padPlayers.has(gamepad.index)) return;
        this._padPlayers.add(gamepad.index);

        const playerIndex = this.players.getLength();
        const offsetX = playerIndex % 2 === 0 ? -100 : 100;
        const offsetY = playerIndex < 2 ? -100 : 100;

        const newPlayer = new Player(
            gamepad,
            this,
            (WIDTH / 2) + offsetX,
            (HEIGHT / 2) + offsetY
        );

        this.players.add(newPlayer);
        this.playersHaveSpawned = true;

        // Keyboard control + auto-aim for the cabinet's gamepad→keyboard shim
        // (1st player → arrows, 2nd → WASD). Runs alongside native gamepad input.
        newPlayer.enableKeyboardControl(playerIndex);

        // Initialize health display for this player
        this.hud.events.emit('updatePlayerHealth', playerIndex, newPlayer.health, 3);

        // If this is the first player, start the game
        if (playerIndex === 0) {
            this.player = newPlayer;
            this.startGame();
        }
    }
    
    startGame() {
        // Load the first level
        const level1 = {
            enemyList: [
                // Wave 1 - 10 basic enemies
                Array(10).fill().map(() => ({
                    type: 'zombie',
                    x: Phaser.Math.Between(100, WIDTH - 100),
                    y: Phaser.Math.Between(100, HEIGHT - 100),
                    health: 100
                })),
                
                // Wave 2 - 15 enemies, mix of basic and fast
                Array(15).fill().map((_, i) => ({
                    type: i % 3 === 0 ? 'alien' : 'zombie',
                    x: Phaser.Math.Between(100, WIDTH - 100),
                    y: Phaser.Math.Between(100, HEIGHT - 100),
                    health: 100,
                    speed: i % 3 === 0 ? 200 : 100
                })),
                
                // Wave 3 - 20 enemies, harder mix
                Array(20).fill().map((_, i) => ({
                    type: i % 2 === 0 ? 'alien' : 'zombie',
                    x: Phaser.Math.Between(100, WIDTH - 100),
                    y: Phaser.Math.Between(100, HEIGHT - 100),
                    health: 150,
                    speed: i % 2 === 0 ? 220 : 120
                }))
            ]
        };
        
        this.waveManager.loadLevel(level1);
    }
    
    showWaveText(text, color) {
        // Pass to HUD scene
        this.hud.events.emit('showWaveText', text, color);
    }
    
    showPerkSelection(player) {
        // Pass to HUD scene
        this.hud.events.emit('showPerkSelection', player);
    }

    handleAllPlayersDead() {
        // Brief "GAME OVER" beat, then restart the current level. create() re-runs on
        // restart, resetting the restart flags and respawning players from the pads
        // that are still connected.
        this.showWaveText('GAME OVER', 0xff0000);
        this.time.delayedCall(1800, () => this.scene.restart());
    }

    update(time, delta) {
        // Get active players
        const activePlayers = this.players.getMatching('active', true);

        // Players don't respawn individually; once everyone who joined is dead,
        // restart the current level.
        if (this.playersHaveSpawned && !this.restarting && activePlayers.length === 0) {
            this.restarting = true;
            this.handleAllPlayersDead();
            return;
        }

        if (activePlayers.length) {
            // Process player bullet collisions with enemies
            activePlayers.forEach(player => {
                const bullets = player.bullets.getMatching('visible', true);
                this.physics.overlap(this.baddies, bullets, (baddie, bullet) => {
                    if (!baddie.visible || !bullet.visible || baddie.blinking) return;
                    
                    if (typeof bullet.damage === 'function') {
                        bullet.damage(bullet, baddie);
                    }
                    
                    baddie.damage(baddie, bullet);
                });
                
                // Wrecking ball vs enemies
                if (player.wreckingBall) {
                    this.physics.overlap(this.baddies, player.wreckingBall, (baddie, ball) => {
                        baddie.damage(baddie, { damagePoints: 300 });
                    });
                }
            });
            
            // Update camera position to follow midpoint between players
            if (activePlayers.length === 1) {
                this.mid.copy(activePlayers[0].body.center);
                this.cam.setZoom(2);
            } else if (activePlayers.length >= 2) {
                // Find midpoint between all players
                this.mid.set(0, 0);
                activePlayers.forEach(player => {
                    this.mid.x += player.x;
                    this.mid.y += player.y;
                });
                
                this.mid.x /= activePlayers.length;
                this.mid.y /= activePlayers.length;
                
                // Dynamic zoom based on player spread
                let maxDist = 0;
                for (let i = 0; i < activePlayers.length; i++) {
                    for (let j = i + 1; j < activePlayers.length; j++) {
                        const dist = Phaser.Math.Distance.Between(
                            activePlayers[i].x, activePlayers[i].y,
                            activePlayers[j].x, activePlayers[j].y
                        );
                        maxDist = Math.max(maxDist, dist);
                    }
                }
                
                const min = Math.min(this.scale.width, this.scale.height) / 1.5;
                const targetZoom = Phaser.Math.Clamp(min / maxDist, ZOOM_MIN, ZOOM_MAX);
                this.cam.setZoom(Phaser.Math.Linear(this.cam.zoom, targetZoom, ZOOM_LERP));
            }
        }
    }
}

// Survival mode scene
class SurvivalScene extends GameScene {
    constructor() {
        super('SurvivalScene');
    }
    
    startGame() {
        // Initialize endless waves for survival mode
        this.createEndlessWaves();
    }
    
    createEndlessWaves() {
        this.waveCount = 1;
        this.generateNextWave();
        
        // Event listener for wave completion
        this.events.on('waveComplete', () => {
            this.waveCount++;
            this.time.addEvent({
                delay: 3000,
                callback: () => this.generateNextWave()
            });
        });
    }
    
    generateNextWave() {
        // Generate a wave with increasing difficulty
        const enemyCount = 10 + (this.waveCount * 5);
        const wave = [];
        
        for (let i = 0; i < enemyCount; i++) {
            // Increase enemy variety and difficulty with each wave
            const enemyType = Phaser.Math.Between(0, 10) < this.waveCount ? 'alien' : 'zombie';
            const health = 100 + (this.waveCount * 10);
            const speed = (enemyType === 'alien' ? 200 : 100) + (this.waveCount * 5);
            
            wave.push({
                type: enemyType,
                x: Phaser.Math.Between(100, WIDTH - 100),
                y: Phaser.Math.Between(100, HEIGHT - 100),
                health: health,
                speed: speed
            });
        }
        
        // Every 5 waves, add a boss
        if (this.waveCount % 5 === 0) {
            this.waveManager.bossSpawned = false;
        }
        
        // Show wave text
        this.showWaveText(`Wave ${this.waveCount}`, 0xffffff);
        
        // Set up the new wave
        this.waveManager.enemyList = [wave];
        this.waveManager.currentWave = 0;
        this.waveManager.waveSpawned = false;
        this.waveManager.startNextWave();
    }
}

// Campaign mode scene
class CampaignScene extends GameScene {
    constructor() {
        super('CampaignScene');
        this.currentLevel = 1;
    }
    
    startGame() {
        // Load campaign levels
        this.loadCampaignLevel(this.currentLevel);
    }
    
    loadCampaignLevel(levelNumber) {
        // Level data would typically be loaded from a JSON file
        // Here we'll create it programmatically
        const levelData = this.generateLevelData(levelNumber);
        
        this.showWaveText(`Level ${levelNumber}`, 0xffffff);
        this.waveManager.loadLevel(levelData);
        
        // Listen for level completion
        this.events.once('levelComplete', () => {
            this.currentLevel++;
            this.time.addEvent({
                delay: 5000,
                callback: () => this.loadCampaignLevel(this.currentLevel)
            });
        });
    }
    
    generateLevelData(levelNumber) {
        // Generate level data based on level number
        const waves = [];
        const waveCount = Math.min(3 + Math.floor(levelNumber / 2), 10);
        
        for (let wave = 0; wave < waveCount; wave++) {
            const enemyCount = 5 + (wave * 3) + (levelNumber * 2);
            const enemies = [];
            
            for (let i = 0; i < enemyCount; i++) {
                // More difficult enemies in later waves and levels
                const difficultyFactor = wave + levelNumber;
                const enemyType = Phaser.Math.Between(0, 10) < difficultyFactor ? 'alien' : 'zombie';
                const health = 100 + (difficultyFactor * 10);
                const speed = (enemyType === 'alien' ? 200 : 100) + (difficultyFactor * 5);
                
                enemies.push({
                    type: enemyType,
                    x: Phaser.Math.Between(100, WIDTH - 100),
                    y: Phaser.Math.Between(100, HEIGHT - 100),
                    health: health,
                    speed: speed
                });
            }
            
            waves.push(enemies);
        }
        
        return { enemyList: waves };
    }
}

// Configure the game scenes
config.scene = [
    BootScene,
    PreloadScene,
    MenuScene,
    GameScene,
    CampaignScene,
    SurvivalScene,
    GameHUD
];

// Create the game instance
const game = new Phaser.Game(config);
