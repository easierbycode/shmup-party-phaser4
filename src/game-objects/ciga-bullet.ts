
import { Bullet, Weapon } from "../weapons/weapon-plugin";
import { KillType } from "../weapons/weapon-plugin/consts";
import config from '../config';
const SPRITE_KEY = 'ciga-bullet';


class _Bullet extends Bullet {

      damagePoints = 100;

      constructor( scene, x, y, key = SPRITE_KEY, frame ) {
            super( scene, x, y, key, frame );
            this.setData( 'killType', KillType.KILL_WORLD_BOUNDS );
      }

      damage( bullet: _Bullet, entity: BaseEntity ) {
            this.kill();
            let {x, y}              = entity;
            let {height, width}     = entity.body;
            let {rotation}          = this;
            let {impacts}           = this.getData( 'bulletManager' );
            let impact              = impacts.get( x, y ).setVisible( true ).setActive( true ).setRotation( rotation ).setDepth( 2 );
            if ( Math.min( height, width ) == width ) {
                  impact.displayWidth     = width;
                  impact.scaleY           = impact.scaleX;
            } else {
                  impact.displayHeight    = height;
                  impact.scaleX           = impact.scaleY;
            }
            impact.on(
                'animationcomplete-default',
                () => impacts.killAndHide( impact )
            );
            impact.play( 'default' );
      }

}


class BulletImpact extends Phaser.GameObjects.Sprite {

      constructor(
          scene: Phaser.Scene, 
          x: number, 
          y: number, 
          key: string = 'smoke'
      ) {
          super( scene, x, y, key )
  
          this.anims.create({
              key: 'default',
              frames: this.anims.generateFrameNames( 'smoke' ),
              frameRate: 30
          })
      }
  
}


export default class CigaBullet extends Weapon {

    constructor(
        player: Phaser.Physics.Arcade.Sprite,
        scene: Phaser.Scene,
        bulletLimit: number = 20,
        key = '',
        frame = '',
        group?: Phaser.GameObjects.Group
      ) {
            super( scene, bulletLimit, key, frame );

            this.impacts      = scene.add.group({ classType: BulletImpact });

            this.addBulletAnimation(
                  `${SPRITE_KEY}.default`,
                  scene.anims.generateFrameNumbers( SPRITE_KEY ),
                  8,
                  -1
            )
            
            this.bulletClass  = _Bullet;
            this.bulletSpeed  = 350;
            this.fireRate     = 300;
            this.bulletAngleOffset = 270;
            this.debugPhysics = config.physics[config.physics.default].debug;

            // `this.bullets` exists only after createBullets()
            this.createBullets();
            // createBullets does not create bulletClass instances, so
            // we remove and recreate with correct classType
            this.bullets.clear();

            this.bullets.createMultipleCallback = ( items ) => {
                  items.forEach( item => {
                        item.setData( 'bulletManager', this );
                        item.setScale( 2.4 );
                  });
            }

            this.bullets.createMultiple({
                  classType: _Bullet,
                  key: SPRITE_KEY,
                  repeat: this.bullets.maxSize-1,
                  active: false,
                  visible: false
            });

            this.trackSprite( player, 0, 0, true );
      }

}