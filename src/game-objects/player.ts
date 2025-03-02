import BaseEntity from './base-entity.ts';
import Barrier from './barrier.ts';
import CigaBullet from './ciga-bullet.ts';
import IonBullet from './ion-bullet.ts';
import PacmanBullet from './pacman-bullet.ts';
import { Bullet, Weapon } from '../weapons/weapon-plugin/index.ts';
import { BULLET_KILL } from "../weapons/weapon-plugin/events.ts";
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
    
    _previousWeapon     = 0;
    _speed              = 3.0;
    currentWeapon       = 0;
    gamepad: Phaser.Input.Gamepad.Gamepad;
    gamepadVibration: GamepadHapticActuator | null;
    inputEnabled: boolean = true;
    scene!: Phaser.Scene;
    weapons: Weapon[]   = [];
    level = 1;
    perks = [];
    
    constructor( 
        gamepad, 
        scene: Phaser.Scene, 
        x: number, 
        y: number, 
        key: string = 'player' 
    ) {
        super( scene, x, y, key );

        scene.add.existing( this );

        this.body.setCollideWorldBounds( true );

        this.gamepad            = gamepad;
        this.gamepadVibration   = gamepad.vibration;
        this.group              = scene.players;

        this.gamepad.on('down', (idx: number) => {
            // L1 button
            if (idx == 4)  this.barrierDash();

            // R1 button
            if (idx == 5)  this.currentWeapon = Phaser.Math.Wrap(this.currentWeapon-1, 0, this.weapons.length-1);
            
            // SELECT button
            if (idx == 8)  this.scene.scene.restart();

            // START button
            if (idx == 9)  this.scene.physics.world.isPaused ? this.scene.physics.resume() : this.scene.physics.pause();
        });

        this.weapons.push( new IonBullet( this, scene ) );
        this.weapons.push( new CigaBullet( this, scene ) );
        this.weapons.push( new PacmanBullet( this, scene ) );
        this.weapons.push( new Barrier( this, scene ) );
        
        // Set player depth
        this.setDepth(10);
    }

    get bullets() {
        return this.weapons[ this.currentWeapon ].bullets;
    }

    get previousWeapon() {
        return this._previousWeapon;
    }

    set previousWeapon( weaponIdx: number ) {
        if ( weaponIdx != this.weapons.length - 1 )  this._previousWeapon = weaponIdx;
    }

    barrierDash() {
        this.previousWeapon = this.currentWeapon;
        this.currentWeapon = this.weapons.length - 1;
        this.weapons[ this.currentWeapon ]
            .once(BULLET_KILL, ( bullet: Bullet, weapon: Weapon ) => {
                this.currentWeapon = this.previousWeapon;
            })
            .fire( this.getRightCenter() );
    }

    preUpdate( time, delta ) {
        super.preUpdate( time, delta );

        this.body.stop();

        if ( !this.inputEnabled )  return;

        if ( this.gamepad.left || this.gamepad.leftStick.x < -0.1 ) {
            this.body.velocity.x = -this.speed;
        } else if ( this.gamepad.right || this.gamepad.leftStick.x > 0.1 ) {
            this.body.velocity.x = this.speed;
        }
    
        if ( this.gamepad.up || this.gamepad.leftStick.y < -0.1 ) {
            this.body.velocity.y = -this.speed;
        }
        else if ( this.gamepad.down || this.gamepad.leftStick.y > 0.1 ) {
            this.body.velocity.y = this.speed;
        }

        var thumbstickAngle = this.coordinatesToRadians( this.gamepad.rightStick.x, this.gamepad.rightStick.y );
                
        if ( thumbstickAngle !== null ) {
            this.rotation = thumbstickAngle;
            this.weapons[ this.currentWeapon ].fire( this.getRightCenter() );
        }
    }

    coordinatesToRadians( x, y ) {
        if ( x === 0 && y === 0 ) {
            return null;
        }

        let radians = Math.atan2( y, x );
        if ( radians < 0 ) {
            radians += 2 * Math.PI;
        }
        return Math.abs( radians );
    }

    playerVsPowerup( player: Player, powerup ) {
        if (player.gamepadVibration)
          player.gamepad.vibration.playEffect("dual-rumble", {
            startDelay: 0,
            duration: 100,
            weakMagnitude: 1.0,
            strongMagnitude: 0.3
          });
        
        // NUKE
        if ( powerup.texture.key == 'nuke' ) {
            let {x, y} = powerup;
            let {scene} = player;
            let explosionSkull = scene.add.image( x, y, 'explosion-skull' ).setAlpha( 0 );
            let explosion = scene.add.image( x, y, 'explosion-0' );
            let explosion1 = scene.add.image( x, y, 'explosion-1' );
            let onComplete = ( tween, targets ) => targets[0].destroy();
            let explosionTweenConfig = {
                alpha: 0.2,
                duration: 825,
                onComplete
            }
            let nukeBlast = scene.physics.add.image( x, y, 'explosion-circle' ).setScale( 0 );
            nukeBlast.body.setCircle( nukeBlast.width / 2 );
            scene.nukeBlasts.add( nukeBlast );

            scene.cameras.main.shake( 750, 0.008, true );

            // fade In explosion skull
            scene.tweens.add({
                targets: explosionSkull,
                alpha: 0.8,
                duration: 825,
                scale: 3,
                onComplete
            });
            
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
                alpha: {from: 0.8, to: 0.05},
                duration: 750,
                onComplete
            });
        }

        powerup.destroy();
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
}

// Export related classes if needed elsewhere
export { Lazer, LazerBullet, BulletImpact };