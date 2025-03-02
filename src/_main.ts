import { Bullet, Weapon, WeaponPlugin, consts } from './weapons/weapon-plugin/index.ts';

// Constants
const WIDTH = 1680;
const HEIGHT = 1050;
const ZOOM_MIN = 1.0;
const ZOOM_MAX = 2;
const ZOOM_LERP = 1;
const FOLLOW_LERP_X = 0.05;
const FOLLOW_LERP_Y = 0.05;
const SPRITE_KEY = 'evil-brain-bullet';

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

// Base Entity class for players, enemies, etc.
class BaseEntity extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, key, frame) {
        super(scene, x, y, key, frame);
        this.health = 1;
        scene.add.existing(this);
        // scene.physics.world.enableBody(this);
        scene.physics.add.existing(this);
    }
    
    damage(entity, bullet) {
        let damagePoints = bullet.damagePoints || 1;
        this.health -= damagePoints;
        if (this.health <= 0) {
            this.onDestroy();
            this.destroy();
        }
    }
    
    onDestroy() {
        // Override in subclasses to add custom death behavior
    }
}

// Player class
class Player extends BaseEntity {
    constructor(gamepad, scene, x, y, key = "player") {
        super(scene, x, y, key);
        this.currentWeapon = 0;
        this.speed = 150;
        this.weapons = [];
        this.powerups = [];
        this.experience = 0;
        this.level = 1;
        this.perks = [];
        this.wreckingBall = null;
        
        this.body.setCollideWorldBounds(true);
        this.gamepad = gamepad;
        this.gamepadVibration = gamepad.vibration;
        
        // Initialize weapons
        this.weapons.push(new Lazer(this, scene));
        this.fireblast = scene.add.weapon(64, "bullet");
        this.fireblast.multiFire = true;
        this.fireblast.bulletSpeed = 400;
        this.weapons.push(this.fireblast);
        
        // Set player depth
        this.setDepth(10);
    }
    
    get bullets() {
        return this.weapons[this.currentWeapon].bullets;
    }
    
    preUpdate(time, delta) {
        super.preUpdate(time, delta);
        this.body.stop();
        
        // Movement controls
        if (this.gamepad.left || this.gamepad.leftStick.x < -0.1) {
            this.body.velocity.x = -this.speed;
        } else if (this.gamepad.right || this.gamepad.leftStick.x > 0.1) {
            this.body.velocity.x = this.speed;
        }
        
        if (this.gamepad.up || this.gamepad.leftStick.y < -0.1) {
            this.body.velocity.y = -this.speed;
        } else if (this.gamepad.down || this.gamepad.leftStick.y > 0.1) {
            this.body.velocity.y = this.speed;
        }
        
        // Firing controls
        var thumbstickAngle = this.coordinatesToRadians(this.gamepad.rightStick.x, this.gamepad.rightStick.y);
        if (thumbstickAngle !== null) {
            this.rotation = thumbstickAngle;
            this.weapons[this.currentWeapon].fire(this.getRightCenter());
        }
        
        // Wrecking ball powerup animation
        if (this.wreckingBall) {
            Phaser.Actions.RotateAroundDistance([this.wreckingBall], this.getCenter(), 0.08, 120);
        }
        
        // Weapon switch
        if (this.gamepad.buttons[1].pressed && !this.weaponSwitchCooldown) {
            this.currentWeapon = (this.currentWeapon + 1) % this.weapons.length;
            this.weaponSwitchCooldown = true;
            this.scene.time.addEvent({
                delay: 300,
                callback: () => {
                    this.weaponSwitchCooldown = false;
                }
            });
        }
    }
    
    coordinatesToRadians(x, y) {
        if (x === 0 && y === 0) {
            return null;
        }
        let radians = Math.atan2(y, x);
        if (radians < 0) {
            radians += 2 * Math.PI;
        }
        return Math.abs(radians);
    }
    
    collectExperience(amount) {
        this.experience += amount;
        // Check for level up
        let nextLevelThreshold = this.level * 100;
        if (this.experience >= nextLevelThreshold) {
            this.levelUp();
        }
    }
    
    levelUp() {
        this.level++;
        // Show level up UI and perk selection
        this.scene.showPerkSelection(this);
    }
    
