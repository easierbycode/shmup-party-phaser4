import BaseEntity from './base-entity.ts';
import { Bullet, Weapon, consts } from '../weapons/weapon-plugin/index.ts';
import config from '../config.ts';

// BulletImpact class for the Lazer weapon
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

// LazerBullet class
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

// Lazer weapon class
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

// Player class
export default class Player extends BaseEntity {
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
    
    // All Player methods
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
    
    // All other methods from the Player class...
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
                this.wreckingBall = null;
            }
        });
    }
}

// Export related classes if needed elsewhere
export { Lazer, LazerBullet, BulletImpact };