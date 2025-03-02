import BaseEntity from './base-entity.ts';
import Barrier from './barrier.ts';
import CigaBullet from './ciga-bullet.ts';
import IonBullet from './ion-bullet.ts';
import PacmanBullet from './pacman-bullet.ts';
import { Bullet, Weapon } from '../weapons/weapon-plugin/index.ts';
import { BULLET_KILL } from "../weapons/weapon-plugin/events.ts";
import { consts } from '../weapons/weapon-plugin/index.ts'; // Import consts
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

    _previousWeapon = 0;
    _speed = 3.0;
    currentWeapon = 0;
    gamepad: Phaser.Input.Gamepad.Gamepad;
    gamepadVibration: GamepadHapticActuator | null;
    inputEnabled: boolean = true;
    scene!: Phaser.Scene;
    weapons: Weapon[] = [];
    level = 1;
    perks = [];
    isDemoMode: boolean = false;
    wreckingBall = null;
    fireblast = null;
    experience = 0;
    availablePerks = ['damage', 'speed', 'fireRate', 'health', 'shield'];

    constructor(
        gamepad,
        scene: Phaser.Scene,
        x: number,
        y: number,
        key: string = 'player'
    ) {
        super(scene, x, y, key);

        scene.add.existing(this);

        this.body.setCollideWorldBounds(true);

        this.gamepad = gamepad;
        this.gamepadVibration = gamepad.vibration;
        this.group = scene.players;

        this.gamepad.on('down', (idx: number) => {
            // L1 button
            if (idx == 4) this.barrierDash();

            // R1 button
            if (idx == 5) this.currentWeapon = Phaser.Math.Wrap(this.currentWeapon - 1, 0, this.weapons.length - 1);

            // SELECT button
            if (idx == 8) this.scene.scene.restart();

            // START button
            if (idx == 9) this.scene.physics.world.isPaused ? this.scene.physics.resume() : this.scene.physics.pause();
        });

        this.weapons.push(new IonBullet(this, scene));
        this.weapons.push(new CigaBullet(this, scene));
        this.weapons.push(new PacmanBullet(this, scene));
        this.weapons.push(new Barrier(this, scene));

        this.fireblast = scene.add.weapon(64, "bullet");
        this.fireblast.multiFire = true;
        this.fireblast.bulletSpeed = 400;  //1100;
        
        // Fix: Use the correct kill type from consts instead of Phaser.Physics.Arcade.Types
        if (consts && consts.KillType) {
            this.fireblast.bulletKillType = consts.KillType.KILL_WORLD_BOUNDS;
        } else {
            // Fallback in case consts is not available
            this.fireblast.bulletKillType = 1; // 1 is commonly the world bounds kill type
        }
        
        this.fireblast.trackSprite(this);
        // DRJ - try pushing fireblast into weapons
        this.weapons.push(this.fireblast);

        // Set player depth
        this.setDepth(10);
    }

    get bullets() {
        return this.weapons[this.currentWeapon].bullets;
    }

    get previousWeapon() {
        return this._previousWeapon;
    }

    set previousWeapon(weaponIdx: number) {
        if (weaponIdx != this.weapons.length - 1) this._previousWeapon = weaponIdx;
    }

    barrierDash() {
        this.previousWeapon = this.currentWeapon;
        this.currentWeapon = this.weapons.length - 1;
        this.weapons[this.currentWeapon]
            .once(BULLET_KILL, (bullet: Bullet, weapon: Weapon) => {
                this.currentWeapon = this.previousWeapon;
            })
            .fire(this.getRightCenter());
    }

    preUpdate(time, delta) {
        super.preUpdate(time, delta);

        this.body.stop();

        if (this.isDemoMode) {
            this.chasePowerups();
            return;
        }

        if (!this.inputEnabled) return;

        if (this.gamepad.left || this.gamepad.leftStick.x < -0.1) {
            this.body.velocity.x = -this.speed;
        } else if (this.gamepad.right || this.gamepad.leftStick.x > 0.1) {
            this.body.velocity.x = this.speed;
        }

        if (this.gamepad.up || this.gamepad.leftStick.y < -0.1) {
            this.body.velocity.y = -this.speed;
        }
        else if (this.gamepad.down || this.gamepad.leftStick.y > 0.1) {
            this.body.velocity.y = this.speed;
        }

        var thumbstickAngle = this.coordinatesToRadians(this.gamepad.rightStick.x, this.gamepad.rightStick.y);

        if (thumbstickAngle !== null) {
            this.rotation = thumbstickAngle;
            this.weapons[this.currentWeapon].fire(this.getRightCenter());
        }
    }

    // Find and chase the nearest powerup
    chasePowerups() {
        const powerups = this.scene.powerups ? this.scene.powerups.getChildren() : [];
        
        if (powerups.length === 0) {
            // Random movement if no powerups
            if (Math.random() < 0.02) {
                this.body.velocity.x = (Math.random() - 0.5) * this.speed * 2;
                this.body.velocity.y = (Math.random() - 0.5) * this.speed * 2;
                this.rotation = Math.atan2(this.body.velocity.y, this.body.velocity.x);
            }
            
            // Fire occasionally in random directions
            if (Math.random() < 0.05) {
                this.rotation = Math.random() * Math.PI * 2;
                this.weapons[this.currentWeapon].fire(this.getRightCenter());
            }
            return;
        }
        
        // Find nearest powerup
        let nearestPowerup = null;
        let minDistance = Infinity;
        
        for (const powerup of powerups) {
            const distance = Phaser.Math.Distance.Between(
                this.x, this.y, powerup.x, powerup.y
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                nearestPowerup = powerup;
            }
        }
        
        if (nearestPowerup) {
            // Move toward powerup
            const angle = Phaser.Math.Angle.Between(
                this.x, this.y, nearestPowerup.x, nearestPowerup.y
            );
            
            this.body.velocity.x = Math.cos(angle) * this.speed;
            this.body.velocity.y = Math.sin(angle) * this.speed;
            
            // Face the powerup
            this.rotation = angle;
            
            // Fire when close and facing the powerup
            if (minDistance < 200) {
                this.weapons[this.currentWeapon].fire(this.getRightCenter());
            }
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
        switch (powerup.texture.key) {
            case "nuke":
                this.activateNuke(powerup);
                break;
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

    activateNuke(powerup) {
        let { x, y } = powerup;
        let { scene } = this;
        
        // Make sure nukeBlasts group exists
        if (!scene.nukeBlasts) {
            scene.nukeBlasts = scene.physics.add.group();
        }
        
        // Create explosion elements
        let explosionSkull = scene.add.image(x, y, 'explosion-skull').setAlpha(0);
        let explosion = scene.add.image(x, y, 'explosion-0');
        let explosion1 = scene.add.image(x, y, 'explosion-1');
        let onComplete = (tween, targets) => targets[0].destroy();
        
        let explosionTweenConfig = {
            alpha: 0.2,
            duration: 825,
            onComplete
        };
        
        // Create blast physics object
        let nukeBlast = scene.physics.add.image(x, y, 'explosion-circle').setScale(0);
        nukeBlast.body.setCircle(nukeBlast.width / 2);
        scene.nukeBlasts.add(nukeBlast);

        // Camera shake effect
        scene.cameras.main.shake(750, 0.008, true);

        // Fade in explosion skull
        scene.tweens.add({
            targets: explosionSkull,
            alpha: 0.8,
            duration: 825,
            scale: 3,
            onComplete
        });

        // Animate explosion elements
        scene.tweens.add({
            targets: explosion1,
            scale: 5,
            angle: -180,
            ...explosionTweenConfig
        });

        scene.tweens.add({
            targets: explosion,
            scale: 4,
            angle: 180,
            ...explosionTweenConfig
        });

        scene.tweens.add({
            targets: nukeBlast,
            scale: 5.5,
            alpha: { from: 0.8, to: 0.05 },
            duration: 750,
            onComplete
        });
    }

    activateFireblast(powerup) {
        // Early return if fireblast weapon is not properly initialized
        if (!this.fireblast || typeof this.fireblast.fire !== 'function') {
            // Create a simple visual effect instead
            const explosion = this.scene.add.sprite(powerup.x, powerup.y, 'blood-splat');
            explosion.play('blood-splat.default');
            explosion.once('animationcomplete', () => {
                explosion.destroy();
            });
            return;
        }
        
        // If fireblast is properly initialized, proceed with normal behavior
        let fireDirections = [
            "TopLeft", "TopCenter", "TopRight",
            "RightCenter", "BottomRight", "BottomCenter",
            "BottomLeft", "LeftCenter"
        ];
        
        // Ensure the weapon is configured correctly for this special fire event
        this.fireblast.trackSprite(powerup);
        
        fireDirections.forEach((dir, idx) => {
            let nextDir = fireDirections[Phaser.Math.Wrap(idx + 1, 0, fireDirections.length)];
            if (powerup[`get${dir}`] && typeof powerup[`get${dir}`] === 'function') {
                let p1 = powerup[`get${dir}`]();
                this.fireblast.fire(p1.x, p1.y);
                
                if (powerup[`get${nextDir}`] && typeof powerup[`get${nextDir}`] === 'function') {
                    let p2 = powerup[`get${nextDir}`]();
                    p1.lerp(p2, 0.5);
                    this.fireblast.fire(p1.x, p1.y);
                }
            }
        });
        
        // Reset tracking to player after firing
        this.fireblast.trackSprite(this);
        
        // Visual feedback
        this.scene.cameras.main.flash(300, 255, 160, 0);
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
        // Remove any existing wrecking ball
        if (this.wreckingBall) {
            this.wreckingBall.destroy();
        }
        
        // Create the wrecking ball
        this.wreckingBall = this.scene.add.sprite(this.x, this.y - 120, 'wreckingBall');
        
        // Make sure the animation exists
        if (!this.scene.anims.exists('wreckingBall.default')) {
            this.scene.anims.create({
                key: 'wreckingBall.default',
                frames: this.scene.anims.generateFrameNumbers('wreckingBall', { start: 0 }),
                frameRate: 10,
                repeat: -1
            });
        }
        
        this.wreckingBall.play('wreckingBall.default');
        this.wreckingBall.setDepth(9);

        // Add physics body to wrecking ball
        this.scene.physics.world.enableBody(this.wreckingBall);
        this.wreckingBall.body.setCircle(this.wreckingBall.width / 2);
        
        // Visual feedback
        this.setTint(0xffaa00);

        // Make wrecking ball follow player
        const updateBall = () => {
            if (this.wreckingBall && this.active) {
                this.wreckingBall.x = this.x;
                this.wreckingBall.y = this.y - 120;
            }
        };
        
        // Set up update loop for the wrecking ball
        this.scene.events.on('update', updateBall);

        // Set timer to remove wrecking ball
        this.scene.time.addEvent({
            delay: 15000,
            callback: () => {
                if (this.wreckingBall) {
                    this.wreckingBall.destroy();
                    this.wreckingBall = null;
                    this.clearTint();
                    this.scene.events.off('update', updateBall);
                }
            }
        });
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
        
        // For both demo mode and regular gameplay, show perk selection UI
        if (this.scene.showPerkSelection && typeof this.scene.showPerkSelection === 'function') {
            this.scene.showPerkSelection(this);
        } else {
            // Fallback if showPerkSelection doesn't exist - auto-select a random perk
            this.selectRandomPerk();
        }
    }
    
    selectRandomPerkForDemo() {
        // This is now handled by the scene's showPerkSelection method
        // We'll keep this method for backward compatibility
        if (this.scene.showPerkSelection && typeof this.scene.showPerkSelection === 'function') {
            this.scene.showPerkSelection(this);
        } else {
            this.selectRandomPerk();
        }
    }
    
    selectRandomPerk() {
        if (this.availablePerks.length === 0) return;
        
        const randomPerkIndex = Phaser.Math.Between(0, this.availablePerks.length - 1);
        const selectedPerk = this.availablePerks[randomPerkIndex];
        
        this.applyPerk(selectedPerk);
    }
    
    selectRandomPerkForDemo() {
        // For demo mode, wait a random short time before selecting a perk
        const randomDelay = Phaser.Math.Between(300, 900);
        
        // Simulate "thinking" and then select a perk
        this.scene.time.delayedCall(randomDelay, () => {
            this.selectRandomPerk();
        });
    }
    
    applyPerk(perkType) {
        // Add the perk to player's perks array
        this.perks.push(perkType);
        
        // Apply perk effects
        switch(perkType) {
            case 'damage':
                // Increase bullet damage by 25%
                this.weapons.forEach(weapon => {
                    if (weapon.bullets) {
                        weapon.bullets.getChildren().forEach(bullet => {
                            if (bullet.damagePoints) {
                                bullet.damagePoints *= 1.25;
                            }
                        });
                    }
                });
                break;
                
            case 'speed':
                // Increase player speed by 15%
                this._speed *= 1.15;
                break;
                
            case 'fireRate':
                // Decrease fire rate (faster firing) by 15% for all weapons
                this.weapons.forEach(weapon => {
                    if (weapon.fireRate) {
                        weapon.fireRate *= 0.85;
                    }
                });
                break;
                
            case 'health':
                // Increase max health
                this.health = Math.min(this.health + 1, 5);
                break;
                
            case 'shield':
                // Add temporary shield
                this.activateShield();
                break;
        }
    }
    
    activateShield() {
        const shield = this.scene.add.sprite(this.x, this.y, 'shield');
        shield.setDepth(this.depth - 1);
        shield.setAlpha(0.7);
        
        // Make shield follow player
        const updateShield = () => {
            if (shield && this.active) {
                shield.x = this.x;
                shield.y = this.y;
            }
        };
        
        this.scene.events.on('update', updateShield);
        
        // Shield lasts for 30 seconds
        this.scene.time.delayedCall(30000, () => {
            // Fade out shield effect
            this.scene.tweens.add({
                targets: shield,
                alpha: 0,
                duration: 1000,
                onComplete: () => {
                    shield.destroy();
                    this.scene.events.off('update', updateShield);
                }
            });
        });
    }

    // ...existing code...
}

// Export related classes if needed elsewhere
export { Lazer, LazerBullet, BulletImpact };