    applyPerk(perk) {
        this.perks.push(perk);
        
        // Apply perk effects
        switch(perk.type) {
            case 'speed':
                this.speed *= 1.2;
                break;
            case 'fireRate':
                this.weapons.forEach(weapon => {
                    weapon.fireRate *= 0.8; // Lower is faster
                });
                break;
            case 'damage':
                this.weapons.forEach(weapon => {
                    weapon.bullets.getChildren().forEach(bullet => {
                        bullet.damagePoints = (bullet.damagePoints || 1) * 1.5;
                    });
                });
                break;
            // Add more perk types as needed
        }
    }
    
    playerVsPowerup(player, powerup) {
        if (player.gamepadVibration) {
            player.gamepad.vibration.playEffect("dual-rumble", {
                startDelay: 0,
                duration: 100,
                weakMagnitude: 1.0,
                strongMagnitude: 0.3
            });
        }
        
        // Apply powerup effects
        switch(powerup.texture.key) {
            case "fireblast":
                this.activateFireblast(powerup);
                break;
            case "speed":
                this.activateSpeedBoost();
                break;
            case "giantMode":
                this.activateGiantMode();
                break;
            case "wreckingBall":
                this.activateWreckingBall();
                break;
            case "healthpack":
                this.health = Math.min(this.health + 1, 3); // Assuming max health is 3
                break;
        }
        
        powerup.destroy();
    }
    
    activateFireblast(powerup) {
        let fireDirections = [
            "TopLeft", "TopCenter", "TopRight",
            "RightCenter", "BottomRight", "BottomCenter",
            "BottomLeft", "LeftCenter"
        ];
        
        fireDirections.forEach((dir, idx) => {
            let nextDir = fireDirections[Phaser.Math.Wrap(idx + 1, 0, fireDirections.length)];
            let p1 = powerup[`get${dir}`]();
            this.fireblast.fire(powerup, p1.x, p1.y);
            p1.lerp(powerup[`get${nextDir}`](), 0.5);
            this.fireblast.fire(powerup, p1.x, p1.y);
        });
    }
    
    activateSpeedBoost() {
        let originalSpeed = this.speed;
        this.speed *= 3;
        this.scene.time.addEvent({
            delay: 7000,
            callback: () => {
                this.speed = originalSpeed;
            }
        });
    }
    
    activateGiantMode() {
        this.setScale(2);
        this.scene.time.addEvent({
            delay: 7000,
            callback: () => {
                this.setScale(1);
            }
        });
    }
    
    activateWreckingBall() {
        this.wreckingBall = this.scene.add.sprite(this.x, this.y - 120, 'wreckingBall').play('wreckingBall.default');
        this.wreckingBall.setDepth(9);
        
        // Add physics body to wrecking ball
        this.scene.physics.world.enableBody(this.wreckingBall);
        this.wreckingBall.body.setCircle(this.wreckingBall.width / 2);
        
        this.scene.time.addEvent({
            delay: 15000,
            callback: () => {
                this.wreckingBall.destroy();
                // this.wreckingBall = null;
                // this.clearTint();
            }
        });
    }
}

// Weapon classes
class LazerBullet extends Bullet {
    constructor(scene, x, y, key = 'bullet', frame) {
        super(scene, x, y, key, frame);
        this.damagePoints = 100;
        this.setData('killType', consts.KillType.KILL_WORLD_BOUNDS);
    }
    
    damage(bullet, entity) {
        this.kill();
        let { halfHeight, halfWidth, height, width, x, y } = entity.body;
        x += halfWidth, y += halfHeight;
        let { rotation } = this;
        let { impacts } = this.getData('bulletManager');
        let impact = impacts.get(x, y).setVisible(true).setActive(true).setRotation(rotation).setDepth(2);
        
        if (Math.min(height, width) == width) {
            impact.displayWidth = width;
            impact.scaleY = impact.scaleX;
        } else {
            impact.displayHeight = height;
            impact.scaleX = impact.scaleY;
        }
        
        impact.on('animationcomplete-default', () => impacts.killAndHide(impact));
        impact.play('default');
    }
}

