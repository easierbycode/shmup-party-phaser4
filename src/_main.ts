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
        this.load.image("perk-icon-speed", "perk-speed.png");
        this.load.image("perk-icon-fireRate", "perk-fire-rate.png");
        this.load.image("perk-icon-damage", "perk-damage.png");
    }
    
    create() {
        this.scene.start('MenuScene');
    }
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
        this.add.text(width / 2, height / 4, `Sh'M↑ Party`, {
            fontFamily: 'Arial',
            fontSize: '64px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);
        
        // Menu buttons
        this.createButton(width / 2, height / 2, 'Campaign Mode', () => {
            this.scene.start('CampaignScene');
        });
        
        this.createButton(width / 2, height / 2 + 80, 'Survival Mode', () => {
            this.scene.start('SurvivalScene');
        });
        
        this.createButton(width / 2, height / 2 + 160, 'Options', () => {
            // Options scene would go here
        });
        
        // Detect gamepad connections
        this.input.gamepad.on('connected', (pad) => {
            this.gamepad = pad;
        });
        
        // Listen for keyboard input
        this.input.keyboard.on('keydown-ENTER', () => {
            this.scene.start('CampaignScene');
        });
    }
    
    setupAttractMode() {
        // Create game groups that enemies might need
        this.baddies = this.add.group();
        this.bullets = this.physics.add.group();
        this.enemyBullets = this.physics.add.group(); // Enemy bullets group
        this.players = this.add.group(); // Group for players (targets)
        
        // Add any other collections/properties that enemies might be looking for
        this.targets = this.add.group(); // Target group that aliens might be searching
        
        // Create plugins if needed
        if (!this.weapons) {
            this.plugins.installScenePlugin('WeaponPlugin', WeaponPlugin, 'weapons', this);
        }
        
        // Create automated demo player
        this.createDemoPlayer();
        
        // Add player to players/targets group
        this.players.add(this.demoPlayer);
        this.targets.add(this.demoPlayer);
        
        // Start spawning enemies
        this.spawnAttractModeEnemies();
        
        // Set up collisions between bullets and enemies
        this.physics.add.overlap(this.bullets, this.baddies, (bullet, baddie) => {
            if (!baddie.visible || !bullet.visible || baddie.blinking) return;
            
            if (typeof bullet.damage === 'function') {
                bullet.damage(bullet, baddie);
            } else {
                bullet.setVisible(false);
                bullet.setActive(false);
            }
            
            baddie.damage(baddie, { damagePoints: bullet.damagePoints || 10 });
        });
        
        // Set up collisions between enemy bullets and player
        this.physics.add.overlap(this.enemyBullets, this.players, (bullet, player) => {
            // In attract mode, let's make the player invincible
            bullet.setVisible(false);
            bullet.setActive(false);
        });
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
        const button = this.add.text(x, y, text, {
            fontFamily: 'Arial',
            fontSize: '32px',
            color: '#ffffff',
            backgroundColor: '#880000',
            padding: {
                left: 20,
                right: 20,
                top: 10,
                bottom: 10
            }
        }).setOrigin(0.5);
        
        // Set higher depth to ensure buttons appear above attract mode
        button.setDepth(20);
        button.setInteractive({ useHandCursor: true })
            .on('pointerover', () => button.setTint(0xff0000))
            .on('pointerout', () => button.clearTint())
            .on('pointerdown', callback);
            
        return button;
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
        
        // Create occasional powerups for visual interest
        if (Math.random() < 0.001) {
            const powerupTypes = ["giantMode", "fireblast", "speed"];
            const randomType = Phaser.Utils.Array.GetRandom(powerupTypes);
            
            const x = Phaser.Math.Between(100, this.cameras.main.width - 100);
            const y = Phaser.Math.Between(100, this.cameras.main.height - 100);
            
            const powerup = this.physics.add.image(x, y, randomType);
            powerup.setDepth(2);
            this.physics.add.overlap(this.demoPlayer, powerup, () => {
                this.demoPlayer.playerVsPowerup(this.demoPlayer, powerup);
            });
        }
        
        // Check for gamepad input to start the game
        if (this.gamepad) {
            if (this.gamepad.A || this.gamepad.buttons[0].pressed) {
                this.scene.start('CampaignScene');
            }
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
        
        // Events from main scene
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
        
        // Available perks
        const perks = [
            { type: 'speed', name: 'Speed Boost', description: '20% movement speed increase' },
            { type: 'fireRate', name: 'Rapid Fire', description: '20% faster firing rate' },
            { type: 'damage', name: 'Heavy Hitter', description: '50% damage increase' }
        ];
        
        // Create perk selection buttons
        const buttons = [];
        perks.forEach((perk, index) => {
            const x = this.cameras.main.width / 2 + (index - 1) * 250;
            const y = this.cameras.main.height / 2;
            
            const container = this.add.container(x, y);
            
            // Icon background
            const bg = this.add.rectangle(0, 0, 200, 240, 0x333333, 0.8)
                .setStrokeStyle(2, 0xffffff);
            
            // Perk icon
            const icon = this.add.image(0, -70, `perk-icon-${perk.type}`)
                .setScale(2);
            
            // Perk name
            const nameText = this.add.text(0, 0, perk.name, {
                fontFamily: 'Arial',
                fontSize: '24px',
                color: '#ffffff'
            }).setOrigin(0.5);
            
            // Perk description
            const descText = this.add.text(0, 40, perk.description, {
                fontFamily: 'Arial',
                fontSize: '16px',
                color: '#ffffff',
                wordWrap: { width: 180 }
            }).setOrigin(0.5);
            
            container.add([bg, icon, nameText, descText]);
            
            // Make interactive
            bg.setInteractive({ useHandCursor: true })
                .on('pointerover', () => bg.setStrokeStyle(4, 0xff0000))
                .on('pointerout', () => bg.setStrokeStyle(2, 0xffffff))
                .on('pointerdown', () => {
                    // Apply perk to player
                    player.applyPerk(perk);
                    
                    // Remove perk selection UI
                    backdrop.destroy();
                    title.destroy();
                    buttons.forEach(b => b.destroy());
                    
                    // Resume game - use the active game scene instead of hardcoding
                    this.scene.resume(this.activeGameScene);
                });
                
            buttons.push(container);
        });
        
        // Pause the current game scene - use the active game scene instead of hardcoding
        this.scene.pause(this.activeGameScene);
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
        this.powerups = this.add.group();
        this.bloodSplatters = this.add.group({ classType: BloodSplatter });
        
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
        
        // Debug mode toggle
        this.input.keyboard.on('keydown-D', () => {
            this.physics.world.debugGraphic.visible = !this.physics.world.debugGraphic.visible;
        });
    }
    
    createBackground() {
        // Scrolling background with parallax effect
        this.bg = this.add.tileSprite(0, 0, WIDTH, HEIGHT, "bg").setOrigin(0);
    }
    
    setupCollisions() {
        // Player vs enemies
        this.physics.add.collider(this.players, this.baddies, (player, enemy) => {
            player.damage(player, { damagePoints: 1 });
            
            // Update HUD
            this.hud.events.emit('updatePlayerHealth', this.players.getChildren().indexOf(player), player.health, 3);
            
            // Knockback effect
            const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, player.x, player.y);
            player.body.velocity.x = Math.cos(angle) * 400;
            player.body.velocity.y = Math.sin(angle) * 400;
            
            // Briefly make the player invulnerable
            player.setTint(0xff0000);
            player.invulnerable = true;
            this.time.addEvent({
                delay: 1000,
                callback: () => {
                    player.clearTint();
                    player.invulnerable = false;
                }
            });
        }, (player, enemy) => {
            // Collision callback to check if player is invulnerable
            return !player.invulnerable;
        });
        
        // Player vs powerups
        this.physics.add.overlap(this.players, this.powerups, (powerup, player) => {
            player.playerVsPowerup(player, powerup);
        });
        
        // Bullets vs enemies will be handled in update
    }
    
    createAnimations() {
        // Animation for wrecking ball powerup
        this.anims.create({
            key: 'wreckingBall.default',
            frames: this.anims.generateFrameNames('wreckingBall'),
            repeat: -1,
            frameRate: 12
        });
    }
    
    setupGamepadListeners() {
        this.input.gamepad.on('connected', (gamepad) => {
            // Create a new player for this gamepad
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
            
            // Initialize health display for this player
            this.hud.events.emit('updatePlayerHealth', playerIndex, newPlayer.health, 3);
            
            // If this is the first player, start the game
            if (playerIndex === 0) {
                this.player = newPlayer;
                this.startGame();
            }
        });
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
    
    update(time, delta) {
        // Get active players
        const activePlayers = this.players.getMatching('active', true);
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