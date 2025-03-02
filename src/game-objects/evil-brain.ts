
import { consts, Bullet, Weapon } from "../weapons/weapon-plugin";
import BaseEntity from "./base-entity";
import config from "../config";


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

const SPRITE_KEY = 'evil-brain-bullet';

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

export default class EvilBrain extends Phaser.GameObjects.Container {
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