class BulletImpact extends Phaser.GameObjects.Sprite {
    constructor(scene, x, y, key = 'ion-bullet-impact') {
        super(scene, x, y, key);
        this.anims.create({
            key: 'default',
            frames: this.anims.generateFrameNames('ion-bullet-impact'),
            frameRate: 30
        });
    }
}

class Lazer extends Weapon {
    constructor(player, scene, bulletLimit = 30, key = 'bullet', frame = '', group) {
        super(scene, bulletLimit, key, frame);
        this.addBulletAnimation(`bullet.default`, scene.anims.generateFrameNumbers('bullet'), 12, -1);
        this.impacts = scene.add.group({ classType: BulletImpact });
        this.bulletAngleOffset = 90;
        this.bulletClass = LazerBullet;
        this.bulletSpeed = 600;
        this.fireRate = 175;
        this.debugPhysics = config.physics[config.physics.default].debug;
        
        // Create bullets
        this.createBullets();
        this.bullets.clear();
        this.bullets.createMultipleCallback = (items) => {
            items.forEach(item => {
                item.setData('bulletManager', this);
                item.setDepth(1);
            });
        };
        
        this.bullets.createMultiple({
            classType: LazerBullet,
            key: 'bullet',
            repeat: this.bullets.maxSize - 1,
            active: false,
            visible: false
        });
        
        this.trackSprite(player, 0, 0, true);
    }
}

// Enemy Classes
class Enemy extends BaseEntity {
    constructor(scene, x, y, key, frame) {
        super(scene, x, y, key, frame);
        this.targetPlayer = null;
        this.moveSpeed = 100;
        this.experienceValue = 10;
    }
    
    preUpdate(time, delta) {
        super.preUpdate(time, delta);
        
        // Find closest player if we don't have a target
        if (!this.targetPlayer || !this.targetPlayer.active) {
            this.findClosestPlayer();
        }
        
        // Move toward target player
        if (this.targetPlayer && this.targetPlayer.active) {
            this.scene.physics.moveToObject(this, this.targetPlayer, this.moveSpeed);
            
            // Rotate toward player
            const angle = Phaser.Math.Angle.Between(
                this.x, this.y,
                this.targetPlayer.x, this.targetPlayer.y
            );
            this.rotation = angle;
        } else {
            this.body.velocity.x = 0;
            this.body.velocity.y = 0;
        }
    }
    
    findClosestPlayer() {
        const players = this.scene.players.getChildren();
        if (players.length === 0) return;
        
        let closestPlayer = null;
        let closestDistance = Infinity;
        
        for (const player of players) {
            if (!player.active) continue;
            
            const distance = Phaser.Math.Distance.Between(
                this.x, this.y,
                player.x, player.y
            );
            
            if (distance < closestDistance) {
                closestDistance = distance;
                closestPlayer = player;
            }
        }
        
        this.targetPlayer = closestPlayer;
    }
    
    onDestroy() {
        // Drop experience
        if (this.targetPlayer) {
            this.targetPlayer.collectExperience(this.experienceValue);
        }
        
        // Random chance to drop powerup
        if (Phaser.Math.Between(1, 10) <= 2) { // 20% chance
            this.dropPowerup();
        }
    }
    
    dropPowerup() {
        const powerupTypes = ['speed', 'fireblast', 'giantMode', 'wreckingBall', 'healthpack'];
        const randomType = powerupTypes[Phaser.Math.Between(0, powerupTypes.length - 1)];
        
        this.scene.powerups.add(
            this.scene.physics.add.image(this.x, this.y, randomType)
        );
    }
}

// Boss Implementation
class EvilBrainEye extends BaseEntity {
    constructor(scene, x = 0, y = 0) {
        super(scene, x, y, 'evil-brain-eye', 2);
        this.health = 6000;
        this.setOrigin(0);
    }
    
    preUpdate() {
        if (!this.scene.player || this.blinking) return;
        super.preUpdate();
        
        let { left, right } = this.parentContainer.body;
        
        // PLAYER LEFT OF BRAIN
        if (this.scene.player.x < left) {
            this.flipX ? this.setFrame(3) : this.setFrame(1);
        }
        // PLAYER RIGHT OF BRAIN
        else if (this.scene.player.x > right) {
            this.flipX ? this.setFrame(1) : this.setFrame(3);
        }
        // PLAYER BELOW BRAIN
        else {
            this.setFrame(2);
        }
    }
    
    damage(entity, bullet) {
        super.damage(entity, bullet);
        if (this.health && this.health % 1000 == 0) this.blink();
    }
    
    blink() {
        this.blinking = true;
        this.setFrame(0);
        this.scene.time.addEvent({
            delay: 750,
            callback: () => {
                this.blinking = false;
            }
        });
    }
    
    destroy() {
        let { halfHeight, halfWidth, x, y } = this.body;
        let explosion = new EvilBrainEyeExplosion(this.scene, x + halfWidth, y + halfHeight);
        explosion.on('animationcomplete-default', () => explosion.destroy());
        explosion.play('default');
        super.destroy();
    }
}

class EvilBrainEyeExplosion extends Phaser.GameObjects.Sprite {
    constructor(scene, x, y, key = 'evil-brain-eye-explode') {
        super(scene, x, y, key);
        this.anims.create({
            key: 'default',
            frames: this.anims.generateFrameNames('evil-brain-eye-explode'),
            frameRate: 12
        });
        scene.add.existing(this);
    }
}

class EvilBrainTop extends Phaser.GameObjects.Sprite {
    constructor(scene, x = 0, y = 0) {
        super(scene, x, y, 'evil-brain-top');
        this.setOrigin(0);
        this.anims.create({
            key: 'default',
            frameRate: 1,
            frames: scene.anims.generateFrameNumbers('evil-brain-top'),
            repeat: -1
        });
        this.play('default');
        this.on('animationupdate', (animation, frame, gameObject, frameKey) => {
            if (frame.index == 2 && scene.player)
                this.parentContainer.weapon.fireAtSprite(scene.player);
        });
        scene.add.existing(this);
    }
}

class EvilBrainBottom extends Phaser.GameObjects.Sprite {
    constructor(scene, x = 0, y = 0) {
        super(scene, x, y, 'evil-brain-bottom');
        this.setOrigin(0);
        this.anims.create({
            key: 'default',
            frameRate: 1,
            frames: scene.anims.generateFrameNumbers('evil-brain-bottom'),
            repeat: -1
        });
        this.play('default');
        scene.add.existing(this);
    }
}

class EvilBrainBullet extends Weapon {
    constructor(evilBrain, scene, bulletLimit = 20, key = '', frame = '', group) {
        super(scene, bulletLimit, key, frame);
        this.prefires = scene.add.group({ classType: BulletPrefire });
        this.addBulletAnimation(`${SPRITE_KEY}.default`, scene.anims.generateFrameNumbers(SPRITE_KEY), 12, -1);
        this.bulletClass = _Bullet;
        this.bulletSpeed = 350;
        this.fireRate = 300;
        this.debugPhysics = config.physics[config.physics.default].debug;
        
        // Create bullets
        this.createBullets();
        this.bullets.clear();
        this.bullets.createMultipleCallback = (items) => {
            items.forEach(item => {
                item.setData('bulletManager', this);
                item.setScale(4);
                item.setDepth(1);
            });
        };
        
        this.bullets.createMultiple({
            classType: _Bullet,
            key: SPRITE_KEY,
            repeat: this.bullets.maxSize - 1,
            active: false,
            visible: false
        });
        
        // Track sprite positioning
        this.trackSprite(evilBrain, 48 * 4, (8 * 4) + 32);
    }
    
    fireAtSprite(sprite) {
        let { x, y } = this.trackedSprite;
        x += 40 * 4;
        y += (8 * 4) - 1;
        let { prefires } = this;
        let prefire = prefires.get(x, y).setVisible(true).setActive(true).setScale(4).setDepth(1);
        
        prefire.on('animationcomplete-default', () => {
            super.fireAtSprite(sprite);
            prefires.killAndHide(prefire);
        });
        
        prefire.play('default');
    }
}

class BulletPrefire extends Phaser.GameObjects.Sprite {
    constructor(scene, x, y, key = 'evil-brain-bullet-prefire') {
        super(scene, x, y, key);
        this.setOrigin(0);
        this.anims.create({
            key: 'default',
            frames: this.anims.generateFrameNames('evil-brain-bullet-prefire'),
            frameRate: 12
        });
    }
}

class _Bullet extends Bullet {
    constructor(scene, x, y, key = SPRITE_KEY, frame) {
        super(scene, x, y, key, frame);
        this.damagePoints = 100;
        this.setData('killType', consts.KillType.KILL_WORLD_BOUNDS);
        this.body.setCircle(this.width / 2);
    }
    
    damage(bullet, entity) {
        this.kill();
    }
}

class EvilBrain extends Phaser.GameObjects.Container {
    constructor(scene, x, y) {
        // TOP ( 96x58 )
        let top = new EvilBrainTop(scene);
        // BOTTOM ( 80x56 )
        let bottom = new EvilBrainBottom(scene, 8, top.height);
        let eyeRight = new EvilBrainEye(scene, 8 + 46, top.height + 1);
        let eyeLeft = new EvilBrainEye(scene, 8 + 12, top.height + 1).setFlipX(true);
        
        scene.baddies.addMultiple([eyeLeft, eyeRight]);
        
        super(scene, x, y, [top, bottom, eyeLeft, eyeRight]);
        
        // WEAPON
        this.weapon = new EvilBrainBullet(this, scene);
        
        scene.physics.world.enable(this);
        this.body.setSize(Math.max(top.width, bottom.width), top.height + bottom.height);
        this.setScale(4);
        this.setDepth(5);
        
        scene.add.existing(this);
    }
}

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
            case 'basicEnemy':
                enemy = new Enemy(this.scene, x, y, 'enemy');
                break;
            case 'fastEnemy':
                enemy = new Enemy(this.scene, x, y, 'enemy-fast');
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
        
        // Load images
        this.load.image("bg", "scorched-earth.png");
        this.load.image("player", "player.png");
        this.load.image("enemy", "monster-1.png");
        this.load.image("enemy-fast", "monster-2.png");
        this.load.image("healthpack", "health-pack.png");
        
        // Load powerup images
        this.load.image("giantMode", "powerup-weapon-boost.png");
        this.load.image("fireblast", "powerup-fireblast.png");
        this.load.image("speed", "powerup-speed.png");
        
        // Load spritesheets
        this.load.spritesheet("bullet", "bullet.png", {
            frameHeight: 11,
            frameWidth: 12
        });
        
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
        this.load.image("button", "button.png");
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
        
        // Game title
        this.add.text(width / 2, height / 4, 'SHMUP PARTY', {
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
        
        button.setInteractive({ useHandCursor: true })
            .on('pointerover', () => button.setTint(0xff0000))
            .on('pointerout', () => button.clearTint())
            .on('pointerdown', callback);
            
        return button;
    }
    
    update() {
        // Check for gamepad input
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
                    type: 'basicEnemy',
                    x: Phaser.Math.Between(100, WIDTH - 100),
                    y: Phaser.Math.Between(100, HEIGHT - 100),
                    health: 100
                })),
                
                // Wave 2 - 15 enemies, mix of basic and fast
                Array(15).fill().map((_, i) => ({
                    type: i % 3 === 0 ? 'fastEnemy' : 'basicEnemy',
                    x: Phaser.Math.Between(100, WIDTH - 100),
                    y: Phaser.Math.Between(100, HEIGHT - 100),
                    health: 100,
                    speed: i % 3 === 0 ? 200 : 100
                })),
                
                // Wave 3 - 20 enemies, harder mix
                Array(20).fill().map((_, i) => ({
                    type: i % 2 === 0 ? 'fastEnemy' : 'basicEnemy',
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
        // Update background (parallax effect)
        this.bg.tilePositionX += 0.5;
        
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
            const enemyType = Phaser.Math.Between(0, 10) < this.waveCount ? 'fastEnemy' : 'basicEnemy';
            const health = 100 + (this.waveCount * 10);
            const speed = (enemyType === 'fastEnemy' ? 200 : 100) + (this.waveCount * 5);
            
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
                const enemyType = Phaser.Math.Between(0, 10) < difficultyFactor ? 'fastEnemy' : 'basicEnemy';
                const health = 100 + (difficultyFactor * 10);
                const speed = (enemyType === 'fastEnemy' ? 200 : 100) + (difficultyFactor * 5);
                
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